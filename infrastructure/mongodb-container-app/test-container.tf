# Test Container App for MongoDB connectivity verification
# This container will be in the same environment as MongoDB to test internal connectivity

resource "azurerm_container_app" "mongodb_test" {
  name                         = "${var.application_name}-test-${local.unique_suffix}"
  container_app_environment_id = azurerm_container_app_environment.mongodb_env.id
  resource_group_name          = azurerm_resource_group.mongodb_rg.name
  revision_mode                = "Single"

  template {
    min_replicas = 0  # Can scale to zero when not testing
    max_replicas = 1

    container {
      name   = "mongodb-test"
      image  = "mongo:8.0"  # Use same MongoDB image for testing tools
      cpu    = 0.25
      memory = "0.5Gi"

      # Test connection to MongoDB
      env {
        name  = "MONGODB_URI"
        value = "mongodb://admin:${var.mongodb_root_password}@dculus-mongodb-7177:27017/dculus_forms"
      }

      # Keep container running for manual testing
      args = [
        "/bin/bash", 
        "-c",
        "while true; do echo 'MongoDB Test Container Running...'; sleep 30; done"
      ]
    }
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "MongoDB Connectivity Test"
  }

  depends_on = [azurerm_container_app.mongodb]
}