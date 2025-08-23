#!/bin/bash

# MongoDB Azure Container Apps Deployment Script - 2025 Edition
# Simple, stable, and reliable deployment without explicit monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
RESOURCE_GROUP_SUFFIX=""
LOCATION="East US"
ALERT_EMAIL=""
WORKLOAD_PROFILE="D4"
ENABLE_ZONE_REDUNDANCY=true
ENABLE_AUTO_SCALING=true

echo -e "${BLUE}🚀 MongoDB Azure Container Apps Deployment (2025)${NC}"
echo "=================================================="

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Please install it first."
        exit 1
    fi
    
    # Check Azure login
    if ! az account show &> /dev/null; then
        print_error "Not logged into Azure. Please run 'az login' first."
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Collect user input
collect_input() {
    print_info "Collecting deployment configuration..."
    
    # Alert email (required)
    while [[ -z "$ALERT_EMAIL" ]]; do
        read -p "Enter email address for monitoring alerts: " ALERT_EMAIL
        if [[ ! "$ALERT_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            print_error "Please enter a valid email address"
            ALERT_EMAIL=""
        fi
    done
    
    # Resource group suffix (optional)
    read -p "Enter resource group suffix (optional): " RESOURCE_GROUP_SUFFIX
    
    # Location
    read -p "Enter Azure region [East US]: " INPUT_LOCATION
    LOCATION=${INPUT_LOCATION:-"East US"}
    
    # Workload profile
    echo "Available workload profiles:"
    echo "  Consumption - Serverless (cheapest)"
    echo "  D4 - 4 vCPU, 16 GB RAM (recommended)"
    echo "  D8 - 8 vCPU, 32 GB RAM"
    echo "  E4 - 4 vCPU, 32 GB RAM (memory optimized)"
    read -p "Enter workload profile [D4]: " INPUT_PROFILE
    WORKLOAD_PROFILE=${INPUT_PROFILE:-"D4"}
    
    # Zone redundancy
    read -p "Enable zone redundancy for high availability? [Y/n]: " ZONE_INPUT
    if [[ "$ZONE_INPUT" =~ ^[Nn] ]]; then
        ENABLE_ZONE_REDUNDANCY=false
    fi
    
    # Auto-scaling
    read -p "Enable auto-scaling? [Y/n]: " SCALING_INPUT
    if [[ "$SCALING_INPUT" =~ ^[Nn] ]]; then
        ENABLE_AUTO_SCALING=false
    fi
}

# Deploy infrastructure
deploy_infrastructure() {
    print_info "Deploying MongoDB Container App infrastructure..."
    
    # Generate unique suffix if not provided
    if [[ -z "$RESOURCE_GROUP_SUFFIX" ]]; then
        RESOURCE_GROUP_SUFFIX=$(date +%s | tail -c 5)
    fi
    
    # Initialize Terraform
    print_info "Initializing Terraform..."
    terraform init
    
    # Create terraform.tfvars
    cat > terraform.tfvars <<EOF
# 2025 MongoDB Container App Configuration
application_name = "dculus-mongodb-${RESOURCE_GROUP_SUFFIX}"
environment = "production"
location = "${LOCATION}"

# Enhanced 2025 features
enable_zone_redundancy = ${ENABLE_ZONE_REDUNDANCY}
workload_profile_type = "${WORKLOAD_PROFILE}"
enable_auto_scaling = ${ENABLE_AUTO_SCALING}

# Scaling configuration
min_replicas = 1
max_replicas = 5
scaling_cpu_threshold = 70
scaling_memory_threshold = 80

# Resource allocation
container_cpu = 1.0
container_memory = "2Gi"
storage_size_gb = 20

# Security
enable_external_access = false
mongodb_root_password = "SecureMongoDB2025!@#"

# Monitoring
alert_email_address = "${ALERT_EMAIL}"

# Storage
backup_retention_days = 30
EOF

    print_info "Configuration saved to terraform.tfvars"
    
    # Plan deployment
    print_info "Planning deployment..."
    terraform plan -out=tfplan
    
    # Apply deployment
    print_warning "About to deploy MongoDB Container App infrastructure."
    read -p "Continue? [Y/n]: " CONTINUE
    if [[ "$CONTINUE" =~ ^[Nn] ]]; then
        print_info "Deployment cancelled."
        exit 0
    fi
    
    print_info "Applying Terraform configuration..."
    terraform apply tfplan
    
    print_status "Infrastructure deployment completed!"
}

# Get deployment outputs
get_outputs() {
    print_info "Retrieving deployment information..."
    
    # Get Terraform outputs
    echo ""
    echo -e "${BLUE}📋 Deployment Summary${NC}"
    echo "==================="
    
    MONGODB_INTERNAL_FQDN=$(terraform output -raw mongodb_internal_fqdn 2>/dev/null || echo "N/A")
    MONGODB_EXTERNAL_FQDN=$(terraform output -raw mongodb_fqdn 2>/dev/null || echo "N/A")
    RESOURCE_GROUP=$(terraform output -raw resource_group_name 2>/dev/null || echo "N/A")
    KEY_VAULT_NAME=$(terraform output -raw key_vault_name 2>/dev/null || echo "N/A")
    
    echo "Resource Group: $RESOURCE_GROUP"
    echo "MongoDB Internal FQDN: $MONGODB_INTERNAL_FQDN"
    echo "MongoDB External FQDN: $MONGODB_EXTERNAL_FQDN"
    echo "Key Vault: $KEY_VAULT_NAME"
    echo ""
    
    # Show connection instructions
    echo -e "${GREEN}🔗 Connection Information${NC}"
    echo "========================"
    echo "Internal Connection (for Container Apps):"
    echo "  mongodb://admin:[PASSWORD]@$MONGODB_INTERNAL_FQDN:27017/dculus_forms"
    echo ""
    echo "Password is stored in Key Vault: $KEY_VAULT_NAME"
    echo ""
    
    # Show monitoring URLs
    echo -e "${BLUE}📊 Monitoring & Management${NC}"
    echo "=========================="
    echo "• Azure Portal: https://portal.azure.com"
    echo "• Resource Group: $RESOURCE_GROUP"
    echo "• Application Insights: $KEY_VAULT_NAME-insights"
    echo "• Log Analytics: Check Container App logs"
    echo ""
    
    # Show next steps
    echo -e "${YELLOW}🎯 Next Steps${NC}"
    echo "============="
    echo "1. Update your application connection string"
    echo "2. Test connectivity from your Container Apps"
    echo "3. Configure backup strategy if needed"
    echo "4. Set up custom alerts in Azure Monitor"
    echo "5. Review security settings for production"
}

# Validate deployment
validate_deployment() {
    print_info "Validating deployment..."
    
    # Check if Container App is running
    CONTAINER_APP_NAME=$(terraform output -raw mongodb_container_app_name 2>/dev/null || echo "")
    RESOURCE_GROUP=$(terraform output -raw resource_group_name 2>/dev/null || echo "")
    
    if [[ -n "$CONTAINER_APP_NAME" && -n "$RESOURCE_GROUP" ]]; then
        print_info "Checking Container App status..."
        
        STATUS=$(az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "properties.provisioningState" -o tsv 2>/dev/null || echo "Unknown")
        
        if [[ "$STATUS" == "Succeeded" ]]; then
            print_status "Container App is running successfully"
        else
            print_warning "Container App status: $STATUS"
        fi
        
        # Check replicas
        REPLICAS=$(az containerapp revision list --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "[0].properties.replicas" -o tsv 2>/dev/null || echo "0")
        print_info "Active replicas: $REPLICAS"
    else
        print_warning "Could not validate Container App status"
    fi
}

# Cleanup function
cleanup_on_error() {
    print_error "Deployment failed. Checking for partial resources..."
    terraform show 2>/dev/null || true
}

# Main deployment flow
main() {
    trap cleanup_on_error ERR
    
    check_prerequisites
    collect_input
    deploy_infrastructure
    validate_deployment
    get_outputs
    
    print_status "✨ MongoDB Container App deployment completed successfully!"
    print_info "Your MongoDB instance is ready with 2025 enhanced features:"
    print_info "  ✅ Zone redundancy: $ENABLE_ZONE_REDUNDANCY"
    print_info "  ✅ Workload profile: $WORKLOAD_PROFILE"
    print_info "  ✅ Auto-scaling: $ENABLE_AUTO_SCALING"
    print_info "  ✅ Advanced monitoring and alerting"
    print_info "  ✅ Enhanced security with Key Vault"
}

# Run main function
main "$@"