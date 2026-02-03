output "connection_string" {
  value     = "postgresql://${neon_role.main.name}:${neon_role.main.password}@${neon_project.main.database_host}/${neon_database.main.name}?sslmode=require"
  sensitive = true
}

output "database_host" {
  value = neon_project.main.database_host
}

output "database_name" {
  value = neon_database.main.name
}

output "database_user" {
  value = neon_role.main.name
}

output "database_password" {
  value     = neon_role.main.password
  sensitive = true
}

output "project_id" {
  value = neon_project.main.id
}
