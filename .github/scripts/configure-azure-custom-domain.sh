#!/bin/bash

# Azure Custom Domain and Certificate Configuration Script
# This script configures custom domain and managed certificate for Azure Container Apps
# with Cloudflare DNS integration

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

print_info "Starting custom domain configuration for ${CONTAINER_APP_NAME}"
print_info "Custom domain: ${CUSTOM_DOMAIN}"

# Step 1: Get Azure domain verification ID
print_info "Step 1: Getting Azure domain verification ID..."
VERIFICATION_ID=$(az containerapp show \
    --name "${CONTAINER_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "properties.customDomainVerificationId" \
    --output tsv)

if [ -z "$VERIFICATION_ID" ]; then
    print_error "Failed to get domain verification ID"
    exit 1
fi

print_info "Verification ID: ${VERIFICATION_ID}"

# Step 2: Check if TXT record exists
print_info "Step 2: Checking for existing TXT record..."
TXT_RECORD_NAME="asuid.${CUSTOM_DOMAIN}"

# Get existing DNS record ID if it exists
EXISTING_RECORD_ID=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?type=TXT&name=${TXT_RECORD_NAME}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

if [ -n "$EXISTING_RECORD_ID" ]; then
    print_warning "TXT record already exists (ID: ${EXISTING_RECORD_ID}), updating..."

    # Update existing record
    RESPONSE=$(curl -s -X PUT \
        "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${EXISTING_RECORD_ID}" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"TXT\",
            \"name\": \"${TXT_RECORD_NAME}\",
            \"content\": \"${VERIFICATION_ID}\",
            \"ttl\": 120,
            \"proxied\": false
        }")
else
    print_info "Creating new TXT record..."

    # Create new TXT record
    RESPONSE=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"TXT\",
            \"name\": \"${TXT_RECORD_NAME}\",
            \"content\": \"${VERIFICATION_ID}\",
            \"ttl\": 120,
            \"proxied\": false
        }")
fi

# Check if the API call was successful
if ! echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_error "Failed to create/update TXT record"
    echo "$RESPONSE" | jq '.errors'
    exit 1
fi

print_info "TXT record created/updated successfully"

# Step 3: Wait for DNS propagation
print_info "Step 3: Waiting for DNS propagation (15 seconds)..."
sleep 15

# Verify TXT record
print_info "Verifying TXT record..."
TXT_VALUE=$(dig +short TXT "${TXT_RECORD_NAME}" | tr -d '"' || true)
if [ "$TXT_VALUE" == "$VERIFICATION_ID" ]; then
    print_info "TXT record verified successfully"
else
    print_warning "TXT record not yet propagated (found: ${TXT_VALUE}), but continuing..."
fi

# Step 4: Add custom hostname to Container App
print_info "Step 4: Adding custom hostname to Container App..."

# Check if hostname already exists
EXISTING_HOSTNAME=$(az containerapp hostname list \
    --name "${CONTAINER_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --output json | jq -r --arg domain "${CUSTOM_DOMAIN}" '.[] | select(.name == $domain) | .name')

if [ -n "$EXISTING_HOSTNAME" ]; then
    print_warning "Hostname ${CUSTOM_DOMAIN} already exists on Container App"
else
    print_info "Adding hostname ${CUSTOM_DOMAIN}..."
    az containerapp hostname add \
        --hostname "${CUSTOM_DOMAIN}" \
        --name "${CONTAINER_APP_NAME}" \
        --resource-group "${RESOURCE_GROUP}" \
        --output none || {
            print_error "Failed to add custom hostname"
            exit 1
        }
    print_info "Hostname added successfully"
fi

# Step 5: Get Cloudflare proxy record ID
print_info "Step 5: Preparing for certificate validation..."

CNAME_RECORD_ID=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?type=CNAME&name=${CUSTOM_DOMAIN}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

if [ -z "$CNAME_RECORD_ID" ]; then
    print_error "CNAME record for ${CUSTOM_DOMAIN} not found"
    exit 1
fi

# Get current proxy status
CURRENT_PROXY_STATUS=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${CNAME_RECORD_ID}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" | jq -r '.result.proxied')

print_info "Current Cloudflare proxy status: ${CURRENT_PROXY_STATUS}"

# Step 6: Temporarily disable Cloudflare proxy for certificate validation
if [ "$CURRENT_PROXY_STATUS" == "true" ]; then
    print_info "Step 6: Temporarily disabling Cloudflare proxy for certificate validation..."

    BACKEND_FQDN=$(az containerapp show \
        --name "${CONTAINER_APP_NAME}" \
        --resource-group "${RESOURCE_GROUP}" \
        --query "properties.configuration.ingress.fqdn" \
        --output tsv)

    RESPONSE=$(curl -s -X PATCH \
        "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${CNAME_RECORD_ID}" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"proxied\": false}")

    if ! echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
        print_error "Failed to disable Cloudflare proxy"
        echo "$RESPONSE" | jq '.errors'
        exit 1
    fi

    print_info "Cloudflare proxy disabled"
    print_info "Waiting 30 seconds for DNS propagation..."
    sleep 30
else
    print_info "Step 6: Cloudflare proxy already disabled"
fi

# Step 7: Create managed certificate
print_info "Step 7: Creating managed certificate..."

# Check if certificate already exists
CERT_EXISTS=$(az containerapp env certificate list \
    --name "${CONTAINER_ENV_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --managed-certificates-only \
    --output json 2>/dev/null | jq -r --arg domain "${CUSTOM_DOMAIN}" '.[] | select(.properties.subjectName == $domain) | .name' || echo "")

if [ -n "$CERT_EXISTS" ]; then
    print_warning "Managed certificate already exists: ${CERT_EXISTS}"
    CERT_NAME="${CERT_EXISTS}"
else
    CERT_NAME="mc-$(echo ${CUSTOM_DOMAIN} | tr '.' '-')"

    print_info "Creating new managed certificate: ${CERT_NAME}"
    print_warning "This may take up to 15 minutes..."

    az containerapp env certificate create \
        --name "${CONTAINER_ENV_NAME}" \
        --resource-group "${RESOURCE_GROUP}" \
        --hostname "${CUSTOM_DOMAIN}" \
        --certificate-name "${CERT_NAME}" \
        --validation-method HTTP \
        --output none || {
            print_error "Failed to create managed certificate"
            # Re-enable Cloudflare proxy before exiting
            if [ "$CURRENT_PROXY_STATUS" == "true" ]; then
                print_info "Re-enabling Cloudflare proxy..."
                curl -s -X PATCH \
                    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${CNAME_RECORD_ID}" \
                    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
                    -H "Content-Type: application/json" \
                    -d '{"proxied": true}' > /dev/null
            fi
            exit 1
        }

    print_info "Managed certificate created successfully"
fi

# Step 7.5: Wait for certificate provisioning
print_info "Step 7.5: Waiting for certificate to be provisioned..."
MAX_WAIT=300  # 5 minutes
WAIT_INTERVAL=15
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    CERT_STATE=$(az containerapp env certificate list \
        --name "${CONTAINER_ENV_NAME}" \
        --resource-group "${RESOURCE_GROUP}" \
        --managed-certificates-only \
        --output json 2>/dev/null | jq -r --arg domain "${CUSTOM_DOMAIN}" '.[] | select(.properties.subjectName == $domain) | .properties.provisioningState' || echo "")

    if [ "$CERT_STATE" == "Succeeded" ]; then
        print_info "Certificate provisioned successfully!"
        break
    elif [ "$CERT_STATE" == "Failed" ]; then
        print_error "Certificate provisioning failed"
        # Re-enable Cloudflare proxy before exiting
        if [ "$CURRENT_PROXY_STATUS" == "true" ]; then
            print_info "Re-enabling Cloudflare proxy..."
            curl -s -X PATCH \
                "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${CNAME_RECORD_ID}" \
                -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
                -H "Content-Type: application/json" \
                -d '{"proxied": true}' > /dev/null
        fi
        exit 1
    else
        print_info "Certificate state: ${CERT_STATE:-Unknown}. Waiting ${WAIT_INTERVAL}s... (${ELAPSED}s/${MAX_WAIT}s)"
        sleep $WAIT_INTERVAL
        ELAPSED=$((ELAPSED + WAIT_INTERVAL))
    fi
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    print_warning "Certificate provisioning timeout. Current state: ${CERT_STATE}"
    print_warning "Continuing anyway - certificate may complete in background"
fi

# Step 8: Bind certificate to hostname
print_info "Step 8: Binding certificate to hostname..."

CERT_ID=$(az containerapp env certificate list \
    --name "${CONTAINER_ENV_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --managed-certificates-only \
    --output json | jq -r --arg domain "${CUSTOM_DOMAIN}" '.[] | select(.properties.subjectName == $domain) | .id')

if [ -z "$CERT_ID" ]; then
    print_error "Certificate not found after creation"
    exit 1
fi

print_info "Certificate ID: ${CERT_ID}"

# Update hostname binding with certificate
az containerapp hostname bind \
    --hostname "${CUSTOM_DOMAIN}" \
    --name "${CONTAINER_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --environment "${CONTAINER_ENV_NAME}" \
    --certificate "${CERT_ID}" \
    --output none || {
        print_error "Failed to bind certificate to hostname"
        exit 1
    }

print_info "Certificate bound successfully"

# Step 9: Re-enable Cloudflare proxy
if [ "$CURRENT_PROXY_STATUS" == "true" ]; then
    print_info "Step 9: Re-enabling Cloudflare proxy..."

    RESPONSE=$(curl -s -X PATCH \
        "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${CNAME_RECORD_ID}" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"proxied": true}')

    if ! echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
        print_warning "Failed to re-enable Cloudflare proxy (non-fatal)"
        echo "$RESPONSE" | jq '.errors'
    else
        print_info "Cloudflare proxy re-enabled"
    fi
else
    print_info "Step 9: Skipping proxy re-enable (was not enabled initially)"
fi

# Step 10: Verify configuration
print_info "Step 10: Verifying configuration..."

BINDING_STATUS=$(az containerapp hostname list \
    --name "${CONTAINER_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --output json | jq -r --arg domain "${CUSTOM_DOMAIN}" '.[] | select(.name == $domain) | .bindingType')

if [ "$BINDING_STATUS" == "SniEnabled" ]; then
    print_info "✅ Custom domain configured successfully!"
    print_info "Domain: ${CUSTOM_DOMAIN}"
    print_info "Binding: ${BINDING_STATUS}"

    # Wait for DNS propagation
    print_info "Waiting 30 seconds for final DNS propagation..."
    sleep 30

    # Test the endpoint
    print_info "Testing HTTPS endpoint..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${CUSTOM_DOMAIN}/health" || echo "000")

    if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "404" ]; then
        print_info "✅ HTTPS endpoint is accessible (HTTP ${HTTP_CODE})"
    else
        print_warning "⚠️  HTTPS endpoint returned HTTP ${HTTP_CODE} (may need more time to propagate)"
    fi
else
    print_warning "Custom domain configured but binding status is: ${BINDING_STATUS}"
    print_warning "This may require manual intervention"
fi

print_info "==================== Configuration Complete ===================="
