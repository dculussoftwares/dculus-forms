#!/bin/bash

# Deployment Integration Test Runner Script for Dculus Forms
# This script runs integration tests against deployed backend

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
INTEGRATION_DIR="$PROJECT_ROOT/test/integration"
MAX_WAIT_TIME=300  # 5 minutes for deployment readiness
HEALTH_CHECK_INTERVAL=10

# Default deployment URL (can be overridden by environment variables)
DEFAULT_BACKEND_URL="https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io"

echo -e "${BLUE}🚀 Dculus Forms Deployment Integration Test Runner${NC}"
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

# Function to validate backend deployment readiness
validate_backend_deployment() {
    log "${BLUE}🔍 Validating backend deployment readiness...${NC}"
    
    # Get backend URL from environment or use default
    BACKEND_URL="${DEPLOYMENT_BACKEND_URL:-$DEFAULT_BACKEND_URL}"
    
    log "Backend URL: $BACKEND_URL"
    
    # Check backend health endpoint
    if ! wait_for_deployment "Backend" "$BACKEND_URL/health"; then
        log "${RED}❌ Backend deployment not ready${NC}"
        return 1
    fi
    
    # Test GraphQL endpoint with introspection
    log "${YELLOW}🔍 Testing GraphQL endpoint with introspection query...${NC}"
    local graphql_response
    if graphql_response=$(curl -X POST "$BACKEND_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __schema { types { name } } }"}' \
        --max-time 30 --fail-with-body -s 2>/dev/null); then
        
        # Check if response contains expected schema data
        if echo "$graphql_response" | grep -q '"types"'; then
            log "${GREEN}✅ GraphQL endpoint is responding with valid schema${NC}"
        else
            log "${YELLOW}⚠️  GraphQL endpoint responded but schema seems invalid${NC}"
            log "Response: $graphql_response"
        fi
    else
        log "${RED}❌ GraphQL endpoint is not responding properly${NC}"
        return 1
    fi
    
    # Test public template query (should work without authentication)
    log "${YELLOW}🔍 Testing public template query...${NC}"
    local template_response
    if template_response=$(curl -X POST "$BACKEND_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ publicTemplates { id title description category } }"}' \
        --max-time 30 --fail-with-body -s 2>/dev/null); then
        
        if echo "$template_response" | grep -q '"publicTemplates"'; then
            log "${GREEN}✅ Public template query is working${NC}"
        else
            log "${YELLOW}⚠️  Public template query responded but data seems invalid${NC}"
            log "Response: $template_response"
        fi
    else
        log "${YELLOW}⚠️  Public template query failed, but continuing tests...${NC}"
    fi
    
    log "${GREEN}✅ Backend deployment validation completed!${NC}"
}

# Function to run integration tests against deployment
run_tests() {
    log "${BLUE}🧪 Running Integration tests against deployment...${NC}"
    
    # Create reports directory
    mkdir -p "$INTEGRATION_DIR/reports"
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables for tests to use deployed backend
    export TEST_BASE_URL="$BACKEND_URL"
    export TEST_DEPLOYMENT_MODE=true
    export NODE_ENV=test
    
    # Additional environment variables for deployment testing
    export TEST_TIMEOUT=60000  # Increased timeout for production
    export TEST_RETRY_COUNT=3  # More retries for network issues
    
    log "${BLUE}🌐 Test Configuration:${NC}"
    log "  Backend URL: $TEST_BASE_URL"
    log "  Deployment Mode: $TEST_DEPLOYMENT_MODE"
    log "  Timeout: $TEST_TIMEOUT ms"
    log "  Retry Count: $TEST_RETRY_COUNT"
    
    # Run the integration tests with deployment-specific configuration
    if TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js 'test/integration/features/*.feature' \
        --require-module ts-node/register \
        --require test/integration/support/world.ts \
        --require test/integration/support/hooks.ts \
        --require test/integration/step-definitions/common.steps.ts \
        --require 'test/integration/step-definitions/*.steps.ts' \
        --format summary \
        --format progress-bar \
        --format @cucumber/pretty-formatter \
        --format "html:test/integration/reports/deployment-cucumber-report.html" \
        --format "json:test/integration/reports/deployment-cucumber-report.json" \
        --tags "not @local-only"; then  # Skip tests that are local-only
        
        log "${GREEN}✅ Deployment Integration tests completed successfully!${NC}"
        TEST_RESULT=0
    else
        log "${RED}❌ Deployment Integration tests failed!${NC}"
        TEST_RESULT=1
    fi
    
    # Show report locations
    log "${BLUE}📊 Test reports generated:${NC}"
    log "  HTML Report: test/integration/reports/deployment-cucumber-report.html"
    log "  JSON Report: test/integration/reports/deployment-cucumber-report.json"
}

# Function to cleanup and exit
cleanup_and_exit() {
    local exit_code=${1:-0}
    
    # Clean up temporary files
    rm -f "$INTEGRATION_DIR/deployment-test.log"
    
    if [ $exit_code -eq 0 ]; then
        log "${GREEN}🎉 Deployment Integration test run completed successfully!${NC}"
    else
        log "${RED}💥 Deployment Integration test run failed!${NC}"
    fi
    
    exit $exit_code
}

# Set up signal handlers for cleanup
trap 'cleanup_and_exit 130' INT  # Ctrl+C
trap 'cleanup_and_exit 143' TERM # Termination signal

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-url)
            DEPLOYMENT_BACKEND_URL="$2"
            shift 2
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --timeout)
            TEST_TIMEOUT="$2"
            shift 2
            ;;
        --retry-count)
            TEST_RETRY_COUNT="$2"
            shift 2
            ;;
        --tags)
            CUCUMBER_TAGS="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backend-url URL      Backend URL (default: $DEFAULT_BACKEND_URL)"
            echo "  --skip-validation      Skip deployment readiness check"
            echo "  --timeout TIMEOUT      Test timeout in milliseconds (default: 60000)"
            echo "  --retry-count COUNT    Number of retries for failed requests (default: 3)"
            echo "  --tags TAGS            Cucumber tags to run"
            echo "  --verbose              Enable verbose logging"
            echo "  --help                 Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  DEPLOYMENT_BACKEND_URL   Override backend URL"
            echo "  TEST_TIMEOUT             Override test timeout"
            echo "  TEST_RETRY_COUNT         Override retry count"
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
    mkdir -p "$INTEGRATION_DIR/reports"
    
    # Validate backend deployment is ready (unless skipped)
    if [ "$SKIP_VALIDATION" != true ]; then
        validate_backend_deployment
    else
        log "${YELLOW}⚠️  Skipping deployment validation${NC}"
        # Still need to set URL for tests
        BACKEND_URL="${DEPLOYMENT_BACKEND_URL:-$DEFAULT_BACKEND_URL}"
    fi
    
    # Run tests
    run_tests
    
    # Cleanup and exit
    cleanup_and_exit $TEST_RESULT
}

# Run main function
main "$@"