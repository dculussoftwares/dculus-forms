# Resource Group outputs
output "resource_group_name" {
  description = "Name of the resource group"
  value       = local.resource_group.name
}

output "resource_group_location" {
  description = "Location of the resource group"
  value       = local.resource_group.location
}

# Container Registry outputs
output "container_registry_name" {
  description = "Name of the container registry"
  value       = azurerm_container_registry.backend.name
}

output "container_registry_login_server" {
  description = "Login server URL for the container registry"
  value       = azurerm_container_registry.backend.login_server
}

output "container_registry_admin_username" {
  description = "Admin username for the container registry"
  value       = azurerm_container_registry.backend.admin_username
  sensitive   = true
}

output "container_registry_admin_password" {
  description = "Admin password for the container registry"
  value       = azurerm_container_registry.backend.admin_password
  sensitive   = true
}

# Container App outputs
output "backend_fqdn" {
  description = "Fully Qualified Domain Name of the backend container app"
  value       = azurerm_container_app.backend.latest_revision_fqdn
}

output "backend_url" {
  description = "Public URL of the backend API"
  value       = "https://${azurerm_container_app.backend.latest_revision_fqdn}"
}

output "graphql_endpoint" {
  description = "GraphQL endpoint URL"
  value       = "https://${azurerm_container_app.backend.latest_revision_fqdn}/graphql"
}

output "health_endpoint" {
  description = "Health check endpoint URL"
  value       = "https://${azurerm_container_app.backend.latest_revision_fqdn}/health"
}

# Key Vault outputs
output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = azurerm_key_vault.backend.name
}

output "key_vault_id" {
  description = "ID of the Key Vault"
  value       = azurerm_key_vault.backend.id
}

# Container App identity
output "container_app_identity_principal_id" {
  description = "Principal ID of the Container App managed identity"
  value       = azurerm_container_app.backend.identity[0].principal_id
}

output "container_app_identity_tenant_id" {
  description = "Tenant ID of the Container App managed identity"
  value       = azurerm_container_app.backend.identity[0].tenant_id
}

# Database connection (for reference)
output "mongodb_connection_string" {
  description = "MongoDB connection string (for reference only)"
  value       = "Retrieved from Key Vault: ${var.mongodb_key_vault_name}/mongodb-connection-string"
  sensitive   = true
}