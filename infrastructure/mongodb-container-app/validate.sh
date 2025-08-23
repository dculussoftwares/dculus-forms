#!/bin/bash

# MongoDB Infrastructure Validation Script
# This script validates the deployed MongoDB infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR"

# Function to check if Terraform outputs exist
check_terraform_outputs() {
    print_info "Checking Terraform outputs..."
    
    cd "$TERRAFORM_DIR"
    
    if [ ! -f ".terraform/terraform.tfstate" ] && [ ! -f "terraform.tfstate" ]; then
        print_error "Terraform state not found. Please deploy the infrastructure first."
        exit 1
    fi
    
    # Get outputs
    RESOURCE_GROUP=$(terraform output -raw resource_group_name 2>/dev/null || echo "")
    MONGODB_FQDN=$(terraform output -raw mongodb_fqdn 2>/dev/null || echo "")
    KEY_VAULT_NAME=$(terraform output -raw key_vault_name 2>/dev/null || echo "")
    
    if [ -z "$RESOURCE_GROUP" ] || [ -z "$MONGODB_FQDN" ] || [ -z "$KEY_VAULT_NAME" ]; then
        print_error "Failed to retrieve Terraform outputs"
        exit 1
    fi
    
    print_success "Terraform outputs retrieved successfully"
}

# Function to validate Azure resources
validate_azure_resources() {
    print_info "Validating Azure resources..."
    
    # Check resource group
    print_info "Checking resource group: $RESOURCE_GROUP"
    if az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
        print_success "Resource group exists"
    else
        print_error "Resource group not found"
        return 1
    fi
    
    # Check container app
    print_info "Checking MongoDB container app..."
    local app_name=$(az containerapp list --resource-group "$RESOURCE_GROUP" --query "[?contains(name, 'mongodb')].name" -o tsv)
    if [ -n "$app_name" ]; then
        print_success "Container app found: $app_name"
        
        # Check container app status
        local app_status=$(az containerapp show --name "$app_name" --resource-group "$RESOURCE_GROUP" --query "properties.provisioningState" -o tsv)
        if [ "$app_status" = "Succeeded" ]; then
            print_success "Container app is running"
        else
            print_warning "Container app status: $app_status"
        fi
    else
        print_error "MongoDB container app not found"
        return 1
    fi
    
    # Check Key Vault
    print_info "Checking Key Vault: $KEY_VAULT_NAME"
    if az keyvault show --name "$KEY_VAULT_NAME" >/dev/null 2>&1; then
        print_success "Key Vault exists"
        
        # Check if secrets exist
        print_info "Checking Key Vault secrets..."
        local secrets=$(az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query "length([?contains(name, 'mongodb')])")
        if [ "$secrets" -gt 0 ]; then
            print_success "MongoDB secrets found in Key Vault"
        else
            print_warning "No MongoDB secrets found in Key Vault"
        fi
    else
        print_error "Key Vault not found"
        return 1
    fi
}

# Function to test MongoDB connectivity
test_mongodb_connectivity() {
    print_info "Testing MongoDB connectivity..."
    
    # Get MongoDB connection details from Key Vault
    print_info "Retrieving connection details from Key Vault..."
    
    local connection_string=""
    if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "mongodb-connection-string" >/dev/null 2>&1; then
        connection_string=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "mongodb-connection-string" --query "value" -o tsv)
        print_success "Connection string retrieved from Key Vault"
    else
        print_warning "Connection string not found in Key Vault, using FQDN"
        local password=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "mongodb-root-password" --query "value" -o tsv 2>/dev/null || echo "")
        if [ -n "$password" ]; then
            connection_string="mongodb://root:$password@$MONGODB_FQDN:27017/dculus_forms?authSource=admin"
        else
            print_error "Could not retrieve MongoDB password"
            return 1
        fi
    fi
    
    # Test connection using mongosh if available
    if command -v mongosh >/dev/null 2>&1; then
        print_info "Testing connection with mongosh..."
        if echo "db.runCommand('ismaster')" | mongosh "$connection_string" --quiet >/dev/null 2>&1; then
            print_success "MongoDB connection test successful"
        else
            print_warning "MongoDB connection test failed (this might be expected if network access is restricted)"
        fi
    else
        print_warning "mongosh not installed, skipping connection test"
        print_info "To test connectivity manually, install mongosh and use:"
        echo "mongosh '$connection_string'"
    fi
}

# Function to check logs
check_logs() {
    print_info "Checking container logs..."
    
    local app_name=$(az containerapp list --resource-group "$RESOURCE_GROUP" --query "[?contains(name, 'mongodb')].name" -o tsv)
    if [ -n "$app_name" ]; then
        print_info "Recent container logs:"
        az containerapp logs show --name "$app_name" --resource-group "$RESOURCE_GROUP" --tail 10 2>/dev/null || print_warning "Could not retrieve logs"
    fi
}

# Function to show deployment summary
show_summary() {
    print_info "Deployment Summary"
    echo "=================="
    echo ""
    echo "Resource Group: $RESOURCE_GROUP"
    echo "MongoDB FQDN: $MONGODB_FQDN"
    echo "Key Vault: $KEY_VAULT_NAME"
    echo ""
    echo "Connection Information:"
    echo "- MongoDB endpoint: $MONGODB_FQDN:27017"
    echo "- Database: dculus_forms"
    echo "- Username: root"
    echo "- Password: stored in Key Vault ($KEY_VAULT_NAME)"
    echo ""
    echo "Next Steps:"
    echo "1. Retrieve connection string from Key Vault"
    echo "2. Update your application configuration"
    echo "3. Test your application connectivity"
    echo ""
    echo "To get the connection string:"
    echo "az keyvault secret show --vault-name '$KEY_VAULT_NAME' --name 'mongodb-connection-string' --query 'value' -o tsv"
}

# Main validation
main() {
    print_info "Starting MongoDB infrastructure validation..."
    echo ""
    
    check_terraform_outputs
    validate_azure_resources
    test_mongodb_connectivity
    check_logs
    
    echo ""
    print_success "Validation completed!"
    echo ""
    show_summary
}

# Run main function
main "$@"
