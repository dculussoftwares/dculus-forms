#!/bin/bash

set -e

# Function to kill all background processes on exit
cleanup() {
  echo "Stopping all services..."
  kill $(jobs -p) 2>/dev/null
}

trap cleanup EXIT

echo "Building Backend..."
pnpm --filter backend build

echo "Building Form App..."
pnpm --filter form-app build

echo "Building Form Viewer..."
pnpm --filter form-viewer build

echo "Building Admin App..."
pnpm --filter admin-app build

echo "Starting Backend..."
pnpm --filter backend start &

echo "Starting Form App (Preview)..."
pnpm --filter form-app preview --port 4173 --strictPort &

echo "Starting Form Viewer (Preview)..."
pnpm --filter form-viewer preview --port 4174 --strictPort &

echo "Starting Admin App (Preview)..."
pnpm --filter admin-app preview --port 4175 --strictPort &

echo "All services started. Press Ctrl+C to stop."
wait
