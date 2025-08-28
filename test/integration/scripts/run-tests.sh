#!/bin/bash

# Integration test runner script
echo "🧪 Starting Integration Tests..."

# Set environment variables
export NODE_ENV=test
export TEST_BASE_URL=http://localhost:4000

# Run cucumber tests
npx cucumber-js --config test/integration/cucumber.js test/integration/features

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All integration tests passed!"
else
  echo "❌ Some integration tests failed!"
fi

exit $EXIT_CODE