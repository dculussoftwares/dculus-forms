terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.57.0, < 5.0.0"
    }
  }

  # Backend configuration is loaded from environment-specific backend.tf files
  # See: environments/{dev,staging,production}/backend.tf
}

provider "azurerm" {
  subscription_id = var.subscription_id
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Locals for resource naming with environment suffix
locals {
  resource_group_name  = "${var.project_name}-${var.environment}-rg"
  app_name             = "${var.project_name}-${var.environment}"
  full_container_image = "${var.container_image}:${var.container_image_tag}"
  public_cdn_domain    = "public-cdn-${var.environment}.dculus.com"
  resolved_s3_cdn_url  = var.public_s3_cdn_url != "" ? var.public_s3_cdn_url : "https://${local.public_cdn_domain}"

  # Cloudflare service domain for BETTER_AUTH_URL
  # Production uses clean domain without -production suffix
  service_domain    = var.environment == "production" ? "form-services.dculus.com" : "form-services-${var.environment}.dculus.com"
  resolved_auth_url = var.better_auth_url != "" ? var.better_auth_url : "https://${local.service_domain}"

  # Dynamically generate frontend URLs based on environment
  # Production uses clean domains (forms.dculus.com) while dev/staging use suffixed domains
  form_app_domain    = var.environment == "production" ? "forms.${var.root_domain}" : "form-app-${var.environment}.${var.root_domain}"
  form_viewer_domain = var.environment == "production" ? "viewer.${var.root_domain}" : "viewer-app-${var.environment}.${var.root_domain}"
  admin_app_domain   = var.environment == "production" ? "form-admin-app.${var.root_domain}" : "form-admin-app-${var.environment}.${var.root_domain}"

  # FRONTEND_URL for the backend: used as the Chargebee checkout redirect_url/
  # cancel_url base. Falls back to the environment's form-app domain so dev/
  # prod each redirect to their own frontend instead of a shared default.
  resolved_frontend_url = var.frontend_url != "" ? var.frontend_url : "https://${local.form_app_domain}"

  # Production domains are now primary (no separate aliases needed)
  production_domains = []

  # Build CORS origins dynamically
  # 1. Environment-specific frontend domains
  frontend_domains = [
    "https://${local.form_app_domain}",
    "https://${local.form_viewer_domain}",
    "https://${local.admin_app_domain}"
  ]

  # 1b. Cloudflare Pages' own *.pages.dev fallback domains — always reachable
  # alongside the custom domain (project name mirrors the dev/staging naming
  # scheme even in production, e.g. form-app-production.pages.dev).
  pages_dev_domains = [
    "https://form-app-${var.environment}.pages.dev",
    "https://viewer-app-${var.environment}.pages.dev",
    "https://form-admin-app-${var.environment}.pages.dev"
  ]

  # 2. Additional custom origins from variable (if any)
  custom_origins = var.cors_origins != "" ? split(",", var.cors_origins) : []

  # Combine all origins and remove duplicates
  all_cors_origins = distinct(concat(
    local.frontend_domains,
    local.pages_dev_domains,
    local.production_domains,
    local.custom_origins
  ))

  # Convert to comma-separated string for environment variable
  cors_origins_string = join(",", local.all_cors_origins)

  # Database URL used by the app. Always TLS: any `sslmode=disable` is upgraded and a
  # missing sslmode is added, whichever URL variable is used. connection_limit only
  # applies to the direct URL (Prisma adapter pools client-side, max 2).
  db_url_base      = var.postgres_direct_url != "" ? var.postgres_direct_url : var.postgres_connection_string
  db_url_limited   = var.postgres_direct_url == "" || can(regex("connection_limit=", local.db_url_base)) ? local.db_url_base : "${local.db_url_base}${can(regex("\\?", local.db_url_base)) ? "&" : "?"}connection_limit=2"
  db_url_tls       = replace(local.db_url_limited, "sslmode=disable", "sslmode=require")
  database_url_tls = can(regex("sslmode=", local.db_url_tls)) ? local.db_url_tls : "${local.db_url_tls}${can(regex("\\?", local.db_url_tls)) ? "&" : "?"}sslmode=require"

  # Secrets delivered through Container Apps `secret` entries (referenced with
  # secret_name) instead of plain env values. Optional ones are only created when set;
  # the key set is derived with nonsensitive() because for_each cannot take sensitive
  # input (only which keys are non-empty is revealed, never a value).
  optional_secret_env = {
    DIRECT_URL                 = var.postgres_direct_url
    PUBLIC_S3_ACCESS_KEY       = var.public_s3_access_key
    PUBLIC_S3_SECRET_KEY       = var.public_s3_secret_key
    CREDENTIAL_ENCRYPTION_KEY  = var.credential_encryption_key
    ADMIN_PASSWORD             = var.admin_password
    EMAIL_PASSWORD             = var.email_password
    CHARGEBEE_API_KEY          = var.chargebee_api_key
    CHARGEBEE_WEBHOOK_PASSWORD = var.chargebee_webhook_password
    PEXELS_API_KEY             = var.pexels_api_key
    PIXABAY_API_KEY            = var.pixabay_api_key
    GOOGLE_CLIENT_SECRET       = var.google_client_secret
    MICROSOFT_CLIENT_SECRET    = var.microsoft_client_secret
  }
  optional_secret_env_set = nonsensitive(toset([for k, v in local.optional_secret_env : k if v != ""]))
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
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name        = "BETTER_AUTH_SECRET"
        secret_name = "better-auth-secret"
      }

      env {
        name  = "BETTER_AUTH_URL"
        value = local.resolved_auth_url
      }

      env {
        name  = "FRONTEND_URL"
        value = local.resolved_frontend_url
      }

      # Same form-app base URL as FRONTEND_URL — magic-link/invitation emails
      # and the Google/Microsoft OAuth browser redirects read FORM_APP_URL.
      env {
        name  = "FORM_APP_URL"
        value = local.resolved_frontend_url
      }

      # Form-viewer base URL — used for the public form link in
      # form-published notification emails.
      env {
        name  = "FORM_VIEWER_URL"
        value = "https://${local.form_viewer_domain}"
      }

      # Every deployed environment is internet-facing, so it runs production behaviour
      # (generic errors, secure cookies, auth rate limiting). APP_ENV carries the
      # dev/staging/production name.
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "APP_ENV"
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
        name  = "EMAIL_FROM"
        value = var.email_from
      }

      env {
        name  = "CHARGEBEE_SITE"
        value = var.chargebee_site
      }

      env {
        name  = "RUN_SEED"
        value = var.run_seed ? "true" : "false"
      }

      env {
        name  = "SENTRY_DSN"
        value = var.sentry_dsn
      }

      // Both models use the Azure AI Services OpenAI-compatible endpoint (no api-version needed).
      env {
        name  = "AI_PRIMARY_BASE_URL"
        value = "https://${azurerm_cognitive_account.ai.custom_subdomain_name}.openai.azure.com/openai/v1"
      }

      env {
        name        = "AI_PRIMARY_API_KEY"
        secret_name = "ai-primary-api-key"
      }

      env {
        name  = "AI_PRIMARY_MODEL"
        value = var.ai_primary_model
      }

      env {
        name  = "AI_FAST_BASE_URL"
        value = "https://${azurerm_cognitive_account.ai.custom_subdomain_name}.openai.azure.com/openai/v1"
      }

      env {
        name        = "AI_FAST_API_KEY"
        secret_name = "ai-fast-api-key"
      }

      env {
        name  = "AI_FAST_MODEL"
        value = var.ai_fast_model
      }

      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }

      env {
        name  = "GOOGLE_REDIRECT_URI"
        value = "https://${local.service_domain}/api/integrations/google/callback"
      }

      env {
        name  = "MICROSOFT_CLIENT_ID"
        value = var.microsoft_client_id
      }

      env {
        name  = "MICROSOFT_REDIRECT_URI"
        value = "https://${local.service_domain}/api/integrations/microsoft/callback"
      }

      # Optional secrets (see local.optional_secret_env). ADMIN_PASSWORD is only used by
      # the one-time `admin:setup` script; CREDENTIAL_ENCRYPTION_KEY empty = encryption disabled.
      dynamic "env" {
        for_each = local.optional_secret_env_set
        content {
          name        = env.value
          secret_name = lower(replace(env.value, "_", "-"))
        }
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
      concurrent_requests = "10"
    }
  }

  secret {
    name  = "database-url"
    value = local.database_url_tls
  }

  secret {
    name  = "better-auth-secret"
    value = var.better_auth_secret
  }

  secret {
    name  = "ai-primary-api-key"
    value = azurerm_cognitive_account.ai.primary_access_key
  }

  secret {
    name  = "ai-fast-api-key"
    value = azurerm_cognitive_account.ai.primary_access_key
  }

  dynamic "secret" {
    for_each = local.optional_secret_env_set
    content {
      name  = lower(replace(secret.value, "_", "-"))
      value = local.optional_secret_env[secret.value]
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
