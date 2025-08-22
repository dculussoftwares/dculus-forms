data "azurerm_subscription" "current" {}

# Resource Group for Cosmos DB
resource "azurerm_resource_group" "cosmos_db_rg" {
  name     = "${var.application_name}-cosmos-db-rg"
  location = var.location

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "MongoDB Cosmos DB"
  }
}

# Random suffix for globally unique naming
resource "random_integer" "suffix" {
  min = 1000
  max = 9999
}

# Timestamp for additional uniqueness
resource "time_static" "deployment_time" {}

locals {
  timestamp_suffix = substr(replace(time_static.deployment_time.unix, ".", ""), -4, -1)
}

# Azure Cosmos DB Account for MongoDB
resource "azurerm_cosmosdb_account" "mongodb_account" {
  name                      = "${var.application_name}-cosmos-${random_integer.suffix.result}${local.timestamp_suffix}"
  location                  = azurerm_resource_group.cosmos_db_rg.location
  resource_group_name       = azurerm_resource_group.cosmos_db_rg.name
  offer_type                = "Standard"
  kind                      = "MongoDB"
  enable_free_tier          = true
  enable_automatic_failover = false
  mongo_server_version      = "4.2"

  # Single region configuration for free tier
  geo_location {
    location          = azurerm_resource_group.cosmos_db_rg.location
    failover_priority = 0
  }

  consistency_policy {
    consistency_level       = "BoundedStaleness"
    max_interval_in_seconds = 300
    max_staleness_prefix    = 100000
  }

  # Network access configuration
  is_virtual_network_filter_enabled = false
  public_network_access_enabled     = true
  
  # Allow access from Azure services
  ip_range_filter = "0.0.0.0,104.42.195.92,40.76.54.131,52.176.6.30,52.169.50.45,52.187.184.26"

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "MongoDB Cosmos DB"
  }
}

# MongoDB Database
resource "azurerm_cosmosdb_mongo_database" "main_database" {
  name                = var.database_name
  resource_group_name = azurerm_resource_group.cosmos_db_rg.name
  account_name        = azurerm_cosmosdb_account.mongodb_account.name
  
  # Free tier: shared throughput of 400 RU/s
  throughput = 400
}

# Collections for the dculus-forms application
resource "azurerm_cosmosdb_mongo_collection" "forms" {
  name                = "forms"
  resource_group_name = azurerm_resource_group.cosmos_db_rg.name
  account_name        = azurerm_cosmosdb_account.mongodb_account.name
  database_name       = azurerm_cosmosdb_mongo_database.main_database.name

  default_ttl_seconds = -1
  shard_key          = "_id"

  index {
    keys   = ["_id"]
    unique = true
  }

  index {
    keys   = ["organizationId", "createdAt"]
    unique = false
  }
}

resource "azurerm_cosmosdb_mongo_collection" "responses" {
  name                = "responses"
  resource_group_name = azurerm_resource_group.cosmos_db_rg.name
  account_name        = azurerm_cosmosdb_account.mongodb_account.name
  database_name       = azurerm_cosmosdb_mongo_database.main_database.name

  default_ttl_seconds = -1
  shard_key          = "_id"

  index {
    keys   = ["_id"]
    unique = true
  }

  index {
    keys   = ["formId", "submittedAt"]
    unique = false
  }
}

resource "azurerm_cosmosdb_mongo_collection" "templates" {
  name                = "templates"
  resource_group_name = azurerm_resource_group.cosmos_db_rg.name
  account_name        = azurerm_cosmosdb_account.mongodb_account.name
  database_name       = azurerm_cosmosdb_mongo_database.main_database.name

  default_ttl_seconds = -1
  shard_key          = "_id"

  index {
    keys   = ["_id"]
    unique = true
  }

  index {
    keys   = ["category", "createdAt"]
    unique = false
  }
}

resource "azurerm_cosmosdb_mongo_collection" "organizations" {
  name                = "organizations"
  resource_group_name = azurerm_resource_group.cosmos_db_rg.name
  account_name        = azurerm_cosmosdb_account.mongodb_account.name
  database_name       = azurerm_cosmosdb_mongo_database.main_database.name

  default_ttl_seconds = -1
  shard_key          = "_id"

  index {
    keys   = ["_id"]
    unique = true
  }
}

resource "azurerm_cosmosdb_mongo_collection" "users" {
  name                = "users"
  resource_group_name = azurerm_resource_group.cosmos_db_rg.name
  account_name        = azurerm_cosmosdb_account.mongodb_account.name
  database_name       = azurerm_cosmosdb_mongo_database.main_database.name

  default_ttl_seconds = -1
  shard_key          = "_id"

  index {
    keys   = ["_id"]
    unique = true
  }

  index {
    keys   = ["email"]
    unique = true
  }
}