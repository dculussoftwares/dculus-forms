#!/bin/bash

# Script to run template authorization tests
# Usage: ./test-template-authorization.sh

echo "🧪 Running Template Authorization Tests..."
echo "=========================================="

# Set the TypeScript configuration for integration tests
export TS_NODE_PROJECT=test/integration/tsconfig.json

# Run the template authorization tests using the @TemplateAuthorization tag
cucumber-js test/integration/features/template-authorization.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --tags '@TemplateAuthorization'

# Check if tests passed
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All template authorization tests passed!"
else
  echo ""
  echo "❌ Some template authorization tests failed!"
  exit 1
fi