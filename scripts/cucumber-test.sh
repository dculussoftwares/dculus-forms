#!/bin/bash

# Cucumber Integration Test Script for Dculus Forms
# This script sets up the test environment, runs Cucumber BDD tests, and cleans up

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    print_status "Checking Docker..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    if command -v docker-compose > /dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker-compose"
    elif docker compose version > /dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker compose"
    else
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available ($DOCKER_COMPOSE_CMD)"
}

# Function to wait for service to be healthy
wait_for_service() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if $DOCKER_COMPOSE_CMD -f docker-compose.integration.yml ps $service_name | grep -q "healthy"; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - $service_name not healthy yet, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to wait for backend HTTP endpoint
wait_for_backend_http() {
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for backend HTTP endpoint to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:4000/health > /dev/null 2>&1; then
            print_success "Backend HTTP endpoint is ready"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - backend HTTP endpoint not ready yet, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Backend HTTP endpoint failed to become ready after $max_attempts attempts"
    return 1
}

# Function to setup test environment
setup_test_environment() {
    print_status "Setting up Cucumber test environment..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        pnpm install
    fi
    
    # Create reports directory
    mkdir -p tests/integration/reports
    
    # Pull latest images
    print_status "Pulling Docker images..."
    $DOCKER_COMPOSE_CMD -f docker-compose.integration.yml pull
    
    # Start services
    print_status "Starting Docker services..."
    $DOCKER_COMPOSE_CMD -f docker-compose.integration.yml up -d
    
    # Wait for all services to be healthy
    wait_for_service "mongodb"
    wait_for_service "minio"
    
    # Wait for backend HTTP endpoint (bypass Docker health check issues)
    wait_for_backend_http
    
    print_success "Cucumber test environment is ready!"
}

# Function to run Cucumber tests
run_cucumber_tests() {
    local profile=""
    local tags=""
    local additional_args=""
    
    # Parse test-specific arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --profile)
                profile="--profile $2"
                shift 2
                ;;
            --tags)
                tags="--tags '$2'"
                shift 2
                ;;
            --smoke)
                tags="--tags @smoke"
                shift
                ;;
            --health)
                tags="--tags @health"
                shift
                ;;
            --performance)
                tags="--tags @performance"
                shift
                ;;
            --ci)
                profile="--profile ci"
                shift
                ;;
            *)
                additional_args="$additional_args $1"
                shift
                ;;
        esac
    done
    
    print_status "Running Cucumber BDD tests..."
    
    # Build the cucumber command
    local cucumber_cmd="npx cucumber-js --config cucumber.config.js $profile $tags $additional_args"
    
    print_status "Executing: $cucumber_cmd"
    
    if eval $cucumber_cmd; then
        print_success "🥒 All Cucumber tests passed!"
        return 0
    else
        print_error "🥒 Cucumber tests failed!"
        return 1
    fi
}

# Function to cleanup test environment
cleanup_test_environment() {
    print_status "Cleaning up test environment..."
    
    # Stop and remove containers, networks, and volumes
    $DOCKER_COMPOSE_CMD -f docker-compose.integration.yml down -v --remove-orphans
    
    print_success "Test environment cleaned up!"
}

# Function to show logs
show_logs() {
    print_status "Showing Docker service logs..."
    $DOCKER_COMPOSE_CMD -f docker-compose.integration.yml logs
}

# Function to show report info
show_report_info() {
    if [ -f "tests/integration/reports/cucumber-report.html" ]; then
        print_success "📊 HTML Report generated: tests/integration/reports/cucumber-report.html"
    fi
    if [ -f "tests/integration/reports/cucumber-report.json" ]; then
        print_success "📋 JSON Report generated: tests/integration/reports/cucumber-report.json"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --profile <name>     Use specific Cucumber profile (ci, default)"
    echo "  --tags '<expression>' Run tests matching tag expression"
    echo "  --smoke              Run only smoke tests (@smoke)"
    echo "  --health             Run only health check tests (@health)"
    echo "  --performance        Run only performance tests (@performance)"
    echo "  --ci                 Use CI profile (fail fast, no retries)"
    echo "  --no-cleanup         Don't cleanup Docker environment after tests"
    echo "  --logs               Show Docker logs on test failure"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                             # Run all Cucumber tests"
    echo "  $0 --smoke                     # Run only smoke tests"
    echo "  $0 --tags '@health and @smoke' # Run tests with both tags"
    echo "  $0 --ci --no-cleanup           # CI mode without cleanup"
}

# Main execution
main() {
    local cleanup_on_exit=true
    local show_logs_on_failure=false
    local test_args=()
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-cleanup)
                cleanup_on_exit=false
                shift
                ;;
            --logs)
                show_logs_on_failure=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            --profile|--tags)
                test_args+=("$1" "$2")
                shift 2
                ;;
            --smoke|--health|--performance|--ci)
                test_args+=("$1")
                shift
                ;;
            *)
                test_args+=("$1")
                shift
                ;;
        esac
    done
    
    print_status "Starting Dculus Forms Cucumber BDD Tests"
    print_status "=========================================="
    
    # Trap to ensure cleanup on exit
    if [ "$cleanup_on_exit" = true ]; then
        trap 'cleanup_test_environment' EXIT
    fi
    
    # Check prerequisites
    check_docker
    check_docker_compose
    
    # Setup and run tests
    setup_test_environment
    
    if run_cucumber_tests "${test_args[@]}"; then
        print_success "🎉 All Cucumber BDD tests completed successfully!"
        show_report_info
        exit 0
    else
        print_error "❌ Cucumber BDD tests failed!"
        
        if [ "$show_logs_on_failure" = true ]; then
            show_logs
        fi
        
        show_report_info
        exit 1
    fi
}

# Run main function with all arguments
main "$@"