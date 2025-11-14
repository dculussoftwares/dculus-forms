# MongoDB Connection String
output "mongodb_connection_string" {
  description = "MongoDB connection string for application use"
  value = format(
    "mongodb+srv://%s:%s@%s/%s?retryWrites=true&w=majority",
    urlencode(var.database_username),
    urlencode(var.database_password),
    replace(mongodbatlas_cluster.main.connection_strings[0].standard_srv, "mongodb+srv://", ""),
    var.database_name
  )
  sensitive = true
}

# Project Information
output "project_id" {
  description = "MongoDB Atlas project ID"
  value       = mongodbatlas_project.main.id
}

output "project_name" {
  description = "MongoDB Atlas project name"
  value       = mongodbatlas_project.main.name
}

# Cluster Information
output "cluster_id" {
  description = "MongoDB Atlas cluster ID"
  value       = mongodbatlas_cluster.main.cluster_id
}

output "cluster_name" {
  description = "MongoDB Atlas cluster name"
  value       = mongodbatlas_cluster.main.name
}

output "cluster_state" {
  description = "MongoDB Atlas cluster state"
  value       = mongodbatlas_cluster.main.state_name
}

output "cluster_mongo_uri" {
  description = "MongoDB Atlas cluster connection string (base)"
  value       = mongodbatlas_cluster.main.connection_strings[0].standard_srv
  sensitive   = true
}

# Database User Information
output "database_username" {
  description = "Database username"
  value       = mongodbatlas_database_user.main.username
}

output "database_name" {
  description = "Database name"
  value       = var.database_name
}
