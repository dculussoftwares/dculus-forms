#!/bin/bash

# Integration Test Script for Dculus Forms
# This script sets up the test environment, runs integration tests, and cleans up

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
    print_status "Setting up integration test environment..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        pnpm install
    fi
    
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
    
    print_success "Test environment is ready!"
}

# Function to run integration tests
run_tests() {
    print_status "Running integration tests..."
    
    # Run Jest with the integration test config
    if npx jest --config jest.integration.config.js --runInBand --verbose; then
        print_success "All integration tests passed!"
        return 0
    else
        print_error "Integration tests failed!"
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

# Main execution
main() {
    local cleanup_on_exit=true
    local show_logs_on_failure=false
    
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
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --no-cleanup    Don't cleanup Docker environment after tests"
                echo "  --logs          Show Docker logs on test failure"
                echo "  -h, --help      Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_status "Starting Dculus Forms Integration Tests"
    print_status "======================================="
    
    # Trap to ensure cleanup on exit
    if [ "$cleanup_on_exit" = true ]; then
        trap 'cleanup_test_environment' EXIT
    fi
    
    # Check prerequisites
    check_docker
    check_docker_compose
    
    # Setup and run tests
    setup_test_environment
    
    if run_tests; then
        print_success "🎉 All integration tests completed successfully!"
        exit 0
    else
        print_error "❌ Integration tests failed!"
        
        if [ "$show_logs_on_failure" = true ]; then
            show_logs
        fi
        
        exit 1
    fi
}

# Run main function with all arguments
main "$@"