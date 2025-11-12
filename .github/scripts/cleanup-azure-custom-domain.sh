#!/bin/bash

# Azure Custom Domain and Certificate Cleanup Script
# Removes custom domain, managed certificate, and DNS records before infrastructure destruction

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Required environment variables
REQUIRED_VARS=(
    "ENVIRONMENT"
    "RESOURCE_GROUP"
    "CONTAINER_APP_NAME"
    "CONTAINER_ENV_NAME"
    "CUSTOM_DOMAIN"
    "CLOUDFLARE_ZONE_ID"
    "CLOUDFLARE_API_TOKEN"
)

# Validate required environment variables
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Required environment variable $var is not set"
        exit 1
    fi
done

print_info "Starting custom domain cleanup for ${CONTAINER_APP_NAME}"
print_info "Custom domain: ${CUSTOM_DOMAIN}"

# Step 1: Check if custom domain exists
print_info "Step 1: Checking if custom domain exists..."

HOSTNAME_EXISTS=$(az containerapp hostname list \
    --name "${CONTAINER_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --output json 2>/dev/null | jq -r --arg domain "${CUSTOM_DOMAIN}" '.[] | select(.name == $domain) | .name' || echo "")

if [ -z "$HOSTNAME_EXISTS" ]; then
    print_info "Custom domain ${CUSTOM_DOMAIN} not found on Container App - nothing to clean"
else
    print_info "Found custom domain: ${CUSTOM_DOMAIN}"

    # Step 2: Remove custom hostname binding
    print_info "Step 2: Removing custom hostname from Container App..."

    az containerapp hostname delete \
        --hostname "${CUSTOM_DOMAIN}" \
        --name "${CONTAINER_APP_NAME}" \
        --resource-group "${RESOURCE_GROUP}" \
        --yes \
        --output none || {
            print_warning "Failed to remove hostname (may already be deleted)"
        }

    print_info "Custom hostname removed"
fi

# Step 3: Check and delete managed certificate
print_info "Step 3: Checking for managed certificate..."

CERT_NAME=$(az containerapp env certificate list \
    --name "${CONTAINER_ENV_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --managed-certificates-only \
    --output json 2>/dev/null | jq -r --arg domain "${CUSTOM_DOMAIN}" '.[] | select(.properties.subjectName == $domain) | .name' || echo "")

if [ -z "$CERT_NAME" ]; then
    print_info "No managed certificate found for ${CUSTOM_DOMAIN}"
else
    print_info "Found managed certificate: ${CERT_NAME}"
    print_info "Deleting managed certificate..."

    az containerapp env certificate delete \
        --name "${CERT_NAME}" \
        --environment "${CONTAINER_ENV_NAME}" \
        --resource-group "${RESOURCE_GROUP}" \
        --yes \
        --output none || {
            print_warning "Failed to delete certificate (may already be deleted)"
        }

    print_info "Managed certificate deleted"
fi

# Step 4: Remove Cloudflare TXT verification record
print_info "Step 4: Checking for Cloudflare TXT verification record..."

TXT_RECORD_NAME="asuid.${CUSTOM_DOMAIN}"

TXT_RECORD_ID=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?type=TXT&name=${TXT_RECORD_NAME}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

if [ -z "$TXT_RECORD_ID" ]; then
    print_info "TXT verification record not found (may already be deleted)"
else
    print_info "Found TXT record: ${TXT_RECORD_NAME} (ID: ${TXT_RECORD_ID})"
    print_info "Deleting TXT record..."

    RESPONSE=$(curl -s -X DELETE \
        "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${TXT_RECORD_ID}" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json")

    if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
        print_info "TXT verification record deleted"
    else
        print_warning "Failed to delete TXT record (non-fatal)"
        echo "$RESPONSE" | jq '.errors'
    fi
fi

# Step 5: Summary
print_info "==================== Cleanup Complete ===================="
print_info "Custom Domain: ${CUSTOM_DOMAIN}"
print_info "✅ Hostname binding removed"
print_info "✅ Managed certificate deleted"
print_info "✅ TXT verification record removed"
print_info ""
print_info "Note: CNAME record (${CUSTOM_DOMAIN}) will be removed by Terraform"
print_info "================================================================"

exit 0
