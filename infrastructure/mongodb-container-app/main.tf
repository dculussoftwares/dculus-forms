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


# Container Apps Environment with 2025 features (minimal setup)
resource "azurerm_container_app_environment" "mongodb_env" {
  name                = "${var.application_name}-env-${local.unique_suffix}"
  location            = azurerm_resource_group.mongodb_rg.location
  resource_group_name = azurerm_resource_group.mongodb_rg.name
  
  # Optional workload profile for dedicated compute
  dynamic "workload_profile" {
    for_each = var.workload_profile_type != "Consumption" ? [1] : []
    content {
      name                  = "database-workload"
      workload_profile_type = var.workload_profile_type
      minimum_count         = 1
      maximum_count         = var.max_workload_instances
    }
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
    Version     = "2025"
    Workload    = "MongoDB Database"
  }
}

# Storage Account for MongoDB data persistence
resource "azurerm_storage_account" "mongodb_storage" {
  name                     = "mongodbstorage${local.unique_suffix}"
  resource_group_name      = azurerm_resource_group.mongodb_rg.name
  location                 = azurerm_resource_group.mongodb_rg.location
  account_tier             = "Standard"
  account_replication_type = "ZRS"  # Zone-redundant storage for better availability
  
  # Enhanced security features
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = true
  
  # Enable blob properties for better management
  blob_properties {
    versioning_enabled       = true
    change_feed_enabled     = true
    delete_retention_policy {
      days = var.backup_retention_days
    }
    container_delete_retention_policy {
      days = var.backup_retention_days
    }
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "MongoDB Data Storage"
  }
}

# File Share for MongoDB data
resource "azurerm_storage_share" "mongodb_data" {
  name                 = "mongodb-data"
  storage_account_name = azurerm_storage_account.mongodb_storage.name
  quota                = var.storage_size_gb

  depends_on = [azurerm_storage_account.mongodb_storage]
}


# Container App for MongoDB with 2025 enhanced features
resource "azurerm_container_app" "mongodb" {
  name                         = "${var.application_name}-${local.unique_suffix}"
  container_app_environment_id = azurerm_container_app_environment.mongodb_env.id
  resource_group_name          = azurerm_resource_group.mongodb_rg.name
  revision_mode                = "Single"
  workload_profile_name        = var.workload_profile_type != "Consumption" ? "database-workload" : null

  template {
    min_replicas    = var.min_replicas
    max_replicas    = var.max_replicas
    revision_suffix = "v2025-datagrip"

    # Volume for persistent storage (using EmptyDir for now to avoid Azure Files permission issues)
    volume {
      name         = "mongodb-storage"
      storage_type = "EmptyDir"
    }


    container {
      name   = "mongodb"
      image  = "mongo:8.0"  # Latest MongoDB 8.0 for 2025
      cpu    = var.container_cpu
      memory = var.container_memory

      # Mount storage volume
      volume_mounts {
        name = "mongodb-storage"
        path = "/data/db"
      }

      # MongoDB root user (like VM admin user)
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


      # Optimized MongoDB configuration for Container Apps
      args = [
        "--bind_ip_all",
        "--auth",
        "--storageEngine", "wiredTiger",
        "--wiredTigerCacheSizeGB", "1"
      ]

    }

  }

  # Ingress configuration - internal by default for security
  ingress {
    external_enabled = var.enable_external_access
    target_port      = var.mongodb_port
    transport        = "tcp"  # Force TCP transport for MongoDB

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }


  tags = {
    Environment = var.environment
    Application = var.application_name
    Version     = "7.0"
    Purpose     = "MongoDB Database"
  }

  depends_on = [azurerm_container_app_environment_storage.mongodb_storage]
}

# Network Security Group for additional security (if external access is enabled)
resource "azurerm_network_security_group" "mongodb_nsg" {
  count               = var.enable_external_access ? 1 : 0
  name                = "${var.application_name}-nsg-${local.unique_suffix}"
  location            = azurerm_resource_group.mongodb_rg.location
  resource_group_name = azurerm_resource_group.mongodb_rg.name

  # Allow MongoDB traffic only from specific sources
  security_rule {
    name                       = "MongoDB-Inbound"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "27017"
    source_address_prefix      = "*"  # Restrict this to your application's IP range in production
    destination_address_prefix = "*"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllInbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "MongoDB Security"
  }
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


