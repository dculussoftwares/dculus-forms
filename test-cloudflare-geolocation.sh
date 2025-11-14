#!/bin/bash

# Test Cloudflare Geolocation Integration
# This script tests the debug endpoints with timeout protection

echo "🧪 Testing Cloudflare Geolocation Integration"
echo "=============================================="
echo ""

BASE_URL="http://localhost:4000"
TIMEOUT=5

# Function to test endpoint with timeout
test_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo "📍 Testing: $description"
    echo "   Endpoint: $endpoint"
    
    response=$(curl -s --max-time $TIMEOUT "$endpoint" 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "   ✅ Success"
        echo "$response" | jq . 2>/dev/null || echo "$response"
    elif [ $exit_code -eq 28 ]; then
        echo "   ❌ Timeout (server not responding)"
    elif [ $exit_code -eq 7 ]; then
        echo "   ❌ Connection refused (server not running)"
    else
        echo "   ❌ Failed (exit code: $exit_code)"
        echo "   $response"
    fi
    echo ""
}

# Test health endpoint first
test_endpoint "$BASE_URL/health" "Health Check"

# Test debug endpoints
test_endpoint "$BASE_URL/debug/cloudflare" "Cloudflare Geolocation Data"
test_endpoint "$BASE_URL/debug/headers" "Request Headers"

echo "=============================================="
echo "✅ Test completed"
