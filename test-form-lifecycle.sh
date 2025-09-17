#!/bin/bash

# Script to run Form Lifecycle integration tests using tags
# Usage: ./test-form-lifecycle.sh [tag]
# Example: ./test-form-lifecycle.sh @FormCreation
# Default: runs all @FormLifecycle tests

set -e

# Default tag if no argument provided
TAG="${1:-@FormLifecycle}"

echo "🧪 Running Form Lifecycle Integration Tests with tag: $TAG"
echo "=================================================="

# Ensure we're in the project root
cd "$(dirname "$0")"

# Run the test with the specified tag
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js \
  test/integration/features/form-lifecycle.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --tags "$TAG" \
  --format pretty

echo ""
echo "✅ Form Lifecycle tests completed!"