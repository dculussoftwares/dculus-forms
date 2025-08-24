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
    container_name       = "backend-resource-deployment"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
  use_oidc = true
}

resource "azurerm_resource_group" "mongodb_backend" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
    CreatedBy   = "github-actions"
    Purpose     = "mongodb-backend-infrastructure"
  }
}

resource "azurerm_log_analytics_workspace" "mongodb_workspace" {
  name                = "${var.resource_group_name}-logs"
  location            = azurerm_resource_group.mongodb_backend.location
  resource_group_name = azurerm_resource_group.mongodb_backend.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
  }
}

resource "azurerm_container_app_environment" "mongodb_environment" {
  name                       = "${var.resource_group_name}-environment"
  location                   = azurerm_resource_group.mongodb_backend.location
  resource_group_name        = azurerm_resource_group.mongodb_backend.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.mongodb_workspace.id

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
  }
}

# Note: Using EmptyDir temporary storage instead of Azure Files
# Azure Files is incompatible with MongoDB WiredTiger storage engine
# This provides temporary storage that persists during replica lifetime
# For production persistent storage, consider Azure Cosmos DB for MongoDB API

resource "azurerm_container_app" "mongodb" {
  name                         = "${var.resource_group_name}-mongodb"
  container_app_environment_id = azurerm_container_app_environment.mongodb_environment.id
  resource_group_name          = azurerm_resource_group.mongodb_backend.name
  revision_mode                = "Single"

  template {
    container {
      name   = "mongodb"
      image  = "mongo:latest"
      cpu    = 1.0
      memory = "2Gi"

      env {
        name  = "MONGO_INITDB_ROOT_USERNAME"
        value = "admin"
      }

      env {
        name        = "MONGO_INITDB_ROOT_PASSWORD"
        secret_name = "mongodb-admin-password"
      }

      volume_mounts {
        name = "mongodb-data"
        path = "/data/db"
      }

      liveness_probe {
        transport = "TCP"
        port      = 27017
      }

      readiness_probe {
        transport = "TCP"
        port      = 27017
      }
    }

    min_replicas = 1
    max_replicas = 1

    volume {
      name         = "mongodb-data"
      storage_type = "EmptyDir"
    }
  }

  secret {
    name  = "mongodb-admin-password"
    value = var.mongodb_admin_password
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = false
    target_port                = 27017
    transport                  = "tcp"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    Service     = "mongodb"
  }
}

