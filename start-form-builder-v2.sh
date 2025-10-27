#!/bin/bash

# Collaborative Form Builder V2 - Development Setup Script
# This script builds all dependencies and starts the development server

set -e  # Exit on error

echo "🚀 Collaborative Form Builder V2 - Setup & Start"
echo "================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Please run this script from the repository root"
  exit 1
fi

# Build shared packages
echo "📦 Building shared packages..."
echo ""

echo "  Building @dculus/types..."
pnpm --filter @dculus/types build

echo "  Building @dculus/ui..."
pnpm --filter @dculus/ui build

echo "  Building @dculus/utils..."
pnpm --filter @dculus/utils build

echo "  Building @dculus/ui-v2..."
pnpm --filter @dculus/ui-v2 build

echo ""
echo "✅ All packages built successfully!"
echo ""

# Start form-app-v2
echo "🎨 Starting form-app-v2 development server..."
echo ""
echo "📍 Server will be available at: http://localhost:3001"
echo "📍 Make sure backend is running on: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

pnpm --filter form-app-v2 dev
