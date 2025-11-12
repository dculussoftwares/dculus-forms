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
  resource_group_name   = "${var.project_name}-${var.environment}-rg"
  app_name              = "${var.project_name}-${var.environment}"
  full_container_image  = "${var.container_image}:${var.container_image_tag}"
  public_cdn_domain     = "public-cdn-${var.environment}.dculus.com"
  resolved_s3_cdn_url   = var.public_s3_cdn_url != "" ? var.public_s3_cdn_url : "https://${local.public_cdn_domain}"
}

# Resource Group for this environment
resource "azurerm_resource_group" "main" {
  name     = local.resource_group_name
  location = var.location
  tags     = var.tags
}

# Container App Environment
resource "azurerm_container_app_environment" "main" {
  name                = "${local.app_name}-env"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

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
        name  = "PUBLIC_S3_ACCESS_KEY"
        value = var.public_s3_access_key
      }

      env {
        name  = "PUBLIC_S3_SECRET_KEY"
        value = var.public_s3_secret_key
      }

      env {
        name  = "PUBLIC_S3_ENDPOINT"
        value = var.public_s3_endpoint
      }

      env {
        name  = "PUBLIC_S3_CDN_URL"
        value = local.resolved_s3_cdn_url
      }

      env {
        name  = "PRIVATE_S3_BUCKET_NAME"
        value = var.private_s3_bucket_name
      }

      env {
        name  = "PUBLIC_S3_BUCKET_NAME"
        value = var.public_s3_bucket_name
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
