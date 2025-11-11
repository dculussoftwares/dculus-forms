terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "~>1.12"
    }
  }

  # Backend configuration is loaded from environment-specific backend.tf files
  # See: environments/{dev,staging,production}/backend.tf
}

provider "azurerm" {
  features {}
}

provider "azapi" {
  default_location = var.location
  default_tags     = var.tags
}

# Locals for resource naming with environment suffix
locals {
  resource_group_name  = "${var.project_name}-${var.environment}-rg"
  app_name             = "${var.project_name}-${var.environment}"
  full_container_image = "${var.container_image}:${var.container_image_tag}"
  public_cdn_domain    = "public-cdn-${var.environment}.dculus.com"
  resolved_s3_cdn_url  = var.s3_cdn_url != "" ? var.s3_cdn_url : "https://${local.public_cdn_domain}"
  form_services_domain = "${var.form_services_domain_prefix}-${var.environment}.${var.form_services_root_domain}"
  form_services_domain_enabled = var.enable_form_services_domain && var.form_services_domain_prefix != "" && var.form_services_root_domain != ""
  form_services_use_managed    = local.form_services_domain_enabled && var.form_services_certificate_type == "managed"
  form_services_use_byoc       = local.form_services_domain_enabled && var.form_services_certificate_type == "bring_your_own"
  form_services_certificate_id = local.form_services_use_managed ? azapi_resource.form_services_managed_certificate[0].id : local.form_services_use_byoc ? azurerm_container_app_environment_certificate.form_services[0].id : ""
  form_services_should_bind    = local.form_services_domain_enabled && var.form_services_bind_custom_domain && local.form_services_certificate_id != ""
  form_services_custom_domains = local.form_services_should_bind ? [local.form_services_domain] : []
  form_services_validation_token = local.form_services_use_managed ? try(azapi_resource.form_services_managed_certificate[0].output.properties.validationToken, "") : ""
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

resource "azurerm_container_app_environment_certificate" "form_services" {
  count                        = local.form_services_use_byoc ? 1 : 0
  name                         = "${local.app_name}-form-services-cert"
  container_app_environment_id = azurerm_container_app_environment.main.id
  certificate_blob_base64      = var.form_services_certificate_pfx_base64
  certificate_password         = var.form_services_certificate_password

  lifecycle {
    precondition {
      condition     = var.form_services_certificate_pfx_base64 != "" && var.form_services_certificate_password != ""
      error_message = "form_services_certificate_pfx_base64 and form_services_certificate_password must be provided when using bring your own certificates."
    }
  }
}

resource "azapi_resource" "form_services_managed_certificate" {
  count     = local.form_services_use_managed ? 1 : 0
  name      = "${local.app_name}-form-services-managed-cert"
  parent_id = azurerm_container_app_environment.main.id
  type      = "Microsoft.App/managedEnvironments/managedCertificates@2025-02-02-preview"
  location  = azurerm_resource_group.main.location

  body = jsonencode({
    properties = {
      subjectName            = local.form_services_domain
      domainControlValidation = var.form_services_domain_validation_method
    }
  })
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
        name  = "S3_CDN_URL"
        value = local.resolved_s3_cdn_url
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

    dynamic "custom_domain" {
      for_each = local.form_services_custom_domains
      content {
        name                     = custom_domain.value
        certificate_id           = local.form_services_certificate_id
        certificate_binding_type = "SniEnabled"
      }
    }
  }

  tags = var.tags
}
