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
    container_name       = "backend-container-app-deployment"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

# Data sources to reference existing MongoDB infrastructure
data "azurerm_resource_group" "mongodb" {
  name = var.mongodb_resource_group_name
}

data "azurerm_container_app_environment" "mongodb" {
  name                = var.mongodb_container_app_environment_name
  resource_group_name = data.azurerm_resource_group.mongodb.name
}

data "azurerm_key_vault" "mongodb" {
  name                = var.mongodb_key_vault_name
  resource_group_name = data.azurerm_resource_group.mongodb.name
}

data "azurerm_key_vault_secret" "mongodb_connection_string" {
  name         = "mongodb-connection-string"
  key_vault_id = data.azurerm_key_vault.mongodb.id
}

# Random secrets for the backend
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "random_password" "better_auth_secret" {
  length  = 64
  special = true
}

# Resource Group for backend (or use existing)
resource "azurerm_resource_group" "backend" {
  count    = var.create_resource_group ? 1 : 0
  name     = var.resource_group_name
  location = var.location

  tags = var.common_tags
}

# Use existing resource group if not creating new one
data "azurerm_resource_group" "backend" {
  count = var.create_resource_group ? 0 : 1
  name  = var.resource_group_name
}

locals {
  resource_group = var.create_resource_group ? azurerm_resource_group.backend[0] : data.azurerm_resource_group.backend[0]
}

# Container Registry for backend images
resource "azurerm_container_registry" "backend" {
  name                = "${replace(var.prefix, "-", "")}backendcr"
  resource_group_name = local.resource_group.name
  location            = local.resource_group.location
  sku                 = "Basic"
  admin_enabled       = true

  tags = var.common_tags
}

# Key Vault for backend secrets
resource "azurerm_key_vault" "backend" {
  name                = "${var.prefix}-backend-kv"
  location            = local.resource_group.location
  resource_group_name = local.resource_group.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  purge_protection_enabled = false

  tags = var.common_tags
}

# Key Vault access policy
resource "azurerm_key_vault_access_policy" "backend" {
  key_vault_id = azurerm_key_vault.backend.id
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

# Store backend secrets in Key Vault
resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = random_password.jwt_secret.result
  key_vault_id = azurerm_key_vault.backend.id

  depends_on = [azurerm_key_vault_access_policy.backend]

  tags = var.common_tags
}

resource "azurerm_key_vault_secret" "better_auth_secret" {
  name         = "better-auth-secret"
  value        = random_password.better_auth_secret.result
  key_vault_id = azurerm_key_vault.backend.id

  depends_on = [azurerm_key_vault_access_policy.backend]

  tags = var.common_tags
}

# Store Cloudflare R2 secrets (if provided)
resource "azurerm_key_vault_secret" "cloudflare_r2_access_key" {
  count        = var.cloudflare_r2_access_key != "" ? 1 : 0
  name         = "cloudflare-r2-access-key"
  value        = var.cloudflare_r2_access_key
  key_vault_id = azurerm_key_vault.backend.id

  depends_on = [azurerm_key_vault_access_policy.backend]

  tags = var.common_tags
}

resource "azurerm_key_vault_secret" "cloudflare_r2_secret_key" {
  count        = var.cloudflare_r2_secret_key != "" ? 1 : 0
  name         = "cloudflare-r2-secret-key"
  value        = var.cloudflare_r2_secret_key
  key_vault_id = azurerm_key_vault.backend.id

  depends_on = [azurerm_key_vault_access_policy.backend]

  tags = var.common_tags
}

# Container App for backend
resource "azurerm_container_app" "backend" {
  name                         = "${var.prefix}-backend"
  container_app_environment_id = data.azurerm_container_app_environment.mongodb.id
  resource_group_name          = local.resource_group.name
  revision_mode                = "Single"

  identity {
    type = "SystemAssigned"
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "backend"
      image  = var.backend_image
      cpu    = var.backend_cpu
      memory = var.backend_memory

      # Core application environment variables
      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "PORT"
        value = "4000"
      }

      env {
        name  = "BASE_URL"
        value = "https://dculus-backend.placeholder.com"
      }

      # Database connection
      env {
        name        = "DATABASE_URL"
        secret_name = "mongodb-connection-string"
      }

      # Authentication secrets
      env {
        name        = "JWT_SECRET"
        secret_name = "jwt-secret"
      }

      env {
        name  = "JWT_EXPIRES_IN"
        value = "7d"
      }

      env {
        name        = "BETTER_AUTH_SECRET"
        secret_name = "better-auth-secret"
      }

      env {
        name  = "BETTER_AUTH_URL"
        value = "https://dculus-backend.placeholder.com"
      }

      # Cloudflare R2 configuration (if provided)
      dynamic "env" {
        for_each = var.cloudflare_r2_access_key != "" ? [1] : []
        content {
          name        = "CLOUDFLARE_R2_ACCESS_KEY"
          secret_name = "cloudflare-r2-access-key"
        }
      }

      dynamic "env" {
        for_each = var.cloudflare_r2_secret_key != "" ? [1] : []
        content {
          name        = "CLOUDFLARE_R2_SECRET_KEY"
          secret_name = "cloudflare-r2-secret-key"
        }
      }

      env {
        name  = "CLOUDFLARE_R2_ENDPOINT"
        value = var.cloudflare_r2_endpoint
      }

      env {
        name  = "CLOUDFLARE_R2_PRIVATE_BUCKET_NAME"
        value = var.cloudflare_r2_private_bucket_name
      }

      env {
        name  = "CLOUDFLARE_R2_PUBLIC_BUCKET_NAME"
        value = var.cloudflare_r2_public_bucket_name
      }
    }
  }

  # Secrets for the container app
  secret {
    name  = "mongodb-connection-string"
    value = data.azurerm_key_vault_secret.mongodb_connection_string.value
  }

  secret {
    name  = "jwt-secret"
    value = random_password.jwt_secret.result
  }

  secret {
    name  = "better-auth-secret"
    value = random_password.better_auth_secret.result
  }

  dynamic "secret" {
    for_each = var.cloudflare_r2_access_key != "" ? [1] : []
    content {
      name  = "cloudflare-r2-access-key"
      value = var.cloudflare_r2_access_key
    }
  }

  dynamic "secret" {
    for_each = var.cloudflare_r2_secret_key != "" ? [1] : []
    content {
      name  = "cloudflare-r2-secret-key"
      value = var.cloudflare_r2_secret_key
    }
  }

  # Ingress configuration
  ingress {
    external_enabled = true
    target_port      = 4000
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = var.common_tags
}

# Grant the Container App managed identity access to Key Vault
resource "azurerm_key_vault_access_policy" "backend_container_app" {
  key_vault_id = azurerm_key_vault.backend.id
  tenant_id    = azurerm_container_app.backend.identity[0].tenant_id
  object_id    = azurerm_container_app.backend.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]

  depends_on = [azurerm_container_app.backend]
}

# Data source for current Azure configuration
data "azurerm_client_config" "current" {}