output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.mongodb.name
}

output "mongodb_fqdn" {
  description = "Fully qualified domain name of the MongoDB container app"
  value       = azurerm_container_app.mongodb.latest_revision_fqdn
  sensitive   = false
}

output "mongodb_connection_string" {
  description = "MongoDB connection string"
  value       = "mongodb://${var.mongodb_root_username}:${random_password.mongodb_root_password.result}@${azurerm_container_app.mongodb.latest_revision_fqdn}:27017/${var.mongodb_init_database}?authSource=admin"
  sensitive   = true
}

output "mongodb_root_password" {
  description = "MongoDB root password"
  value       = random_password.mongodb_root_password.result
  sensitive   = true
}

output "key_vault_name" {
  description = "Name of the Key Vault storing MongoDB credentials"
  value       = azurerm_key_vault.mongodb.name
}

output "key_vault_uri" {
  description = "URI of the Key Vault storing MongoDB credentials"
  value       = azurerm_key_vault.mongodb.vault_uri
}

output "storage_account_name" {
  description = "Name of the storage account for MongoDB data"
  value       = azurerm_storage_account.mongodb_data.name
}

output "container_app_environment_name" {
  description = "Name of the Container Apps Environment"
  value       = azurerm_container_app_environment.mongodb.name
}

output "log_analytics_workspace_name" {
  description = "Name of the Log Analytics Workspace"
  value       = azurerm_log_analytics_workspace.mongodb.name
}
