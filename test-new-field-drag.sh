#!/bin/bash

# Quick test for newly dragged field settings
# This script tests if newly dragged fields from sidebar work correctly with field settings

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo "🧪 Testing Newly Dragged Field Settings"
echo "======================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

cd "$PROJECT_ROOT"

print_info "Running type check to ensure our fix doesn't break anything..."
if pnpm type-check; then
    print_success "Type check passed"
else
    print_error "Type check failed"
    exit 1
fi

print_info "Testing field creation and settings with specific focus on newly dragged fields..."

# Run a focused test on character limits for new fields
export PLAYWRIGHT_HEADLESS="true"
export SERVICES_ALREADY_RUNNING="true"

TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/short-text-field-properties.feature \
    --require-module ts-node/register \
    --require test/e2e/support/world.ts \
    --require test/e2e/support/hooks.ts \
    --require 'test/e2e/step-definitions/*.steps.ts' \
    --tags '@CharacterLimits' \
    --name "Configure character limits for Short Text field"

if [[ $? -eq 0 ]]; then
    print_success "New field drag and settings test passed!"
    print_info "Field settings changes are now properly reflected for both existing and newly dragged fields."
else
    print_error "Test failed - there may still be issues with newly dragged field settings"
    exit 1
fi

print_success "Fix verified! Newly dragged fields now properly support field settings updates."