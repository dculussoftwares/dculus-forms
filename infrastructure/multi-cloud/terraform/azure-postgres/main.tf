terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

locals {
  resource_group_name        = var.postgres_resource_group_name != "" ? var.postgres_resource_group_name : "${var.project_name}-${var.environment}-postgres-rg"
  postgres_server_name      = "${var.project_name}-${var.environment}-backend-database"
  postgres_admin_principal  = "${var.postgres_admin_username}@${local.postgres_server_name}"
}

resource "azurerm_resource_group" "postgres" {
  name     = local.resource_group_name
  location = var.location
  tags     = merge(var.tags, {
    Environment = var.environment
  })
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                = local.postgres_server_name
  location            = var.location
  resource_group_name = azurerm_resource_group.postgres.name
  administrator_login = var.postgres_admin_username
  administrator_password = var.postgres_admin_password
  version             = var.postgres_version
  sku_name            = var.postgres_sku_name
  tier                = var.postgres_sku_tier
  storage_mb          = var.postgres_storage_gb * 1024
  backup_retention_days = var.postgres_backup_retention_days
  geo_redundant_backup = var.postgres_geo_redundant_backup
  high_availability_mode = var.postgres_high_availability_mode
  public_network_access_enabled = true
  ssl_enforcement_enabled = true
  tags = merge(var.tags, {
    Environment = var.environment
  })
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name        = var.postgres_database_name
  server_name = azurerm_postgresql_flexible_server.main.name
  resource_group_name = data.azurerm_resource_group.backend.name
  charset     = "UTF8"
  collation   = "English_United States.1252"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_all" {
  name                = "allow-from-anywhere"
  server_name         = azurerm_postgresql_flexible_server.main.name
  resource_group_name = data.azurerm_resource_group.backend.name
  start_ip_address    = var.postgres_firewall_allow_all ? "0.0.0.0" : var.postgres_firewall_start_ip
  end_ip_address      = var.postgres_firewall_allow_all ? "255.255.255.255" : var.postgres_firewall_end_ip
}
