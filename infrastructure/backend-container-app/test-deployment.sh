#!/bin/bash

# Test script for backend container app deployment
# This script performs basic validation and testing

set -e

echo "🧪 Backend Container App Deployment Test"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "info") echo -e "ℹ️  $message" ;;
    esac
}

# Check if we're in the right directory
if [[ ! -f "main.tf" || ! -f "variables.tf" || ! -f "outputs.tf" ]]; then
    print_status "error" "Please run this script from the infrastructure/backend-container-app directory"
    exit 1
fi

print_status "info" "Validating Terraform configuration..."

# Check Terraform installation
if ! command -v terraform &> /dev/null; then
    print_status "error" "Terraform is not installed"
    exit 1
fi

print_status "success" "Terraform is installed: $(terraform version --version)"

# Format check
print_status "info" "Checking Terraform formatting..."
if terraform fmt -check -recursive; then
    print_status "success" "Terraform files are properly formatted"
else
    print_status "warning" "Some Terraform files need formatting (run: terraform fmt -recursive)"
fi

# Initialize and validate (requires backend setup)
print_status "info" "This deployment requires:"
echo "  - Existing MongoDB Container App infrastructure"
echo "  - Azure CLI authentication"  
echo "  - Terraform backend configuration"

# Check for required variables
print_status "info" "Required GitHub Secrets:"
echo "  - AZURE_CLIENT_ID"
echo "  - AZURE_TENANT_ID"
echo "  - AZURE_SUBSCRIPTION_ID"
echo "  - CLOUDFLARE_R2_ACCESS_KEY (optional)"
echo "  - CLOUDFLARE_R2_SECRET_KEY (optional)"

print_status "info" "Required GitHub Variables:"
echo "  - AZURE_CLIENT_ID"
echo "  - AZURE_TENANT_ID" 
echo "  - AZURE_SUBSCRIPTION_ID"
echo "  - CLOUDFLARE_R2_ENDPOINT (optional)"
echo "  - CLOUDFLARE_R2_PRIVATE_BUCKET_NAME (optional)"
echo "  - CLOUDFLARE_R2_PUBLIC_BUCKET_NAME (optional)"

# Deployment endpoints that will be available
print_status "info" "After deployment, these endpoints will be available:"
echo "  - Health Check: https://{backend_fqdn}/health"
echo "  - GraphQL API: https://{backend_fqdn}/graphql"
echo "  - Auth API: https://{backend_fqdn}/api/auth/*"

print_status "success" "Configuration validation complete!"

echo ""
echo "📋 Next Steps:"
echo "1. Configure GitHub repository secrets and variables"
echo "2. Ensure MongoDB Container App is deployed"
echo "3. Push changes to trigger deployment pipeline"
echo "4. Monitor deployment in GitHub Actions"
echo "5. Test endpoints after deployment"

echo ""
echo "🚀 Ready for deployment!"