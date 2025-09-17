#!/bin/bash

# Integration Test Runner with Tag Support
# This script allows running integration tests by tags for targeted testing

set -e

# Base command for cucumber tests
BASE_CMD="TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js 'test/integration/features/*.feature' --require-module ts-node/register --require test/integration/support/world.ts --require test/integration/support/hooks.ts --require test/integration/step-definitions/common.steps.ts --require 'test/integration/step-definitions/*.steps.ts'"

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Integration test runner with tag support"
    echo ""
    echo "OPTIONS:"
    echo "  -t, --tags TAGS         Run tests with specific tags (e.g., '@FormLifecycle', '@Permission')"
    echo "  -f, --feature FEATURE   Run specific feature file (e.g., 'form-lifecycle', 'form-responses')"
    echo "  -n, --name NAME         Run specific scenario by name"
    echo "  -d, --dry-run           Show scenarios without executing them"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "AVAILABLE TAGS:"
    echo "  @FormLifecycle          - Form creation, update, deletion scenarios"
    echo "  @FormCreation           - Form creation scenarios"
    echo "  @FormUpdate             - Form update scenarios"
    echo "  @FormDeletion           - Form deletion scenarios"
    echo "  @FormRetrieval          - Form retrieval scenarios"
    echo "  @FormURL                - URL generation scenarios"
    echo "  @Permission             - Permission-related scenarios"
    echo "  @ErrorHandling          - Error handling scenarios"
    echo "  @BusinessRules          - Business logic scenarios"
    echo "  @FormResponses          - Response submission and management"
    echo "  @ResponseSubmission     - Response submission scenarios"
    echo "  @Analytics              - Analytics tracking scenarios"
    echo "  @Auth                   - Authentication scenarios"
    echo "  @admin                  - Admin functionality scenarios"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 --tags '@Permission'                    # Run all permission tests"
    echo "  $0 --tags '@FormLifecycle and @Permission' # Run permission tests in form lifecycle"
    echo "  $0 --feature form-lifecycle                # Run all form lifecycle tests"
    echo "  $0 --name 'Create form from template'      # Run specific scenario"
    echo "  $0 --dry-run                              # List all scenarios without running"
    echo "  $0 --tags '@FormCreation' --dry-run       # List form creation scenarios"
}

# Parse command line arguments
TAGS=""
FEATURE=""
NAME=""
DRY_RUN=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tags)
            TAGS="$2"
            shift 2
            ;;
        -f|--feature)
            FEATURE="$2"
            shift 2
            ;;
        -n|--name)
            NAME="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Build the command
CMD="$BASE_CMD"

# Add feature filter if specified
if [[ -n "$FEATURE" ]]; then
    CMD="TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js 'test/integration/features/${FEATURE}.feature' --require-module ts-node/register --require test/integration/support/world.ts --require test/integration/support/hooks.ts --require test/integration/step-definitions/common.steps.ts --require 'test/integration/step-definitions/*.steps.ts'"
fi

# Add tags filter if specified
if [[ -n "$TAGS" ]]; then
    CMD="$CMD --tags '$TAGS'"
fi

# Add name filter if specified
if [[ -n "$NAME" ]]; then
    CMD="$CMD --name '$NAME'"
fi

# Add dry-run if specified
if [[ -n "$DRY_RUN" ]]; then
    CMD="$CMD $DRY_RUN"
fi

# Display the command being run
echo "🚀 Running integration tests..."
echo "Command: $CMD"
echo ""

# Execute the command
eval $CMD

echo ""
echo "✅ Integration test execution completed!"