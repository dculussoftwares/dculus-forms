#!/bin/bash

echo "🚀 Starting Collaborative Form Builder Test"

# Start the backend server in the background
echo "📡 Starting backend server..."
cd /Users/natheeshkumarrangasamy/Desktop/DculusIndustries/dculus-forms/apps/backend
pnpm dev &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 10

# Start the frontend in the background
echo "🌐 Starting frontend app..."
cd /Users/natheeshkumarrangasamy/Desktop/DculusIndustries/dculus-forms/apps/form-app
pnpm dev &
FRONTEND_PID=$!

echo "✅ Both servers are starting..."
echo "🎯 Backend running on: http://localhost:4000"
echo "🌐 Frontend running on: http://localhost:5173"
echo "🤝 Collaboration WebSocket: ws://localhost:4000/collaboration"
echo ""
echo "To test collaboration:"
echo "1. Open http://localhost:5173 in two different browsers"
echo "2. Login and navigate to a form builder"
echo "3. Make changes in one browser"
echo "4. Watch real-time updates in the other browser"
echo ""
echo "Press Ctrl+C to stop all servers"

# Function to cleanup background processes
cleanup() {
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user interrupt
wait
