#!/bin/bash
# Script to import existing Cloudflare DNS records into Terraform state
# This prevents "record already exists" errors during deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking for existing DNS records that need to be imported..."

# Required environment variables
ZONE_ID="${TF_VAR_cloudflare_zone_id:-${CLOUDFLARE_ZONE_ID}}"
ENVIRONMENT="${1:-dev}"

if [ -z "$ZONE_ID" ]; then
    echo -e "${RED}❌ Error: CLOUDFLARE_ZONE_ID or TF_VAR_cloudflare_zone_id environment variable is required${NC}"
    exit 1
fi

# DNS record name to check
DNS_RECORD_NAME="public-cdn-${ENVIRONMENT}.dculus.com"

echo "📋 Environment: $ENVIRONMENT"
echo "📋 Zone ID: $ZONE_ID"
echo "📋 DNS Record: $DNS_RECORD_NAME"
echo ""

# Check if the DNS record already exists in Cloudflare
echo "🔎 Checking if DNS record exists in Cloudflare..."

# Use Cloudflare API to check for existing record
RECORD_CHECK=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${DNS_RECORD_NAME}&type=CNAME" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json")

RECORD_ID=$(echo "$RECORD_CHECK" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$RECORD_ID" ]; then
    echo -e "${GREEN}✅ DNS record does not exist in Cloudflare - Terraform will create it${NC}"
    exit 0
fi

echo -e "${YELLOW}⚠️  DNS record already exists in Cloudflare (ID: $RECORD_ID)${NC}"

# Check if the record is already in Terraform state
echo "🔎 Checking if DNS record exists in Terraform state..."

if terraform state show "cloudflare_dns_record.public_cdn" &>/dev/null; then
    echo -e "${GREEN}✅ DNS record is already in Terraform state - no import needed${NC}"
    exit 0
fi

echo -e "${YELLOW}📥 Importing existing DNS record into Terraform state...${NC}"

# Import the record
if terraform import "cloudflare_dns_record.public_cdn" "${ZONE_ID}/${RECORD_ID}"; then
    echo -e "${GREEN}✅ Successfully imported DNS record into Terraform state${NC}"
    echo -e "${GREEN}✅ Terraform can now manage this record${NC}"
else
    echo -e "${RED}❌ Failed to import DNS record${NC}"
    echo -e "${YELLOW}💡 Manual steps:${NC}"
    echo -e "   1. Delete the DNS record from Cloudflare dashboard: https://dash.cloudflare.com/"
    echo -e "   2. Run: terraform import cloudflare_dns_record.public_cdn ${ZONE_ID}/${RECORD_ID}"
    exit 1
fi
