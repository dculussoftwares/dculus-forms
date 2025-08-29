#!/bin/bash

# Test script for sidebar field drag-and-drop E2E tests
# This script provides easy commands to run specific sidebar field drag test scenarios

echo "🧪 Sidebar Field Drag & Drop E2E Test Runner"
echo "============================================="

# Base test command
BASE_CMD="TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
--require-module ts-node/register \
--require test/e2e/support/world.ts \
--require test/e2e/support/hooks.ts \
--require 'test/e2e/step-definitions/*.steps.ts'"

echo ""
echo "Available test scenarios:"
echo ""

# 1. All field types drag test
echo "1. Test dragging all field types from sidebar to page:"
echo "   $BASE_CMD --tags @FieldSidebarDrag --name \"Drag all field types from sidebar to Personal Information page\""
echo ""

# 2. Strategic field insertion test  
echo "2. Test dragging fields to specific positions:"
echo "   $BASE_CMD --tags @FieldInsertion --name \"Drag fields from sidebar to specific positions in Personal Information page\""
echo ""

# 3. Field persistence test
echo "3. Test field addition persistence after page refresh:"
echo "   $BASE_CMD --tags @FieldPersistence --name \"Verify persistence of fields added from sidebar after page refresh\""
echo ""

# 4. All sidebar field drag tests
echo "4. Run all sidebar field drag tests:"
echo "   $BASE_CMD --tags @FieldSidebarDrag"
echo ""

# 5. Dry run validation
echo "5. Validate all step definitions are implemented (dry run):"
echo "   $BASE_CMD --tags @FieldSidebarDrag --dry-run"
echo ""

# Interactive execution
echo "Choose a test to run:"
echo "[1] All field types drag test"
echo "[2] Strategic field insertion test"
echo "[3] Field persistence test"
echo "[4] All sidebar field drag tests"
echo "[5] Dry run validation"
echo "[q] Quit"
echo ""

read -p "Enter your choice (1-5 or q): " choice

case $choice in
    1)
        echo "🚀 Running: Drag all field types from sidebar to page..."
        eval "$BASE_CMD --tags @FieldSidebarDrag --name \"Drag all field types from sidebar to Personal Information page\""
        ;;
    2)
        echo "🚀 Running: Strategic field insertion test..."
        eval "$BASE_CMD --tags @FieldInsertion --name \"Drag fields from sidebar to specific positions in Personal Information page\""
        ;;
    3)
        echo "🚀 Running: Field persistence test..."
        eval "$BASE_CMD --tags @FieldPersistence --name \"Verify persistence of fields added from sidebar after page refresh\""
        ;;
    4)
        echo "🚀 Running: All sidebar field drag tests..."
        eval "$BASE_CMD --tags @FieldSidebarDrag"
        ;;
    5)
        echo "🔍 Running: Dry run validation..."
        eval "$BASE_CMD --tags @FieldSidebarDrag --dry-run"
        ;;
    q|Q)
        echo "👋 Exiting..."
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "✅ Test execution completed!"
echo ""

# Additional helpful commands
echo "💡 Additional useful commands:"
echo ""
echo "Run with headless browser disabled (visible browser):"
echo "PLAYWRIGHT_HEADLESS=false $BASE_CMD --tags @FieldSidebarDrag"
echo ""
echo "Run with services already running (skip service startup):"
echo "SERVICES_ALREADY_RUNNING=true $BASE_CMD --tags @FieldSidebarDrag"
echo ""
echo "Run specific scenario by name pattern:"
echo "$BASE_CMD --name \"Drag all field types\""
echo ""