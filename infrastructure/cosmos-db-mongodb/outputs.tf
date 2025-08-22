# Cosmos DB Account outputs
output "cosmosdb_account_name" {
  value       = azurerm_cosmosdb_account.mongodb_account.name
  description = "The name of the Cosmos DB account"
}

output "cosmosdb_account_id" {
  value       = azurerm_cosmosdb_account.mongodb_account.id
  description = "The ID of the Cosmos DB account"
}

output "cosmosdb_endpoint" {
  value       = azurerm_cosmosdb_account.mongodb_account.endpoint
  description = "The endpoint URL for the Cosmos DB account"
}

# MongoDB connection strings
output "mongodb_connection_string_primary" {
  value       = azurerm_cosmosdb_account.mongodb_account.connection_strings[0]
  description = "Primary MongoDB connection string"
  sensitive   = true
}

output "mongodb_connection_string_secondary" {
  value       = azurerm_cosmosdb_account.mongodb_account.connection_strings[1]
  description = "Secondary MongoDB connection string"
  sensitive   = true
}

# Database information
output "database_name" {
  value       = azurerm_cosmosdb_mongo_database.main_database.name
  description = "The name of the MongoDB database"
}

# Resource Group information
output "resource_group_name" {
  value       = azurerm_resource_group.cosmos_db_rg.name
  description = "The name of the resource group containing the Cosmos DB"
}

output "resource_group_location" {
  value       = azurerm_resource_group.cosmos_db_rg.location
  description = "The location of the resource group"
}

# Collection names
output "collections" {
  value = {
    forms         = azurerm_cosmosdb_mongo_collection.forms.name
    responses     = azurerm_cosmosdb_mongo_collection.responses.name
    templates     = azurerm_cosmosdb_mongo_collection.templates.name
    organizations = azurerm_cosmosdb_mongo_collection.organizations.name
    users         = azurerm_cosmosdb_mongo_collection.users.name
  }
  description = "Map of collection names"
}

# Environment configuration for applications
output "database_url" {
  value       = "mongodb://${azurerm_cosmosdb_account.mongodb_account.name}:${azurerm_cosmosdb_account.mongodb_account.primary_key}@${azurerm_cosmosdb_account.mongodb_account.name}.mongo.cosmos.azure.com:10255/${azurerm_cosmosdb_mongo_database.main_database.name}?ssl=true&retrywrites=false&replicaSet=globaldb&maxIdleTimeMS=120000&appName=@${azurerm_cosmosdb_account.mongodb_account.name}@"
  description = "Complete MongoDB connection URL for applications"
  sensitive   = true
}