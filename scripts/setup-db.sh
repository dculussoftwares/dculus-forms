#!/bin/bash

# Script to check and start MongoDB for Dculus Forms

echo "🔍 Checking Docker setup..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop:"
    echo "   - macOS: https://docs.docker.com/desktop/install/mac-install/"
    echo "   - Windows: https://docs.docker.com/desktop/install/windows-install/"
    echo "   - Linux: https://docs.docker.com/desktop/install/linux-install/"
    exit 1
fi

# Check if Docker is running
if ! docker ps &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    echo "   - macOS: Open Docker Desktop application"
    echo "   - Windows: Open Docker Desktop application"
    echo "   - Linux: Run 'sudo systemctl start docker'"
    exit 1
fi

echo "✅ Docker is available and running!"

# Check if MongoDB container is already running
if docker ps --format "table {{.Names}}" | grep -q "dculus-forms-mongodb"; then
    echo "✅ MongoDB is already running!"
else
    echo "🚀 Starting MongoDB and Mongo Express..."
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        echo "✅ MongoDB started successfully!"
        echo ""
        echo "📊 Services available:"
        echo "   - MongoDB: mongodb://admin:password123@localhost:27017/dculus_forms"
        echo "   - Mongo Express: http://localhost:8081 (admin/password123)"
        echo ""
        echo "🔧 Next steps:"
        echo "   1. Generate Prisma client: pnpm db:generate"
        echo "   2. Push database schema: pnpm db:push"
        echo "   3. Seed sample data: pnpm db:seed"
        echo "   4. Start backend: pnpm backend:dev"
    else
        echo "❌ Failed to start MongoDB. Check the error messages above."
        exit 1
    fi
fi
