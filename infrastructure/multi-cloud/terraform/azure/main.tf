terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "dculus-global-terraform-assets-resource-grp"
    storage_account_name = "dculusterraformstates"
    container_name       = "backend-container-app-deployment"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

# Data source for existing resource group (if you want to use existing one)
# or create a new one for the container app
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}

# Log Analytics Workspace for Container App Environment
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.app_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = var.tags
}

# Container App Environment
resource "azurerm_container_app_environment" "main" {
  name                       = "${var.app_name}-env"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  tags = var.tags
}

# Container App
resource "azurerm_container_app" "backend" {
  name                         = "${var.app_name}-backend"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 10

    container {
      name   = "backend"
      image  = "dculus/forms-backend:latest"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "DATABASE_URL"
        value = var.mongodb_connection_string
      }


      env {
        name  = "BETTER_AUTH_SECRET"
        value = var.better_auth_secret
      }

      env {
        name  = "BETTER_AUTH_URL"
        value = "https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io"
      }

      env {
        name  = "S3_CDN_URL"
        value = "https://cdn-handler-dev.natheeshece.workers.dev"
      }

      env {
        name  = "NODE_ENV"
        value = "development"
      }

      env {
        name  = "PORT"
        value = "4000"
      }

      env {
        name  = "CORS_ORIGINS"
        value = var.cors_origins
      }

      env {
        name  = "S3_ACCESS_KEY"
        value = var.s3_access_key
      }

      env {
        name  = "S3_SECRET_KEY"
        value = var.s3_secret_key
      }

      env {
        name  = "S3_ENDPOINT"
        value = var.s3_endpoint
      }

      env {
        name  = "S3_PRIVATE_BUCKET_NAME"
        value = var.s3_private_bucket_name
      }

      env {
        name  = "S3_PUBLIC_BUCKET_NAME"
        value = var.s3_public_bucket_name
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 4000
        path                    = "/health"
        initial_delay           = 30
        interval_seconds        = 30
        timeout                 = 10
        failure_count_threshold = 3
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 4000
        path                    = "/health"
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 3
        success_count_threshold = 1
      }
    }

    # HTTP scaling rule based on concurrent requests
    http_scale_rule {
      name                = "http-scale"
      concurrent_requests = 10
    }
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = true
    target_port                = 4000
    transport                  = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = var.tags
}