#!/bin/bash
set -e

# Import existing Cloudflare R2 buckets into Terraform state
# This script helps resolve "bucket already exists" errors

ENV="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Cloudflare R2 Bucket Import Script${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Check if environment is valid
if [[ ! "$ENV" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment. Must be dev, staging, or production${NC}"
    echo "Usage: $0 [dev|staging|production]"
    exit 1
fi

# Check for required environment variables
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo -e "${RED}Error: CLOUDFLARE_ACCOUNT_ID environment variable not set${NC}"
    echo "Please set it with: export CLOUDFLARE_ACCOUNT_ID=your-account-id"
    exit 1
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${RED}Error: CLOUDFLARE_API_TOKEN environment variable not set${NC}"
    echo "Please set it with: export CLOUDFLARE_API_TOKEN=your-api-token"
    exit 1
fi

echo -e "${GREEN}Environment:${NC} $ENV"
echo -e "${GREEN}Account ID:${NC} $CLOUDFLARE_ACCOUNT_ID"
echo ""

# Navigate to environment directory
ENV_DIR="$SCRIPT_DIR/environments/$ENV"
cd "$ENV_DIR"

echo -e "${YELLOW}Working directory:${NC} $ENV_DIR"
echo ""

# Copy shared Terraform files
echo -e "${YELLOW}📋 Copying shared Terraform files...${NC}"
cp ../../main.tf .
cp ../../variables.tf .
cp ../../r2-buckets.tf .
cp ../../outputs.tf .
echo -e "${GREEN}✅ Files copied${NC}"
echo ""

# Initialize Terraform
echo -e "${YELLOW}🔧 Initializing Terraform...${NC}"
terraform init \
    -backend-config="resource_group_name=dculus-global-terraform-assets-resource-grp" \
    -backend-config="storage_account_name=dculusterraformstates" \
    -backend-config="container_name=dculus-forms-cloudflare-r2-${ENV}-state" \
    -backend-config="key=terraform.tfstate"
echo ""

# Bucket names
PRIVATE_BUCKET="dculus-forms-private-${ENV}"
PUBLIC_BUCKET="dculus-forms-public-${ENV}"

echo -e "${YELLOW}📦 Checking if buckets exist in Terraform state...${NC}"

# Check if private bucket is already in state
if terraform state show cloudflare_r2_bucket.private &>/dev/null; then
    echo -e "${GREEN}✅ Private bucket already in state: $PRIVATE_BUCKET${NC}"
else
    echo -e "${YELLOW}📥 Importing private bucket: $PRIVATE_BUCKET${NC}"
    terraform import \
        -var="cloudflare_account_id=$CLOUDFLARE_ACCOUNT_ID" \
        -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
        cloudflare_r2_bucket.private \
        "$PRIVATE_BUCKET"
    echo -e "${GREEN}✅ Private bucket imported successfully${NC}"
fi

echo ""

# Check if public bucket is already in state
if terraform state show cloudflare_r2_bucket.public &>/dev/null; then
    echo -e "${GREEN}✅ Public bucket already in state: $PUBLIC_BUCKET${NC}"
else
    echo -e "${YELLOW}📥 Importing public bucket: $PUBLIC_BUCKET${NC}"
    terraform import \
        -var="cloudflare_account_id=$CLOUDFLARE_ACCOUNT_ID" \
        -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
        cloudflare_r2_bucket.public \
        "$PUBLIC_BUCKET"
    echo -e "${GREEN}✅ Public bucket imported successfully${NC}"
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}✅ Import completed successfully!${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Verify import
echo -e "${YELLOW}🔍 Verifying Terraform state...${NC}"
terraform state list

echo ""
echo -e "${YELLOW}📋 Running terraform plan to check for any drift...${NC}"
terraform plan \
    -var="cloudflare_account_id=$CLOUDFLARE_ACCOUNT_ID" \
    -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Import process complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "1. Review the plan output above"
echo -e "2. If there are no changes needed, the import was successful"
echo -e "3. If there are changes, apply them with: ${YELLOW}terraform apply${NC}"
echo -e "4. Re-run the GitHub Actions workflow"
echo ""
