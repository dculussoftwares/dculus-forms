#!/bin/bash

echo "🧪 Testing Dculus Forms Production Backend Integration"
echo "======================================================"
echo ""

echo "🌐 Backend URL: https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io"
echo ""

echo "1️⃣ Running Health Check Tests..."
echo "--------------------------------"
pnpm test:integration:health
echo ""

echo "2️⃣ Running Authentication Tests..."
echo "----------------------------------"
pnpm test:integration:auth
echo ""

echo "✅ Production Backend Integration Tests Complete!"
echo ""
echo "💡 Available test commands:"
echo "   • Health only: pnpm test:integration:health"
echo "   • Auth only: pnpm test:integration:auth"
echo "   • All tests: pnpm test:integration:production"
echo ""
echo "📝 Note: Full test suite includes all integration features:"
echo "   • Health checks • Authentication • Admin features"
echo "   • Form lifecycle • Template authorization • Form responses"
echo "   • File uploads • GraphQL operations"