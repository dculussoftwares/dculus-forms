#!/bin/bash

# Organization Security Test Runner
# Tests the setActiveOrganization security fixes

set -e

echo "🔒 Running Organization Security Tests"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if backend is running
print_status "Checking if backend is running..."
if ! curl -s http://localhost:4000/graphql >/dev/null; then
    print_error "Backend is not running on localhost:4000"
    print_warning "Please start the backend with: pnpm dev"
    exit 1
fi

print_status "Backend is running ✓"

# Run the organization security tests
print_status "Running organization security tests..."

# Test the basic membership verification
print_status "Testing: User can access their own organization"
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js test/integration/features/organization-security.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --name "User can set active organization they belong to"

print_status "Testing: User cannot access other organization"
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js test/integration/features/organization-security.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --name "User cannot set active organization they don't belong to"

print_status "Testing: Unauthenticated access is blocked"
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js test/integration/features/organization-security.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --name "Unauthenticated user cannot set active organization"

print_status "Testing: Nonexistent organization access is blocked"
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js test/integration/features/organization-security.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --name "User cannot set active organization that doesn't exist"

print_status "Testing: Invalid token is rejected"
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js test/integration/features/organization-security.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --name "Invalid token prevents setting active organization"

# Run all security tests with tags
print_status "Running all organization security tests with @Security tag..."
TS_NODE_PROJECT=test/integration/tsconfig.json cucumber-js test/integration/features/organization-security.feature \
  --require-module ts-node/register \
  --require test/integration/support/world.ts \
  --require test/integration/support/hooks.ts \
  --require test/integration/step-definitions/common.steps.ts \
  --require 'test/integration/step-definitions/*.steps.ts' \
  --tags '@Security'

print_status "🎉 All organization security tests completed successfully!"
print_status ""
print_status "Security fixes verified:"
print_status "✓ setActiveOrganization now requires organization membership"
print_status "✓ Unauthenticated access is properly blocked"
print_status "✓ Invalid tokens are rejected"
print_status "✓ Nonexistent organizations are handled securely"
print_status "✓ Error messages don't expose sensitive information"