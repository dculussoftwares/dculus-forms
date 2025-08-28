#!/bin/bash

# E2E Test Runner Script for Dculus Forms
# This script starts all required services and runs e2e tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
E2E_DIR="$PROJECT_ROOT/test/e2e"
BACKEND_PORT=4000
FRONTEND_PORT=3000
MAX_WAIT_TIME=120  # 2 minutes
HEALTH_CHECK_INTERVAL=2

# Service management
SERVICES_PID_FILE="$E2E_DIR/.services.pid"
CLEANUP_ON_EXIT=true

echo -e "${BLUE}🚀 Dculus Forms E2E Test Runner${NC}"
echo "=================================================="

# Function to log with timestamp
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if a port is in use
is_port_in_use() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
    else
        netstat -ln 2>/dev/null | grep -q ":$port "
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local name=$1
    local url=$2
    local max_attempts=$((MAX_WAIT_TIME / HEALTH_CHECK_INTERVAL))
    local attempt=1
    
    log "${YELLOW}⏳ Waiting for $name to be ready at $url...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log "${GREEN}✅ $name is ready (attempt $attempt/$max_attempts)${NC}"
            return 0
        fi
        
        log "⏳ $name not ready, retrying in ${HEALTH_CHECK_INTERVAL}s (attempt $attempt/$max_attempts)"
        sleep $HEALTH_CHECK_INTERVAL
        attempt=$((attempt + 1))
    done
    
    log "${RED}❌ $name failed to start within $MAX_WAIT_TIME seconds${NC}"
    return 1
}

# Function to start services
start_services() {
    log "${BLUE}📦 Starting required services...${NC}"
    
    # Check if services are already running
    if is_port_in_use $BACKEND_PORT; then
        log "${YELLOW}⚠️  Backend already running on port $BACKEND_PORT${NC}"
        BACKEND_ALREADY_RUNNING=true
    else
        BACKEND_ALREADY_RUNNING=false
    fi
    
    if is_port_in_use $FRONTEND_PORT; then
        log "${YELLOW}⚠️  Frontend already running on port $FRONTEND_PORT${NC}"
        FRONTEND_ALREADY_RUNNING=true
    else
        FRONTEND_ALREADY_RUNNING=false
    fi
    
    # Note: Backend uses cloud MongoDB, no local database setup needed
    log "${BLUE}🗄️  Using cloud MongoDB (no local database needed)${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Start backend if not already running
    if [ "$BACKEND_ALREADY_RUNNING" = false ]; then
        log "${BLUE}🔧 Starting backend server...${NC}"
        pnpm backend:dev > "$E2E_DIR/backend.log" 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID >> "$SERVICES_PID_FILE"
        log "Backend started with PID: $BACKEND_PID"
    fi
    
    # Start frontend if not already running
    if [ "$FRONTEND_ALREADY_RUNNING" = false ]; then
        log "${BLUE}⚛️  Starting form app...${NC}"
        pnpm form-app:dev > "$E2E_DIR/form-app.log" 2>&1 &
        FRONTEND_PID=$!
        echo $FRONTEND_PID >> "$SERVICES_PID_FILE"
        log "Form app started with PID: $FRONTEND_PID"
    fi
    
    # Wait for services to be ready
    if ! wait_for_service "Backend" "http://localhost:$BACKEND_PORT/health"; then
        log "${RED}❌ Backend failed to start${NC}"
        cleanup_and_exit 1
    fi
    
    if ! wait_for_service "Frontend" "http://localhost:$FRONTEND_PORT"; then
        log "${RED}❌ Frontend failed to start${NC}"
        cleanup_and_exit 1
    fi
    
    log "${GREEN}✅ All services are ready!${NC}"
}

# Function to run e2e tests
run_tests() {
    log "${BLUE}🧪 Running E2E tests...${NC}"
    
    # Create reports directory
    mkdir -p "$E2E_DIR/reports"
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables for tests
    export E2E_BASE_URL="http://localhost:$FRONTEND_PORT"
    export E2E_BACKEND_URL="http://localhost:$BACKEND_PORT"
    
    # Run the tests
    if TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js 'test/e2e/features/*.feature' \
        --require-module ts-node/register \
        --require test/e2e/support/world.ts \
        --require test/e2e/support/hooks.ts \
        --require 'test/e2e/step-definitions/*.steps.ts' \
        --format summary \
        --format progress-bar \
        --format @cucumber/pretty-formatter \
        --format "html:test/e2e/reports/cucumber-report.html" \
        --format "json:test/e2e/reports/cucumber-report.json"; then
        
        log "${GREEN}✅ E2E tests completed successfully!${NC}"
        TEST_RESULT=0
    else
        log "${RED}❌ E2E tests failed!${NC}"
        TEST_RESULT=1
    fi
    
    # Show report locations
    log "${BLUE}📊 Test reports generated:${NC}"
    log "  HTML Report: test/e2e/reports/cucumber-report.html"
    log "  JSON Report: test/e2e/reports/cucumber-report.json"
    log "  Screenshots: test/e2e/reports/*.png"
}

# Function to cleanup services
cleanup_services() {
    log "${BLUE}🧹 Cleaning up services...${NC}"
    
    if [ -f "$SERVICES_PID_FILE" ]; then
        while read -r pid; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                log "Stopping process with PID: $pid"
                kill "$pid" 2>/dev/null || true
                
                # Wait a bit for graceful shutdown
                sleep 2
                
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    log "Force killing process with PID: $pid"
                    kill -9 "$pid" 2>/dev/null || true
                fi
            fi
        done < "$SERVICES_PID_FILE"
        
        rm -f "$SERVICES_PID_FILE"
    fi
    
    # Clean up log files
    rm -f "$E2E_DIR/backend.log" "$E2E_DIR/form-app.log"
}

# Function to cleanup and exit
cleanup_and_exit() {
    local exit_code=${1:-0}
    
    if [ "$CLEANUP_ON_EXIT" = true ]; then
        cleanup_services
    fi
    
    if [ $exit_code -eq 0 ]; then
        log "${GREEN}🎉 E2E test run completed successfully!${NC}"
    else
        log "${RED}💥 E2E test run failed!${NC}"
    fi
    
    exit $exit_code
}

# Set up signal handlers for cleanup
trap 'cleanup_and_exit 130' INT  # Ctrl+C
trap 'cleanup_and_exit 143' TERM # Termination signal

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cleanup)
            CLEANUP_ON_EXIT=false
            shift
            ;;
        --headed)
            export PLAYWRIGHT_HEADLESS=false
            shift
            ;;
        --slow)
            export PLAYWRIGHT_SLOW_MO=1000
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-cleanup    Don't stop services after tests"
            echo "  --headed        Run tests with visible browser"
            echo "  --slow          Run tests in slow motion"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            log "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Main execution
main() {
    # Initialize
    rm -f "$SERVICES_PID_FILE"
    mkdir -p "$E2E_DIR/reports"
    
    # Start services
    start_services
    
    # Run tests
    run_tests
    
    # Cleanup and exit
    cleanup_and_exit $TEST_RESULT
}

# Run main function
main "$@"