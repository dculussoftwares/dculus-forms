terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
  }

  # Backend configuration is loaded from environment-specific backend.tf files
  # See: environments/{dev,staging,production}/backend.tf
}

provider "azurerm" {
  features {}
}

# Locals for resource naming with environment suffix
locals {
  resource_group_name = "${var.project_name}-${var.environment}-rg"
  app_name            = "${var.project_name}-${var.environment}"
  full_container_image = "${var.container_image}:${var.container_image_tag}"
}

# Resource Group for this environment
resource "azurerm_resource_group" "main" {
  name     = local.resource_group_name
  location = var.location
  tags     = var.tags
}

# Log Analytics Workspace for Container App Environment
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.app_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_analytics_retention_days

  tags = var.tags
}

# Container App Environment
resource "azurerm_container_app_environment" "main" {
  name                       = "${local.app_name}-env"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  tags = var.tags
}

# Container App
resource "azurerm_container_app" "backend" {
  name                         = "${local.app_name}-backend"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "backend"
      image  = local.full_container_image
      cpu    = var.cpu_cores
      memory = "${var.memory_gb}Gi"

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
        value = var.better_auth_url
      }

      env {
        name  = "NODE_ENV"
        value = "production"
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
        port                    = var.container_port
        path                    = "/health"
        initial_delay           = 30
        interval_seconds        = 30
        timeout                 = 10
        failure_count_threshold = 3
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = var.container_port
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
    allow_insecure_connections = var.allow_insecure_traffic
    external_enabled           = var.external_enabled
    target_port                = var.target_port
    transport                  = var.ingress_transport

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = var.tags
}