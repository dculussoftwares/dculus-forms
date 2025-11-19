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
}

provider "azurerm" {
  features {}
}

provider "random" {}

locals {
  resource_group_name      = var.postgres_resource_group_name != "" ? var.postgres_resource_group_name : "${var.project_name}-${var.environment}-postgres-rg"
  postgres_server_name     = "${var.project_name}-${var.environment}-backend-database"
  postgres_admin_principal = "${var.postgres_admin_username}@${local.postgres_server_name}"
  enable_high_availability = lower(var.postgres_high_availability_mode) != "disabled"
  resolved_admin_password  = var.postgres_admin_password != "" ? var.postgres_admin_password : random_password.admin.result
}

resource "azurerm_resource_group" "postgres" {
  name     = local.resource_group_name
  location = var.location
  tags = merge(var.tags, {
    Environment = var.environment
  })
}

resource "random_password" "admin" {
  length           = 24
  min_lower        = 2
  min_upper        = 2
  min_numeric      = 2
  min_special      = 2
  special          = true
  override_special = "!@#$%&*-_=+?"
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                          = local.postgres_server_name
  location                      = var.location
  resource_group_name           = azurerm_resource_group.postgres.name
  administrator_login           = var.postgres_admin_username
  administrator_password        = local.resolved_admin_password
  version                       = var.postgres_version
  sku_name                      = var.postgres_sku_name
  storage_mb                    = var.postgres_storage_gb * 1024
  backup_retention_days         = var.postgres_backup_retention_days
  geo_redundant_backup_enabled  = var.postgres_geo_redundant_backup_enabled
  public_network_access_enabled = true

  dynamic "high_availability" {
    for_each = local.enable_high_availability ? [var.postgres_high_availability_mode] : []
    content {
      mode                      = high_availability.value
      standby_availability_zone = var.postgres_high_availability_standby_zone != "" ? var.postgres_high_availability_standby_zone : null
    }
  }

  tags = merge(var.tags, {
    Environment = var.environment
  })
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = var.postgres_database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_all" {
  name             = "allow-from-anywhere"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = var.postgres_firewall_allow_all ? "0.0.0.0" : var.postgres_firewall_start_ip
  end_ip_address   = var.postgres_firewall_allow_all ? "255.255.255.255" : var.postgres_firewall_end_ip
}
