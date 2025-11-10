# Database User with readWrite role
resource "mongodbatlas_database_user" "main" {
  username           = var.database_username
  password           = var.database_password
  project_id         = mongodbatlas_project.main.id
  auth_database_name = "admin"

  # Grant readWrite access to all databases
  roles {
    role_name     = "readWrite"
    database_name = "admin"
  }

  # Additional role for any database
  roles {
    role_name     = "readWriteAnyDatabase"
    database_name = "admin"
  }

  # Scope - applies to all clusters in the project
  scopes {
    name = mongodbatlas_cluster.main.name
    type = "CLUSTER"
  }
}
