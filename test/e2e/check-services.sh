#!/bin/bash

# Quick script to check if services are running
echo "🔍 Checking if services are running..."

echo "📍 Checking Backend (port 4000)..."
if curl -f -s http://localhost:4000/health > /dev/null; then
  echo "✅ Backend is running and healthy"
  curl -s http://localhost:4000/health | head -1
else
  echo "❌ Backend is NOT running on port 4000"
  echo "   Start with: pnpm backend:dev"
fi

echo ""
echo "📍 Checking Frontend (port 3000)..."
if curl -f -s http://localhost:3000 > /dev/null; then
  echo "✅ Frontend is running"
  echo "   Response: $(curl -s http://localhost:3000 | head -1 | cut -c1-50)..."
else
  echo "❌ Frontend is NOT running on port 3000"  
  echo "   Start with: pnpm form-app:dev"
fi

echo ""
echo "📋 Process check:"
echo "Backend processes:"
lsof -i :4000 2>/dev/null || echo "   No processes found on port 4000"

echo "Frontend processes:"
lsof -i :3000 2>/dev/null || echo "   No processes found on port 3000"

echo ""
if curl -f -s http://localhost:4000/health > /dev/null && curl -f -s http://localhost:3000 > /dev/null; then
  echo "🎉 Both services are running! You can now run: pnpm test:e2e:dev"
else
  echo "⚠️  One or more services are not running. Please start them first:"
  echo "   Terminal 1: pnpm backend:dev"
  echo "   Terminal 2: pnpm form-app:dev" 
  echo "   Terminal 3: pnpm test:e2e:dev"
fi