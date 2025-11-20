output "server_name" {
  description = "PostgreSQL server name"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "server_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "database_name" {
  description = "Database name"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

output "admin_username" {
  description = "PostgreSQL admin username"
  value       = azurerm_postgresql_flexible_server.main.administrator_login
}

output "admin_password" {
  description = "PostgreSQL admin password"
  value       = local.resolved_admin_password
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}:${local.resolved_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.main.name}?sslmode=require"
  sensitive   = true
}

output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.postgres.name
}

output "server_id" {
  description = "PostgreSQL server ID"
  value       = azurerm_postgresql_flexible_server.main.id
}
