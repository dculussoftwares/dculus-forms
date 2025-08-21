#!/bin/bash

# Local E2E Test Runner
# This script starts the required services and runs e2e tests locally

set -e

echo "🔧 Setting up local E2E test environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start MongoDB if not already running
echo "📦 Starting MongoDB..."
pnpm docker:up

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
sleep 5

# Setup database
echo "🗄️  Setting up database..."
pnpm db:generate
pnpm db:push

# Install playwright if needed
if [ ! -d "node_modules/@playwright/test" ]; then
    echo "🎭 Installing Playwright..."
    pnpm exec playwright install --with-deps
fi

# Set environment variables for testing
export DATABASE_URL="mongodb://admin:password123@localhost:27017/dculus_forms_test?authSource=admin"
export JWT_SECRET="test-jwt-secret-for-local-testing"
export BETTER_AUTH_SECRET="test-auth-secret-for-local-testing-32-chars"
export BETTER_AUTH_URL="http://localhost:4000"
export NODE_ENV="test"

echo "🧪 Running E2E tests..."

# Run the tests
pnpm test:e2e

echo "✅ E2E tests completed!"