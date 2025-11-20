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
  
  # Cloudflare service domain for BETTER_AUTH_URL
  service_domain        = "form-services-${var.environment}.dculus.com"
  resolved_auth_url     = var.better_auth_url != "" ? var.better_auth_url : "https://${local.service_domain}"
  
  # Dynamically generate frontend URLs based on environment
  # These match the Cloudflare Pages deployment URLs
  form_app_domain       = "form-app-${var.environment}.${var.root_domain}"
  form_viewer_domain    = "viewer-app-${var.environment}.${var.root_domain}"
  admin_app_domain      = "form-admin-app-${var.environment}.${var.root_domain}"
  
  # For production, also include the apex domain aliases
  production_domains    = var.environment == "production" ? [
    "https://form-app.${var.root_domain}",
    "https://viewer-app.${var.root_domain}",
    "https://form-admin-app.${var.root_domain}"
  ] : []
  
  # Build CORS origins dynamically
  # 1. Environment-specific frontend domains
  frontend_domains = [
    "https://${local.form_app_domain}",
    "https://${local.form_viewer_domain}",
    "https://${local.admin_app_domain}"
  ]
  
  # 2. Development localhost URLs (only for dev/staging)
  localhost_origins = var.environment != "production" ? [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://localhost:5173"
  ] : []
  
  # 3. Additional custom origins from variable (if any)
  custom_origins = var.cors_origins != "" ? split(",", var.cors_origins) : []
  
  # Combine all origins and remove duplicates
  all_cors_origins = distinct(concat(
    local.frontend_domains,
    local.production_domains,
    local.localhost_origins,
    local.custom_origins
  ))
  
  # Convert to comma-separated string for environment variable
  cors_origins_string = join(",", local.all_cors_origins)
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
        value = var.postgres_connection_string
      }


      env {
        name  = "BETTER_AUTH_SECRET"
        value = var.better_auth_secret
      }

      env {
        name  = "BETTER_AUTH_URL"
        value = local.resolved_auth_url
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "PORT"
        value = "4000"
      }

      env {
        name  = "CORS_ORIGINS"
        value = local.cors_origins_string
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

      env {
        name  = "ADMIN_EMAIL"
        value = var.admin_email
      }

      env {
        name  = "ADMIN_PASSWORD"
        value = var.admin_password
      }

      env {
        name  = "ADMIN_NAME"
        value = var.admin_name
      }

      env {
        name  = "EMAIL_HOST"
        value = var.email_host
      }

      env {
        name  = "EMAIL_PORT"
        value = var.email_port
      }

      env {
        name  = "EMAIL_USER"
        value = var.email_user
      }

      env {
        name  = "EMAIL_PASSWORD"
        value = var.email_password
      }

      env {
        name  = "EMAIL_FROM"
        value = var.email_from
      }

      env {
        name  = "CHARGEBEE_SITE"
        value = var.chargebee_site
      }

      env {
        name  = "CHARGEBEE_API_KEY"
        value = var.chargebee_api_key
      }

      env {
        name  = "RUN_SEED"
        value = var.run_seed ? "true" : "false"
      }

      env {
        name  = "SENTRY_DSN"
        value = var.sentry_dsn
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
