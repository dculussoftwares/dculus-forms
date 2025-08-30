#!/bin/bash

# Short Text Field Properties E2E Test Runner
# This script runs comprehensive end-to-end tests for Short Text field properties and validation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo "🧪 Short Text Field Properties E2E Test Runner"
echo "=============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if services are already running
check_services() {
    print_info "Checking if services are already running..."
    
    if curl -s http://localhost:4000/health > /dev/null 2>&1; then
        print_success "Backend service is running on port 4000"
        BACKEND_RUNNING=true
    else
        print_warning "Backend service is not running"
        BACKEND_RUNNING=false
    fi
    
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Form app is running on port 3000"
        FORM_APP_RUNNING=true
    else
        print_warning "Form app is not running"
        FORM_APP_RUNNING=false
    fi
}

# Function to start services if needed
start_services() {
    if [[ "$BACKEND_RUNNING" == false || "$FORM_APP_RUNNING" == false ]]; then
        print_info "Starting required services..."
        
        # Start services in background
        if [[ "$BACKEND_RUNNING" == false ]]; then
            print_info "Starting backend service..."
            cd "$PROJECT_ROOT" && pnpm backend:dev > /tmp/backend.log 2>&1 &
            BACKEND_PID=$!
            sleep 10
            
            # Wait for backend to be ready
            for i in {1..30}; do
                if curl -s http://localhost:4000/health > /dev/null 2>&1; then
                    print_success "Backend service started successfully"
                    break
                fi
                if [[ $i -eq 30 ]]; then
                    print_error "Backend service failed to start after 30 seconds"
                    exit 1
                fi
                sleep 1
            done
        fi
        
        if [[ "$FORM_APP_RUNNING" == false ]]; then
            print_info "Starting form app..."
            cd "$PROJECT_ROOT" && pnpm form-app:dev > /tmp/form-app.log 2>&1 &
            FORM_APP_PID=$!
            sleep 15
            
            # Wait for form app to be ready
            for i in {1..30}; do
                if curl -s http://localhost:3000 > /dev/null 2>&1; then
                    print_success "Form app started successfully"
                    break
                fi
                if [[ $i -eq 30 ]]; then
                    print_error "Form app failed to start after 30 seconds"
                    exit 1
                fi
                sleep 1
            done
        fi
        
        print_success "All services are now running"
        sleep 5
    else
        print_success "All required services are already running"
    fi
}

# Function to stop services if we started them
cleanup_services() {
    if [[ -n "$BACKEND_PID" ]]; then
        print_info "Stopping backend service (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [[ -n "$FORM_APP_PID" ]]; then
        print_info "Stopping form app (PID: $FORM_APP_PID)..."
        kill $FORM_APP_PID 2>/dev/null || true
    fi
}

# Trap to cleanup on script exit
trap cleanup_services EXIT

# Main test execution function
run_tests() {
    local test_type="$1"
    local headless="${2:-true}"
    
    print_info "Running Short Text Field Properties tests..."
    print_info "Test type: $test_type"
    print_info "Headless mode: $headless"
    
    # Set environment variables
    export PLAYWRIGHT_HEADLESS="$headless"
    if [[ "$SERVICES_ALREADY_RUNNING" != "true" ]]; then
        export SERVICES_ALREADY_RUNNING="true"  # Since we manage services in this script
    fi
    
    # Base command for running tests
    local base_cmd="TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/short-text-field-properties.feature \
        --require-module ts-node/register \
        --require test/e2e/support/world.ts \
        --require test/e2e/support/hooks.ts \
        --require 'test/e2e/step-definitions/*.steps.ts'"
    
    cd "$PROJECT_ROOT"
    
    case "$test_type" in
        "all")
            print_info "Running all Short Text field properties tests..."
            eval "$base_cmd --tags '@FieldProperties and @ShortText'"
            ;;
        "basic")
            print_info "Running basic field properties configuration tests..."
            eval "$base_cmd --tags '@BasicSettings'"
            ;;
        "validation")
            print_info "Running character limits and validation tests..."
            eval "$base_cmd --tags '@CharacterLimits or @RequiredValidation'"
            ;;
        "negative")
            print_info "Running negative test cases..."
            eval "$base_cmd --tags '@NegativeTest'"
            ;;
        "integration")
            print_info "Running form submission integration tests..."
            eval "$base_cmd --tags '@Integration'"
            ;;
        "persistence")
            print_info "Running settings persistence tests..."
            eval "$base_cmd --tags '@SettingsPersistence'"
            ;;
        "dry-run")
            print_info "Running dry-run to validate test scenarios..."
            eval "$base_cmd --tags '@FieldProperties' --dry-run"
            ;;
        *)
            print_error "Unknown test type: $test_type"
            print_info "Available test types: all, basic, validation, negative, integration, persistence, dry-run"
            exit 1
            ;;
    esac
    
    if [[ $? -eq 0 ]]; then
        print_success "Tests completed successfully!"
    else
        print_error "Tests failed!"
        exit 1
    fi
}

# Interactive menu function
show_menu() {
    echo ""
    echo "Select test type to run:"
    echo "1) All Short Text field properties tests"
    echo "2) Basic field properties configuration"
    echo "3) Character limits and validation"
    echo "4) Negative test cases"
    echo "5) Form submission integration"
    echo "6) Settings persistence"
    echo "7) Dry-run (validate scenarios)"
    echo "8) Quit"
    echo ""
    
    read -p "Enter your choice (1-8): " choice
    
    case $choice in
        1) run_tests "all" ;;
        2) run_tests "basic" ;;
        3) run_tests "validation" ;;
        4) run_tests "negative" ;;
        5) run_tests "integration" ;;
        6) run_tests "persistence" ;;
        7) run_tests "dry-run" ;;
        8) 
            print_info "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please select 1-8."
            show_menu
            ;;
    esac
}

# Parse command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Short Text Field Properties E2E Test Runner"
        echo ""
        echo "Usage: $0 [test-type] [--visible]"
        echo ""
        echo "Test types:"
        echo "  all         - Run all Short Text field properties tests"
        echo "  basic       - Run basic field properties configuration tests"
        echo "  validation  - Run character limits and validation tests"
        echo "  negative    - Run negative test cases"
        echo "  integration - Run form submission integration tests"
        echo "  persistence - Run settings persistence tests"
        echo "  dry-run     - Validate test scenarios (dry-run)"
        echo ""
        echo "Options:"
        echo "  --visible   - Run tests in visible browser mode (default: headless)"
        echo "  --help      - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  SERVICES_ALREADY_RUNNING=true  - Skip service startup (default: false)"
        echo "  PLAYWRIGHT_HEADLESS=false      - Run in visible browser mode"
        echo ""
        exit 0
        ;;
    "")
        # No arguments - show interactive menu
        check_services
        start_services
        show_menu
        ;;
    *)
        # Command line arguments provided
        test_type="$1"
        headless="true"
        
        if [[ "${2:-}" == "--visible" ]]; then
            headless="false"
        fi
        
        check_services
        start_services
        run_tests "$test_type" "$headless"
        ;;
esac

print_success "Short Text Field Properties E2E tests completed successfully!"