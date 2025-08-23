terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }

  backend "azurerm" {
    resource_group_name  = "dculus-global-terraform-assets-resource-grp"
    storage_account_name = "dculusterraformstates"
    container_name       = "dculus-backend-deployment"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
  use_oidc = true
}

resource "azurerm_resource_group" "dculus_backend" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
    CreatedBy   = "github-actions"
    Purpose     = "backend-infrastructure"
  }
}

# Random ID for unique resource names
resource "random_id" "unique_suffix" {
  byte_length = 4
}

# Data source for current client configuration
data "azurerm_client_config" "current" {}

# Log Analytics Workspace for monitoring
resource "azurerm_log_analytics_workspace" "dculus_logs" {
  name                = "dculus-logs-${random_id.unique_suffix.hex}"
  location            = azurerm_resource_group.dculus_backend.location
  resource_group_name = azurerm_resource_group.dculus_backend.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
  }
}

# Key Vault for storing secrets
resource "azurerm_key_vault" "dculus_secrets" {
  name                = "dculus-secrets-${random_id.unique_suffix.hex}"
  location            = azurerm_resource_group.dculus_backend.location
  resource_group_name = azurerm_resource_group.dculus_backend.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  # Allow Container Apps to access secrets
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get",
      "Set",
      "List",
      "Delete",
    ]
  }

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
  }
}

# Store secrets in Key Vault
resource "azurerm_key_vault_secret" "mongodb_admin_password" {
  name         = "mongodb-admin-password"
  value        = var.mongodb_admin_password
  key_vault_id = azurerm_key_vault.dculus_secrets.id
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = var.jwt_secret
  key_vault_id = azurerm_key_vault.dculus_secrets.id
}

resource "azurerm_key_vault_secret" "better_auth_secret" {
  name         = "better-auth-secret"
  value        = var.better_auth_secret
  key_vault_id = azurerm_key_vault.dculus_secrets.id
}

resource "azurerm_key_vault_secret" "cloudflare_r2_access_key" {
  count        = var.cloudflare_r2_access_key != "" ? 1 : 0
  name         = "cloudflare-r2-access-key"
  value        = var.cloudflare_r2_access_key
  key_vault_id = azurerm_key_vault.dculus_secrets.id
}

resource "azurerm_key_vault_secret" "cloudflare_r2_secret_key" {
  count        = var.cloudflare_r2_secret_key != "" ? 1 : 0
  name         = "cloudflare-r2-secret-key"
  value        = var.cloudflare_r2_secret_key
  key_vault_id = azurerm_key_vault.dculus_secrets.id
}

resource "azurerm_key_vault_secret" "database_url" {
  name         = "database-url"
  value        = "mongodb://${var.mongodb_admin_username}:${var.mongodb_admin_password}@${azurerm_container_app.mongodb.name}:27017/dculus_forms?authSource=admin"
  key_vault_id = azurerm_key_vault.dculus_secrets.id
  depends_on   = [azurerm_container_app.mongodb]
}

# Placeholder secrets for URLs (will be updated after backend deployment)
resource "azurerm_key_vault_secret" "better_auth_url" {
  name         = "better-auth-url"
  value        = "https://placeholder.azurecontainerapps.io"
  key_vault_id = azurerm_key_vault.dculus_secrets.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "azurerm_key_vault_secret" "base_url" {
  name         = "base-url"
  value        = "https://placeholder.azurecontainerapps.io"
  key_vault_id = azurerm_key_vault.dculus_secrets.id

  lifecycle {
    ignore_changes = [value]
  }
}

# Container App Environment
resource "azurerm_container_app_environment" "dculus_env" {
  name                       = "dculus-containerapp-env-${random_id.unique_suffix.hex}"
  location                   = azurerm_resource_group.dculus_backend.location
  resource_group_name        = azurerm_resource_group.dculus_backend.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.dculus_logs.id

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
  }
}

# MongoDB Container App (Internal only)
resource "azurerm_container_app" "mongodb" {
  name                         = "dculus-mongodb-${random_id.unique_suffix.hex}"
  container_app_environment_id = azurerm_container_app_environment.dculus_env.id
  resource_group_name          = azurerm_resource_group.dculus_backend.name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 1

    volume {
      name         = "mongodb-data"
      storage_type = "AzureFile"
      storage_name = azurerm_container_app_environment_storage.mongodb_storage.name
    }

    container {
      name   = "mongodb"
      image  = "mongo:7.0"
      cpu    = 1.0
      memory = "2Gi"

      volume_mounts {
        name = "mongodb-data"
        path = "/data/db"
      }

      args = ["--replSet", "rs0", "--bind_ip_all"]

      env {
        name  = "MONGO_INITDB_ROOT_USERNAME"
        value = var.mongodb_admin_username
      }

      env {
        name        = "MONGO_INITDB_ROOT_PASSWORD"
        secret_name = "mongodb-admin-password"
      }

      startup_probe {
        transport = "TCP"
        port      = 27017
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
  }

  # Internal ingress only (not accessible from internet)
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

  secret {
    name                = "mongodb-admin-password"
    key_vault_secret_id = azurerm_key_vault_secret.mongodb_admin_password.id
    identity            = azurerm_user_assigned_identity.container_apps_identity.id
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.container_apps_identity.id]
  }

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
  }
}

# Backend Container App (Public)
resource "azurerm_container_app" "backend" {
  name                         = "dculus-backend-${random_id.unique_suffix.hex}"
  container_app_environment_id = azurerm_container_app_environment.dculus_env.id
  resource_group_name          = azurerm_resource_group.dculus_backend.name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "backend"
      image  = "dculus/forms-backend:latest"
      cpu    = 1.0
      memory = "2Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name        = "JWT_SECRET"
        secret_name = "jwt-secret"
      }

      env {
        name        = "BETTER_AUTH_SECRET"
        secret_name = "better-auth-secret"
      }

      env {
        name        = "BETTER_AUTH_URL"
        secret_name = "better-auth-url"
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
        name        = "BASE_URL"
        secret_name = "base-url"
      }

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

      dynamic "env" {
        for_each = var.cloudflare_r2_endpoint != "" ? [1] : []
        content {
          name  = "CLOUDFLARE_R2_ENDPOINT"
          value = var.cloudflare_r2_endpoint
        }
      }

      dynamic "env" {
        for_each = var.cloudflare_r2_private_bucket != "" ? [1] : []
        content {
          name  = "CLOUDFLARE_R2_PRIVATE_BUCKET_NAME"
          value = var.cloudflare_r2_private_bucket
        }
      }

      dynamic "env" {
        for_each = var.cloudflare_r2_public_bucket != "" ? [1] : []
        content {
          name  = "CLOUDFLARE_R2_PUBLIC_BUCKET_NAME"
          value = var.cloudflare_r2_public_bucket
        }
      }

      startup_probe {
        transport = "HTTP"
        port      = 4000
        path      = "/health"
      }

      liveness_probe {
        transport = "HTTP"
        port      = 4000
        path      = "/health"
      }

      readiness_probe {
        transport = "HTTP"
        port      = 4000
        path      = "/health"
      }
    }
  }

  # Public ingress
  ingress {
    allow_insecure_connections = false
    external_enabled           = true
    target_port                = 4000

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  secret {
    name                = "jwt-secret"
    key_vault_secret_id = azurerm_key_vault_secret.jwt_secret.id
    identity            = azurerm_user_assigned_identity.container_apps_identity.id
  }

  secret {
    name                = "better-auth-secret"
    key_vault_secret_id = azurerm_key_vault_secret.better_auth_secret.id
    identity            = azurerm_user_assigned_identity.container_apps_identity.id
  }

  secret {
    name                = "mongodb-admin-password"
    key_vault_secret_id = azurerm_key_vault_secret.mongodb_admin_password.id
    identity            = azurerm_user_assigned_identity.container_apps_identity.id
  }

  secret {
    name                = "database-url"
    key_vault_secret_id = azurerm_key_vault_secret.database_url.id
    identity            = azurerm_user_assigned_identity.container_apps_identity.id
  }

  secret {
    name                = "better-auth-url"
    key_vault_secret_id = azurerm_key_vault_secret.better_auth_url.id
    identity            = azurerm_user_assigned_identity.container_apps_identity.id
  }

  secret {
    name                = "base-url"
    key_vault_secret_id = azurerm_key_vault_secret.base_url.id
    identity            = azurerm_user_assigned_identity.container_apps_identity.id
  }

  dynamic "secret" {
    for_each = var.cloudflare_r2_access_key != "" ? [1] : []
    content {
      name                = "cloudflare-r2-access-key"
      key_vault_secret_id = azurerm_key_vault_secret.cloudflare_r2_access_key[0].id
      identity            = azurerm_user_assigned_identity.container_apps_identity.id
    }
  }

  dynamic "secret" {
    for_each = var.cloudflare_r2_secret_key != "" ? [1] : []
    content {
      name                = "cloudflare-r2-secret-key"
      key_vault_secret_id = azurerm_key_vault_secret.cloudflare_r2_secret_key[0].id
      identity            = azurerm_user_assigned_identity.container_apps_identity.id
    }
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.container_apps_identity.id]
  }

  depends_on = [azurerm_container_app.mongodb]

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
  }
}

# User-assigned managed identity for Key Vault access
resource "azurerm_user_assigned_identity" "container_apps_identity" {
  name                = "dculus-containerapp-identity-${random_id.unique_suffix.hex}"
  location            = azurerm_resource_group.dculus_backend.location
  resource_group_name = azurerm_resource_group.dculus_backend.name

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
  }
}

# Key Vault access policy for the managed identity
resource "azurerm_key_vault_access_policy" "container_apps_policy" {
  key_vault_id = azurerm_key_vault.dculus_secrets.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.container_apps_identity.principal_id

  secret_permissions = [
    "Get",
  ]
}

# Storage for MongoDB persistent data
resource "azurerm_container_app_environment_storage" "mongodb_storage" {
  name                         = "mongodb-storage"
  container_app_environment_id = azurerm_container_app_environment.dculus_env.id
  account_name                 = azurerm_storage_account.dculus_storage.name
  share_name                   = azurerm_storage_share.mongodb_share.name
  access_key                   = azurerm_storage_account.dculus_storage.primary_access_key
  access_mode                  = "ReadWrite"
}

# Storage account for persistent volumes
resource "azurerm_storage_account" "dculus_storage" {
  name                     = "dculusstorage${random_id.unique_suffix.hex}"
  resource_group_name      = azurerm_resource_group.dculus_backend.name
  location                 = azurerm_resource_group.dculus_backend.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = {
    Environment = "production"
    Project     = "dculus-forms"
    ManagedBy   = "terraform"
  }
}

# File share for MongoDB data
resource "azurerm_storage_share" "mongodb_share" {
  name                 = "mongodb-data"
  storage_account_name = azurerm_storage_account.dculus_storage.name
  quota                = 10
}