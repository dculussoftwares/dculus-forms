output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.mongodb_backend.name
}

output "resource_group_id" {
  description = "ID of the created resource group"
  value       = azurerm_resource_group.mongodb_backend.id
}

output "location" {
  description = "Location of the resource group"
  value       = azurerm_resource_group.mongodb_backend.location
}

output "mongodb_container_app_name" {
  description = "Name of the MongoDB Container App"
  value       = azurerm_container_app.mongodb.name
}

output "mongodb_container_app_fqdn" {
  description = "FQDN of the MongoDB Container App"
  value       = azurerm_container_app.mongodb.latest_revision_fqdn
}

output "container_app_environment_id" {
  description = "ID of the Container App Environment"
  value       = azurerm_container_app_environment.mongodb_environment.id
}

output "mongodb_connection_string" {
  description = "MongoDB connection string for internal access"
  value       = "mongodb://admin:${var.mongodb_admin_password}@${azurerm_container_app.mongodb.name}.${azurerm_container_app_environment.mongodb_environment.default_domain}:27017/dculus-forms?authSource=admin"
  sensitive   = true
}

output "mongodb_internal_endpoint" {
  description = "Internal MongoDB endpoint for Container Apps in the same environment"
  value       = "${azurerm_container_app.mongodb.name}.${azurerm_container_app_environment.mongodb_environment.default_domain}:27017"
}

output "storage_account_name" {
  description = "Name of the storage account for MongoDB data"
  value       = azurerm_storage_account.mongodb_storage.name
}

output "nfs_share_name" {
  description = "Name of the NFS share for MongoDB data"
  value       = azurerm_storage_share.mongodb_data.name
}

output "virtual_network_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.mongodb_vnet.name
}