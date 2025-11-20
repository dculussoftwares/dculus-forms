terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Backend configuration is loaded from environment-specific backend.tf files
  # See: environments/{dev,staging,production}/backend.tf
}

provider "azurerm" {
  features {}
}

# Locals for resource naming
locals {
  resource_group_name = "dculus-forms-${var.environment}-postgres-rg"
  database_name       = "dculus-forms-${var.environment}-backend-database"
  server_name         = "dculus-forms-${var.environment}-pg-server"
}

# Generate random password (always create, but may not be used)
# Use alphanumeric only to avoid URL encoding issues in connection strings
resource "random_password" "admin_password" {
  length  = 32
  special = false # Avoid special characters that cause connection string issues
  upper   = true
  lower   = true
  numeric = true
}

# Determine the admin password
# Use provided password if not empty, otherwise use generated one
# Note: Both passwords will be sensitive, final value inherits sensitivity
locals {
  use_provided_password   = var.admin_password != ""
  resolved_admin_password = local.use_provided_password ? var.admin_password : random_password.admin_password.result
}

# Resource Group for PostgreSQL
resource "azurerm_resource_group" "postgres" {
  name     = local.resource_group_name
  location = var.location

  tags = {
    Environment = var.environment
    Project     = "dculus-forms"
    ManagedBy   = "Terraform"
  }
}

# Azure PostgreSQL Flexible Server - BURSTABLE (lowest cost tier)
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = local.server_name
  resource_group_name    = azurerm_resource_group.postgres.name
  location               = azurerm_resource_group.postgres.location
  version                = "16"
  administrator_login    = var.admin_username
  administrator_password = local.resolved_admin_password

  # BURSTABLE SKU - Lowest cost option
  # B1ms: 1 vCore, 2 GiB RAM, burstable compute
  sku_name = "B_Standard_B1ms"

  # Storage - Minimum 32 GiB for flexible server
  storage_mb   = 32768
  storage_tier = "P4"

  # Backup configuration - Minimum retention
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false

  # High Availability - DISABLED for cost savings (omit block to disable)
  # Only enable in production if needed by adding:
  # high_availability {
  #   mode = "ZoneRedundant" or "SameZone"
  # }

  # Zone - Not specified for burstable tier (zone redundancy not supported)
  # zone = null

  tags = {
    Environment = var.environment
    Project     = "dculus-forms"
    ManagedBy   = "Terraform"
    CostTier    = "Minimal"
  }

  lifecycle {
    prevent_destroy = false
  }
}

# Firewall rule to allow Azure services
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Firewall rule to allow all IPs (for development/testing)
# IMPORTANT: Remove or restrict this in production!
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_all" {
  count            = var.allow_public_access ? 1 : 0
  name             = "allow-all-ips"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "255.255.255.255"
}

# PostgreSQL Configuration - Optimize for low resource usage
resource "azurerm_postgresql_flexible_server_configuration" "max_connections" {
  name      = "max_connections"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "50"
}

resource "azurerm_postgresql_flexible_server_configuration" "shared_buffers" {
  name      = "shared_buffers"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "16384" # 128MB in 8KB pages
}

# Database
resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = local.database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}
