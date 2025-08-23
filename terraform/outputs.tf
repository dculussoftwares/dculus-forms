output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.dculus_backend.name
}

output "resource_group_id" {
  description = "ID of the created resource group"
  value       = azurerm_resource_group.dculus_backend.id
}

output "location" {
  description = "Location of the resource group"
  value       = azurerm_resource_group.dculus_backend.location
}

output "backend_url" {
  description = "Backend application URL"
  value       = "https://${azurerm_container_app.backend.latest_revision_fqdn}"
}

output "mongodb_connection_string" {
  description = "MongoDB connection string for internal use"
  value       = "mongodb://${var.mongodb_admin_username}:${var.mongodb_admin_password}@${azurerm_container_app.mongodb.name}:27017/dculus_forms?authSource=admin"
  sensitive   = true
}

output "container_app_environment_name" {
  description = "Name of the Container App Environment"
  value       = azurerm_container_app_environment.dculus_env.name
}

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = azurerm_key_vault.dculus_secrets.name
}

output "mongodb_container_app_name" {
  description = "Name of the MongoDB Container App"
  value       = azurerm_container_app.mongodb.name
}

output "backend_container_app_name" {
  description = "Name of the Backend Container App"
  value       = azurerm_container_app.backend.name
}