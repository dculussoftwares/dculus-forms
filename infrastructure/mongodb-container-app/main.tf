terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "dculus-global-terraform-assets-resource-grp"
    storage_account_name = "dculusterraformstates"
    container_name       = "mongodb-container-app-deployment"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

# Random password for MongoDB
resource "random_password" "mongodb_root_password" {
  length  = 32
  special = true
}

# Resource Group
resource "azurerm_resource_group" "mongodb" {
  name     = var.resource_group_name
  location = var.location

  tags = var.common_tags
}

# Log Analytics Workspace for Container Apps
resource "azurerm_log_analytics_workspace" "mongodb" {
  name                = "${var.prefix}-mongodb-logs"
  location            = azurerm_resource_group.mongodb.location
  resource_group_name = azurerm_resource_group.mongodb.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = var.common_tags
}

# Container Apps Environment
resource "azurerm_container_app_environment" "mongodb" {
  name                       = "${var.prefix}-mongodb-env"
  location                   = azurerm_resource_group.mongodb.location
  resource_group_name        = azurerm_resource_group.mongodb.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.mongodb.id

  tags = var.common_tags
}

# Container App Environment Storage for MongoDB data
resource "azurerm_container_app_environment_storage" "mongodb_data" {
  name                         = "mongodb-data"
  container_app_environment_id = azurerm_container_app_environment.mongodb.id
  account_name                 = azurerm_storage_account.mongodb_data.name
  share_name                   = azurerm_storage_share.mongodb_data.name
  access_key                   = azurerm_storage_account.mongodb_data.primary_access_key
  access_mode                  = "ReadWrite"
}

# Storage Account for MongoDB data persistence
resource "azurerm_storage_account" "mongodb_data" {
  name                     = "${var.prefix}mongodbdata"
  resource_group_name      = azurerm_resource_group.mongodb.name
  location                 = azurerm_resource_group.mongodb.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  
  # Enable file shares for container mounting
  enable_https_traffic_only = true
  min_tls_version          = "TLS1_2"

  tags = var.common_tags
}

# File Share for MongoDB data
resource "azurerm_storage_share" "mongodb_data" {
  name                 = "mongodb-data"
  storage_account_name = azurerm_storage_account.mongodb_data.name
  quota                = 10 # 10GB quota
}

# Container App for MongoDB
resource "azurerm_container_app" "mongodb" {
  name                         = "${var.prefix}-mongodb"
  container_app_environment_id = azurerm_container_app_environment.mongodb.id
  resource_group_name          = azurerm_resource_group.mongodb.name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 1

    # Commenting out volume temporarily to test without Azure Files
    # volume {
    #   name         = "mongodb-data"
    #   storage_type = "AzureFile"
    #   storage_name = azurerm_storage_share.mongodb_data.name
    # }

    container {
      name   = "mongodb"
      image  = var.mongodb_image
      cpu    = var.mongodb_cpu
      memory = var.mongodb_memory

      # Environment variables for MongoDB
      env {
        name  = "MONGO_INITDB_ROOT_USERNAME"
        value = var.mongodb_root_username
      }

      env {
        name        = "MONGO_INITDB_ROOT_PASSWORD"
        secret_name = "mongodb-root-password"
      }

      env {
        name  = "MONGO_INITDB_DATABASE"
        value = var.mongodb_init_database
      }

      # Ensure MongoDB doesn't use strict file system requirements
      env {
        name  = "WIREDTIGER_FILESYSTEM_CHECK"
        value = "false"
      }

      # Commenting out volume mount temporarily to test without Azure Files
      # volume_mounts {
      #   name = "mongodb-data"
      #   path = "/data/db"
      # }
    }
  }

  # Secret for MongoDB root password
  secret {
    name  = "mongodb-root-password"
    value = random_password.mongodb_root_password.result
  }

  # Ingress configuration - Internal only for security
  ingress {
    external_enabled = false # MongoDB should not be directly accessible from internet
    target_port      = 27017
    transport        = "tcp"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = var.common_tags
}

# Key Vault for storing MongoDB credentials (optional but recommended)
resource "azurerm_key_vault" "mongodb" {
  name                = "${var.prefix}-mongodb-kv"
  location            = azurerm_resource_group.mongodb.location
  resource_group_name = azurerm_resource_group.mongodb.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  purge_protection_enabled = false # Set to true for production

  tags = var.common_tags
}

# Key Vault access policy for current user/service principal
resource "azurerm_key_vault_access_policy" "mongodb" {
  key_vault_id = azurerm_key_vault.mongodb.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Recover",
    "Backup",
    "Restore"
  ]
}

# Store MongoDB credentials in Key Vault
resource "azurerm_key_vault_secret" "mongodb_root_password" {
  name         = "mongodb-root-password"
  value        = random_password.mongodb_root_password.result
  key_vault_id = azurerm_key_vault.mongodb.id

  depends_on = [azurerm_key_vault_access_policy.mongodb]

  tags = var.common_tags
}

resource "azurerm_key_vault_secret" "mongodb_connection_string" {
  name  = "mongodb-connection-string"
  value = "mongodb://${var.mongodb_root_username}:${random_password.mongodb_root_password.result}@${azurerm_container_app.mongodb.latest_revision_fqdn}:27017/${var.mongodb_init_database}?authSource=admin"
  key_vault_id = azurerm_key_vault.mongodb.id

  depends_on = [azurerm_key_vault_access_policy.mongodb]

  tags = var.common_tags
}

# Data source for current Azure configuration
data "azurerm_client_config" "current" {}
