data "azurerm_subscription" "current" {}

# Random suffix for unique naming
resource "random_integer" "suffix" {
  min = 1000
  max = 9999
}

locals {
  unique_suffix = random_integer.suffix.result
}

# Resource Group
resource "azurerm_resource_group" "mongodb_rg" {
  name     = "${var.application_name}-container-rg"
  location = var.location

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "MongoDB Container App"
  }
}

# Log Analytics Workspace (required for Container Apps)
resource "azurerm_log_analytics_workspace" "mongodb_logs" {
  name                = "${var.application_name}-logs-${local.unique_suffix}"
  location            = azurerm_resource_group.mongodb_rg.location
  resource_group_name = azurerm_resource_group.mongodb_rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = {
    Environment = var.environment
    Application = var.application_name
  }
}

# Container Apps Environment
resource "azurerm_container_app_environment" "mongodb_env" {
  name                       = "${var.application_name}-env-${local.unique_suffix}"
  location                   = azurerm_resource_group.mongodb_rg.location
  resource_group_name        = azurerm_resource_group.mongodb_rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.mongodb_logs.id

  tags = {
    Environment = var.environment
    Application = var.application_name
  }
}

# Storage Account for MongoDB data persistence
resource "azurerm_storage_account" "mongodb_storage" {
  name                     = "mongodbstorage${local.unique_suffix}"
  resource_group_name      = azurerm_resource_group.mongodb_rg.name
  location                 = azurerm_resource_group.mongodb_rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = {
    Environment = var.environment
    Application = var.application_name
  }
}

# File Share for MongoDB data
resource "azurerm_storage_share" "mongodb_data" {
  name                 = "mongodb-data"
  storage_account_name = azurerm_storage_account.mongodb_storage.name
  quota                = var.storage_size_gb

  depends_on = [azurerm_storage_account.mongodb_storage]
}

# Container App for MongoDB
resource "azurerm_container_app" "mongodb" {
  name                         = "${var.application_name}-${local.unique_suffix}"
  container_app_environment_id = azurerm_container_app_environment.mongodb_env.id
  resource_group_name          = azurerm_resource_group.mongodb_rg.name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 1

    # Volume for persistent storage
    volume {
      name         = "mongodb-storage"
      storage_type = "AzureFile"
      storage_name = azurerm_container_app_environment_storage.mongodb_storage.name
    }

    container {
      name   = "mongodb"
      image  = "mongo:8.0"
      cpu    = var.container_cpu
      memory = var.container_memory

      # Mount persistent storage
      volume_mounts {
        name = "mongodb-storage"
        path = "/data/db"
      }

      # Environment variables for MongoDB
      env {
        name  = "MONGO_INITDB_ROOT_USERNAME"
        value = "admin"
      }

      env {
        name  = "MONGO_INITDB_ROOT_PASSWORD"
        value = var.mongodb_root_password
      }

      env {
        name  = "MONGO_INITDB_DATABASE"
        value = "dculus_forms"
      }

      # MongoDB port
      port {
        port     = var.mongodb_port
        protocol = "TCP"
      }

      # Health check
      liveness_probe {
        port = var.mongodb_port
        tcp_socket {}
        initial_delay_seconds = 30
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 3
      }

      readiness_probe {
        port = var.mongodb_port
        tcp_socket {}
        initial_delay_seconds = 15
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 3
      }
    }
  }

  # Ingress configuration for external access
  ingress {
    external_enabled = true
    target_port      = var.mongodb_port

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
  }

  depends_on = [azurerm_container_app_environment_storage.mongodb_storage]
}

# Storage configuration for Container Apps Environment
resource "azurerm_container_app_environment_storage" "mongodb_storage" {
  name                         = "mongodb-storage"
  container_app_environment_id = azurerm_container_app_environment.mongodb_env.id
  account_name                 = azurerm_storage_account.mongodb_storage.name
  share_name                   = azurerm_storage_share.mongodb_data.name
  access_key                   = azurerm_storage_account.mongodb_storage.primary_access_key
  access_mode                  = "ReadWrite"

  depends_on = [
    azurerm_storage_account.mongodb_storage,
    azurerm_storage_share.mongodb_data
  ]
}