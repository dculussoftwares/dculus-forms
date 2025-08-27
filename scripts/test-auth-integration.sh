#!/bin/bash

# Integration Test Script for Authentication & GraphQL
# This script runs the complete authentication integration test suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.integration.yml"
ENV_FILE="$PROJECT_ROOT/tests/.env.integration"

# Default options
CLEANUP=true
SHOW_LOGS=false
DEBUG_MODE=false
TAGS=""
PARALLEL=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

# Help function
show_help() {
    cat << EOF
🔐 Authentication Integration Test Runner

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help          Show this help message
    --no-cleanup        Skip cleanup after tests
    --logs              Show Docker logs on failure
    --debug             Enable debug mode with verbose output
    --tags TAGS         Run only tests with specific tags (e.g., "@auth @signup")
    --parallel          Run tests in parallel (experimental)
    
EXAMPLES:
    # Run all authentication tests
    $0

    # Run only signup tests with debug output
    $0 --tags "@auth @signup" --debug

    # Run tests without cleanup (for debugging)
    $0 --no-cleanup --logs

    # Run e2e tests only
    $0 --tags "@e2e"

ENVIRONMENT:
    Set these environment variables to customize behavior:
    - DEBUG_REQUESTS=true    : Log HTTP requests
    - DEBUG_RESPONSES=true   : Log HTTP responses  
    - DEBUG_TOKENS=true      : Log authentication tokens
    - DEBUG_GRAPHQL=true     : Log GraphQL queries/responses
    - DEBUG_VERBOSE=true     : Enable verbose debugging

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --logs)
            SHOW_LOGS=true
            shift
            ;;
        --debug)
            DEBUG_MODE=true
            shift
            ;;
        --tags)
            TAGS="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set debug environment variables if debug mode is enabled
if [[ "$DEBUG_MODE" == "true" ]]; then
    export DEBUG_REQUESTS=true
    export DEBUG_RESPONSES=true
    export DEBUG_TOKENS=true
    export DEBUG_GRAPHQL=true
    export DEBUG_VERBOSE=true
    print_status "🐛 Debug mode enabled - verbose logging active"
fi

# Function to cleanup Docker resources
cleanup() {
    if [[ "$CLEANUP" == "true" ]]; then
        print_status "🧹 Cleaning up Docker resources..."
        
        # Stop and remove containers
        docker-compose -f "$COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
        
        # Remove any dangling images created during testing
        docker image prune -f --filter label=dculus-integration 2>/dev/null || true
        
        print_success "Cleanup completed"
    else
        print_warning "Skipping cleanup - containers remain running for debugging"
        print_status "To clean up manually, run:"
        print_status "  docker-compose -f $COMPOSE_FILE down --volumes"
    fi
}

# Function to show Docker logs on failure
show_docker_logs() {
    if [[ "$SHOW_LOGS" == "true" ]]; then
        print_status "📋 Showing Docker logs..."
        echo
        
        print_status "🗃️ Backend logs:"
        docker-compose -f "$COMPOSE_FILE" logs --tail=50 backend || true
        echo
        
        print_status "🗃️ MongoDB logs:"
        docker-compose -f "$COMPOSE_FILE" logs --tail=20 mongodb || true
        echo
        
        print_status "🗃️ MinIO logs:"
        docker-compose -f "$COMPOSE_FILE" logs --tail=20 minio || true
    fi
}

# Trap to ensure cleanup on exit
trap 'cleanup' EXIT
trap 'print_error "Script interrupted"; show_docker_logs; exit 130' INT TERM

# Main execution
main() {
    print_status "🔐 Starting Authentication Integration Tests..."
    print_status "📁 Project root: $PROJECT_ROOT"
    print_status "🐳 Using Docker Compose file: $COMPOSE_FILE"
    print_status "⚙️ Using environment file: $ENV_FILE"

    # Check if required files exist
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        print_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    if [[ ! -f "$ENV_FILE" ]]; then
        print_error "Environment file not found: $ENV_FILE"
        exit 1
    fi

    # Load environment variables
    print_status "🔧 Loading test environment..."
    source "$ENV_FILE"

    # Start Docker services
    print_status "🚀 Starting Docker services..."
    docker-compose -f "$COMPOSE_FILE" up -d

    # Wait for services to be healthy
    print_status "⏳ Waiting for services to be ready..."
    
    # Wait up to 120 seconds for all services to be healthy
    local timeout=120
    local elapsed=0
    local interval=5
    
    while [[ $elapsed -lt $timeout ]]; do
        if docker-compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy\|starting"; then
            print_status "Services still starting... (${elapsed}s/${timeout}s)"
            sleep $interval
            elapsed=$((elapsed + interval))
        else
            break
        fi
    done

    # Check final service status
    print_status "🔍 Checking service status..."
    if ! docker-compose -f "$COMPOSE_FILE" ps | grep -v "Up (healthy)" | grep -q "Up"; then
        print_error "Some services failed to start properly"
        docker-compose -f "$COMPOSE_FILE" ps
        show_docker_logs
        exit 1
    fi

    print_success "All services are ready"

    # Build Cucumber command
    local cucumber_cmd="npx cucumber-js"
    local features_path="tests/integration/features"
    
    # Add configuration first (using only JavaScript files to avoid conflicts)
    cucumber_cmd="$cucumber_cmd --require tests/integration/setup/cucumber-setup.js"
    cucumber_cmd="$cucumber_cmd --require 'tests/integration/steps/**/*.js'"
    cucumber_cmd="$cucumber_cmd --require 'tests/integration/support/**/*.js'"
    
    # Add tag filtering if specified
    if [[ -n "$TAGS" ]]; then
        cucumber_cmd="$cucumber_cmd --tags \"$TAGS\""
        cucumber_cmd="$cucumber_cmd $features_path/auth-*.feature"
        print_status "🏷️ Running tests with tags: $TAGS"
    else
        # Run all authentication-related features
        cucumber_cmd="$cucumber_cmd $features_path/auth-*.feature"
        print_status "🧪 Running all authentication integration tests"
    fi
    cucumber_cmd="$cucumber_cmd --format pretty"
    cucumber_cmd="$cucumber_cmd --format json:tests/integration/reports/cucumber-auth-report.json"
    
    # Add parallel execution if requested
    if [[ "$PARALLEL" == "true" ]]; then
        cucumber_cmd="$cucumber_cmd --parallel 2"
        print_status "🏃‍♂️ Running tests in parallel mode"
    fi

    # Run the tests
    print_status "🧪 Executing authentication integration tests..."
    echo
    
    cd "$PROJECT_ROOT"
    
    local test_exit_code=0
    if [[ "$DEBUG_MODE" == "true" ]]; then
        # In debug mode, show all output
        eval "$cucumber_cmd" || test_exit_code=$?
    else
        # Normal mode with cleaner output
        eval "$cucumber_cmd" 2>&1 || test_exit_code=$?
    fi

    echo
    
    # Report results
    if [[ $test_exit_code -eq 0 ]]; then
        print_success "All authentication integration tests passed! 🎉"
        
        # Show brief summary
        if [[ -f "tests/integration/reports/cucumber-auth-report.json" ]]; then
            print_status "📊 Test report saved to: tests/integration/reports/cucumber-auth-report.json"
        fi
        
    else
        print_error "Some authentication integration tests failed"
        show_docker_logs
        
        print_status "🔍 For debugging:"
        print_status "  - Check logs above"
        print_status "  - Use --no-cleanup to keep containers running"
        print_status "  - Use --debug for verbose output"
        print_status "  - Access MinIO console: http://localhost:9001 (minioadmin/minioadmin123)"
        print_status "  - Connect to MongoDB: mongosh \"mongodb://admin:password123@localhost:27017/dculus_test?authSource=admin\""
        
        exit $test_exit_code
    fi
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose >/dev/null 2>&1; then
    print_error "docker-compose is not installed or not in PATH"
    exit 1
fi

# Run main function
main "$@"