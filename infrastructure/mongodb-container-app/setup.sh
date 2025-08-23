#!/bin/bash

# MongoDB Infrastructure Setup Script
# This script helps set up the MongoDB infrastructure on Azure Container Apps

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR"

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command_exists az; then
        missing_tools+=("Azure CLI")
    fi
    
    if ! command_exists terraform; then
        missing_tools+=("Terraform")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        echo "Please install the missing tools and run this script again."
        echo ""
        echo "Installation links:"
        echo "- Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        echo "- Terraform: https://learn.hashicorp.com/tutorials/terraform/install-cli"
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Function to check Azure login
check_azure_login() {
    print_info "Checking Azure authentication..."
    
    if ! az account show >/dev/null 2>&1; then
        print_warning "Not logged in to Azure"
        print_info "Please log in to Azure CLI..."
        az login
    fi
    
    local subscription_id=$(az account show --query id -o tsv)
    local account_name=$(az account show --query name -o tsv)
    
    print_success "Logged in to Azure subscription: $account_name ($subscription_id)"
}

# Function to initialize Terraform backend
setup_terraform_backend() {
    print_info "Setting up Terraform backend..."
    
    local resource_group="dculus-global-terraform-assets-resource-grp"
    local storage_account="dculusterraformstates"
    local container_name="mongodb-container-app-deployment"
    local location="eastus"
    
    print_info "Creating resource group..."
    az group create \
        --name "$resource_group" \
        --location "$location" \
        --only-show-errors || true
    
    print_info "Creating storage account..."
    az storage account create \
        --resource-group "$resource_group" \
        --name "$storage_account" \
        --sku Standard_LRS \
        --encryption-services blob \
        --allow-blob-public-access false \
        --only-show-errors || true
    
    print_info "Creating blob container..."
    az storage container create \
        --name "$container_name" \
        --account-name "$storage_account" \
        --only-show-errors || true
    
    print_success "Terraform backend is ready"
}

# Function to setup Terraform variables
setup_terraform_vars() {
    print_info "Setting up Terraform variables..."
    
    cd "$TERRAFORM_DIR"
    
    if [ ! -f "terraform.tfvars" ]; then
        if [ -f "terraform.tfvars.example" ]; then
            cp terraform.tfvars.example terraform.tfvars
            print_success "Created terraform.tfvars from example"
            print_warning "Please review and customize terraform.tfvars before proceeding"
        else
            print_error "terraform.tfvars.example not found"
            exit 1
        fi
    else
        print_success "terraform.tfvars already exists"
    fi
}

# Function to initialize Terraform
init_terraform() {
    print_info "Initializing Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Get storage account key
    local storage_account="dculusterraformstates"
    local resource_group="dculus-global-terraform-assets-resource-grp"
    
    local account_key=$(az storage account keys list \
        --resource-group "$resource_group" \
        --account-name "$storage_account" \
        --query '[0].value' -o tsv)
    
    # Initialize Terraform with backend configuration
    terraform init \
        -backend-config="access_key=$account_key"
    
    print_success "Terraform initialized successfully"
}

# Function to validate Terraform configuration
validate_terraform() {
    print_info "Validating Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    terraform fmt -check -recursive || {
        print_warning "Terraform files need formatting. Running terraform fmt..."
        terraform fmt -recursive
    }
    
    terraform validate
    
    print_success "Terraform configuration is valid"
}

# Function to plan Terraform deployment
plan_terraform() {
    print_info "Creating Terraform plan..."
    
    cd "$TERRAFORM_DIR"
    
    terraform plan -out=tfplan
    
    print_success "Terraform plan created successfully"
    print_info "Review the plan above before applying"
}

# Function to apply Terraform deployment
apply_terraform() {
    print_info "Applying Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    if [ ! -f "tfplan" ]; then
        print_error "No Terraform plan found. Run 'plan' command first."
        exit 1
    fi
    
    terraform apply tfplan
    
    print_success "MongoDB infrastructure deployed successfully!"
    
    # Show outputs
    print_info "Deployment outputs:"
    terraform output
}

# Function to destroy infrastructure
destroy_terraform() {
    print_warning "This will destroy all MongoDB infrastructure!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Deployment destruction cancelled"
        exit 0
    fi
    
    cd "$TERRAFORM_DIR"
    
    terraform destroy
    
    print_success "Infrastructure destroyed"
}

# Function to show help
show_help() {
    echo "MongoDB Infrastructure Setup Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup     - Complete setup (check prerequisites, login, init)"
    echo "  plan      - Create Terraform plan"
    echo "  apply     - Apply Terraform plan"
    echo "  destroy   - Destroy infrastructure"
    echo "  validate  - Validate Terraform configuration"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup     # Initial setup"
    echo "  $0 plan      # Create execution plan"
    echo "  $0 apply     # Deploy infrastructure"
    echo ""
}

# Main script logic
case "${1:-}" in
    setup)
        check_prerequisites
        check_azure_login
        setup_terraform_backend
        setup_terraform_vars
        init_terraform
        validate_terraform
        print_success "Setup completed! You can now run '$0 plan' to create a deployment plan."
        ;;
    plan)
        check_prerequisites
        check_azure_login
        plan_terraform
        ;;
    apply)
        check_prerequisites
        check_azure_login
        apply_terraform
        ;;
    destroy)
        check_prerequisites
        check_azure_login
        destroy_terraform
        ;;
    validate)
        check_prerequisites
        validate_terraform
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        print_error "No command specified"
        show_help
        exit 1
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
