#!/bin/bash

# Basic Short Text Field Properties Test
# Test the most essential functionality that should work reliably

set -e

echo "🧪 Testing Basic Short Text Field Properties"
echo "============================================"

# Run just the basic functionality test
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/short-text-field-properties.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags '@BasicSettings' \
  --name "Configure basic Short Text field properties"

echo ""
echo "✅ Basic field properties test completed!"