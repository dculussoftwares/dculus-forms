#!/bin/bash

# Script to run auth integration tests using tags
# Usage: ./test-auth.sh [tag]
# Examples:
#   ./test-auth.sh              # Run all auth tests
#   ./test-auth.sh @Auth        # Run all auth tests
#   ./test-auth.sh @SignUp      # Run only sign-up tests
#   ./test-auth.sh @SignIn      # Run only sign-in tests
#   ./test-auth.sh @GraphQL     # Run only GraphQL tests
#   ./test-auth.sh @Security    # Run only security/error tests
#   ./test-auth.sh @Organizations  # Run only organization tests

set -e

# Default to @Auth tag if no tag provided
TAG="${1:-@Auth}"

echo "🧪 Running auth integration tests with tag: $TAG"
echo "=================================================="

# Change to project root directory
cd "$(dirname "$0")"

# Run the cucumber tests with the specified tag
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js \
  test/integration/features/auth.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --tags "$TAG"

echo ""
echo "✅ Test run completed!"