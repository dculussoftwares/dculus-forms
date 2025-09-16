#!/bin/bash

# Script to run auth-graphql integration tests using tags
# Usage: ./test-auth-graphql.sh [tag]
# Examples:
#   ./test-auth-graphql.sh              # Run all auth-graphql tests
#   ./test-auth-graphql.sh @AuthError   # Run only authentication error tests
#   ./test-auth-graphql.sh @UserQuery   # Run only user query tests

set -e

# Default to @AuthGraphQL tag if no tag provided
TAG="${1:-@AuthGraphQL}"

echo "🧪 Running auth-graphql integration tests with tag: $TAG"
echo "=================================================="

# Change to project root directory
cd "$(dirname "$0")"

# Run the cucumber tests with the specified tag
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js \
  test/integration/features/auth-graphql.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --tags "$TAG"

echo ""
echo "✅ Test run completed!"