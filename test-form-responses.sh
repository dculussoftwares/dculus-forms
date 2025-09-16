#!/bin/bash

# Script to run form-responses integration tests with tags
# Usage:
#   ./test-form-responses.sh                    # Run all form response tests
#   ./test-form-responses.sh @ResponseSubmission # Run only response submission tests
#   ./test-form-responses.sh @BusinessRules     # Run only business rules tests
#   ./test-form-responses.sh @Analytics         # Run only analytics tests

set -e

# Default to running all form response tests if no tag provided
TAGS=${1:-@FormResponses}

echo "🧪 Running Form Response Integration Tests with tags: $TAGS"
echo "📁 Test file: test/integration/features/form-responses.feature"
echo ""

# Navigate to project root if not already there
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if the feature file exists
if [ ! -f "test/integration/features/form-responses.feature" ]; then
    echo "❌ Error: form-responses.feature file not found"
    exit 1
fi

# Run the cucumber tests with specified tags
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js \
    test/integration/features/form-responses.feature \
    --require-module ts-node/register \
    --require test/integration/support/world.ts \
    --require test/integration/support/hooks.ts \
    --require test/integration/step-definitions/common.steps.ts \
    --require 'test/integration/step-definitions/*.steps.ts' \
    --tags "$TAGS" \
    --fail-fast

echo ""
echo "✅ Form Response Integration Tests completed!"