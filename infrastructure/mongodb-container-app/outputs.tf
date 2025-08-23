output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.mongodb_rg.name
}

output "container_app_name" {
  description = "Name of the MongoDB container app"
  value       = azurerm_container_app.mongodb.name
}

output "mongodb_fqdn" {
  description = "Fully qualified domain name for MongoDB access"
  value       = azurerm_container_app.mongodb.latest_revision_fqdn
}

output "mongodb_url" {
  description = "MongoDB connection URL"
  value       = "https://${azurerm_container_app.mongodb.latest_revision_fqdn}"
}

output "mongodb_port" {
  description = "MongoDB port"
  value       = var.mongodb_port
}

output "mongodb_connection_string_root" {
  description = "MongoDB root connection string"
  value       = "mongodb://admin:${var.mongodb_root_password}@${azurerm_container_app.mongodb.latest_revision_fqdn}:${var.mongodb_port}/admin"
  sensitive   = true
}

output "mongodb_connection_string_app" {
  description = "MongoDB application connection string"
  value       = "mongodb://admin:${var.mongodb_root_password}@${azurerm_container_app.mongodb.latest_revision_fqdn}:${var.mongodb_port}/dculus_forms"
  sensitive   = true
}

output "storage_account_name" {
  description = "Name of the storage account for persistence"
  value       = azurerm_storage_account.mongodb_storage.name
}

output "container_app_environment_name" {
  description = "Name of the Container Apps environment"
  value       = azurerm_container_app_environment.mongodb_env.name
}

output "log_analytics_workspace_name" {
  description = "Name of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.mongodb_logs.name
}

output "connection_instructions" {
  description = "MongoDB connection instructions for Container Apps"
  value       = <<-EOT
    === MongoDB Container App Connection Details ===
    
    🔗 MongoDB Access URL: https://${azurerm_container_app.mongodb.latest_revision_fqdn}
    🔗 MongoDB Port: ${var.mongodb_port}
    
    📝 Connection String (Root User):
    mongodb://admin:${var.mongodb_root_password}@${azurerm_container_app.mongodb.latest_revision_fqdn}:${var.mongodb_port}/admin
    
    📝 Connection String (Application Database):
    mongodb://admin:${var.mongodb_root_password}@${azurerm_container_app.mongodb.latest_revision_fqdn}:${var.mongodb_port}/dculus_forms
    
    📊 Container Details:
    - CPU: ${var.container_cpu} cores
    - Memory: ${var.container_memory}
    - Storage: ${var.storage_size_gb}GB persistent
    - Replicas: 1 (always running)
    
    💰 Estimated Cost: ~$10-20/month
    - Container Apps: ~$5-10/month
    - Storage: ~$1-2/month
    - Logs: ~$1-3/month
    
    ⚠️  Security Notes:
    - Change passwords for production use
    - Consider adding authentication and access controls
    - Monitor logs via Azure Log Analytics
  EOT
  sensitive   = true
}

output "deployment_info" {
  description = "Deployment information"
  value = {
    container_cpu    = var.container_cpu
    container_memory = var.container_memory
    storage_size_gb  = var.storage_size_gb
    location         = var.location
    environment      = var.environment
  }
}