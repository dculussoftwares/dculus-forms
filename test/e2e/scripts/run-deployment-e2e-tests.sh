#!/bin/bash

# Deployment E2E Test Runner Script for Dculus Forms
# This script runs e2e tests against deployed services

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
MAX_WAIT_TIME=300  # 5 minutes for deployment readiness
HEALTH_CHECK_INTERVAL=10

# Default deployment URLs (can be overridden by environment variables)
DEFAULT_FORM_APP_URL="https://dculus-forms-app.pages.dev"
DEFAULT_BACKEND_URL="https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io"

echo -e "${BLUE}🚀 Dculus Forms Deployment E2E Test Runner${NC}"
echo "=================================================="

# Function to log with timestamp
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    local name=$1
    local url=$2
    local max_attempts=$((MAX_WAIT_TIME / HEALTH_CHECK_INTERVAL))
    local attempt=1
    
    log "${YELLOW}⏳ Waiting for $name to be ready at $url...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f --max-time 30 "$url" >/dev/null 2>&1; then
            log "${GREEN}✅ $name is ready (attempt $attempt/$max_attempts)${NC}"
            return 0
        fi
        
        log "⏳ $name not ready, retrying in ${HEALTH_CHECK_INTERVAL}s (attempt $attempt/$max_attempts)"
        sleep $HEALTH_CHECK_INTERVAL
        attempt=$((attempt + 1))
    done
    
    log "${RED}❌ $name failed to respond within $MAX_WAIT_TIME seconds${NC}"
    return 1
}

# Function to validate deployment readiness
validate_deployments() {
    log "${BLUE}🔍 Validating deployment readiness...${NC}"
    
    # Get URLs from environment or use defaults
    FORM_APP_URL="${DEPLOYMENT_FORM_APP_URL:-$DEFAULT_FORM_APP_URL}"
    BACKEND_URL="${DEPLOYMENT_BACKEND_URL:-$DEFAULT_BACKEND_URL}"
    
    log "Form App URL: $FORM_APP_URL"
    log "Backend URL: $BACKEND_URL"
    
    # Check frontend deployment
    if ! wait_for_deployment "Form App" "$FORM_APP_URL"; then
        log "${RED}❌ Form App deployment not ready${NC}"
        return 1
    fi
    
    # Check backend health endpoint
    if ! wait_for_deployment "Backend" "$BACKEND_URL/health"; then
        log "${RED}❌ Backend deployment not ready${NC}"
        return 1
    fi
    
    # Test GraphQL endpoint
    log "${YELLOW}🔍 Testing GraphQL endpoint...${NC}"
    if curl -X POST "$BACKEND_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __schema { types { name } } }"}' \
        --max-time 30 --fail-with-body >/dev/null 2>&1; then
        log "${GREEN}✅ GraphQL endpoint is responding${NC}"
    else
        log "${YELLOW}⚠️  GraphQL endpoint test failed, but continuing...${NC}"
    fi
    
    log "${GREEN}✅ All deployments are ready!${NC}"
}

# Function to run e2e tests against deployment
run_tests() {
    log "${BLUE}🧪 Running E2E tests against deployment...${NC}"
    
    # Create reports directory
    mkdir -p "$E2E_DIR/reports"
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables for tests to use deployed URLs
    export E2E_BASE_URL="$FORM_APP_URL"
    export E2E_BACKEND_URL="$BACKEND_URL"
    export E2E_SKIP_WEBSERVER=true  # Skip starting local services
    export E2E_DEPLOYMENT_MODE=true
    
    # Additional environment variables for deployment testing
    export PLAYWRIGHT_HEADLESS=true
    export PLAYWRIGHT_TIMEOUT=60000  # Increased timeout for production
    
    log "${BLUE}🌐 Test Configuration:${NC}"
    log "  Frontend URL: $E2E_BASE_URL"
    log "  Backend URL: $E2E_BACKEND_URL"
    log "  Deployment Mode: $E2E_DEPLOYMENT_MODE"
    
    # Run the tests with deployment-specific configuration
    if TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js 'test/e2e/features/*.feature' \
        --require-module ts-node/register \
        --require test/e2e/support/world.ts \
        --require test/e2e/support/hooks.ts \
        --require 'test/e2e/step-definitions/*.steps.ts' \
        --format summary \
        --format progress-bar \
        --format @cucumber/pretty-formatter \
        --format "html:test/e2e/reports/deployment-cucumber-report.html" \
        --format "json:test/e2e/reports/deployment-cucumber-report.json" \
        --tags "not @local-only"; then  # Skip tests that are local-only
        
        log "${GREEN}✅ Deployment E2E tests completed successfully!${NC}"
        TEST_RESULT=0
    else
        log "${RED}❌ Deployment E2E tests failed!${NC}"
        TEST_RESULT=1
    fi
    
    # Show report locations
    log "${BLUE}📊 Test reports generated:${NC}"
    log "  HTML Report: test/e2e/reports/deployment-cucumber-report.html"
    log "  JSON Report: test/e2e/reports/deployment-cucumber-report.json"
    log "  Screenshots: test/e2e/reports/*.png"
}

# Function to cleanup and exit
cleanup_and_exit() {
    local exit_code=${1:-0}
    
    # Clean up temporary files
    rm -f "$E2E_DIR/deployment-test.log"
    
    if [ $exit_code -eq 0 ]; then
        log "${GREEN}🎉 Deployment E2E test run completed successfully!${NC}"
    else
        log "${RED}💥 Deployment E2E test run failed!${NC}"
    fi
    
    exit $exit_code
}

# Set up signal handlers for cleanup
trap 'cleanup_and_exit 130' INT  # Ctrl+C
trap 'cleanup_and_exit 143' TERM # Termination signal

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --form-app-url)
            DEPLOYMENT_FORM_APP_URL="$2"
            shift 2
            ;;
        --backend-url)
            DEPLOYMENT_BACKEND_URL="$2"
            shift 2
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
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
        --tags)
            CUCUMBER_TAGS="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --form-app-url URL     Form app URL (default: $DEFAULT_FORM_APP_URL)"
            echo "  --backend-url URL      Backend URL (default: $DEFAULT_BACKEND_URL)"
            echo "  --skip-validation      Skip deployment readiness check"
            echo "  --headed               Run tests with visible browser"
            echo "  --slow                 Run tests in slow motion"
            echo "  --tags TAGS            Cucumber tags to run"
            echo "  --help                 Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  DEPLOYMENT_FORM_APP_URL  Override form app URL"
            echo "  DEPLOYMENT_BACKEND_URL   Override backend URL"
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
    mkdir -p "$E2E_DIR/reports"
    
    # Validate deployments are ready (unless skipped)
    if [ "$SKIP_VALIDATION" != true ]; then
        validate_deployments
    else
        log "${YELLOW}⚠️  Skipping deployment validation${NC}"
        # Still need to set URLs for tests
        FORM_APP_URL="${DEPLOYMENT_FORM_APP_URL:-$DEFAULT_FORM_APP_URL}"
        BACKEND_URL="${DEPLOYMENT_BACKEND_URL:-$DEFAULT_BACKEND_URL}"
    fi
    
    # Run tests
    run_tests
    
    # Cleanup and exit
    cleanup_and_exit $TEST_RESULT
}

# Run main function
main "$@"