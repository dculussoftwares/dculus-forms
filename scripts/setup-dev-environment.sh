#!/bin/bash
set -e

echo "🚀 Setting up/Updating Dev Environment (R2 Hosting)..."

# Check for gh cli
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) could not be found. Please install it to use this script."
    exit 1
fi

# Get current commit SHA
COMMIT_SHA=$(git rev-parse HEAD)
echo "📍 Current Commit: $COMMIT_SHA"

# Trigger Workflow
echo "🔄 Triggering Multi-Cloud Deployment for 'dev'..."
gh workflow run multi-cloud-deployment.yml \
  -f environment=dev \
  -f deploy_cloudflare=true \
  -f deploy_azure=true \
  -f deploy_mongodb=false \
  -f deploy_postgres=false \
  -f release_tag=$COMMIT_SHA

echo "✅ Deployment triggered successfully!"
echo "👀 Watch progress: gh run list --workflow=multi-cloud-deployment.yml"
echo "🌐 Once finished, your apps will be available at your R2 bucket endpoints."
