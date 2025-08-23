terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "dculus-global-terraform-assets-resource-grp"
    storage_account_name = "dculusterraformstates"
    container_name       = "dculus-backend-deployment"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
  use_oidc = true
}

resource "azurerm_resource_group" "dculus_backend" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
    CreatedBy   = "github-actions"
    Purpose     = "backend-infrastructure"
  }
}