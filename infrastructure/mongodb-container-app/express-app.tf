# Dculus Forms Backend Container App
# This deploys your Express.js + GraphQL backend that connects to MongoDB

resource "azurerm_container_app" "dculus_backend" {
  name                         = "${var.application_name}-backend-${local.unique_suffix}"
  container_app_environment_id = azurerm_container_app_environment.mongodb_env.id
  resource_group_name          = azurerm_resource_group.mongodb_rg.name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 5
    revision_suffix = "v1"

    container {
      name   = "dculus-backend"
      image  = var.backend_docker_image  # Your published Docker image
      cpu    = 1.0    # Backend needs more resources for GraphQL + Prisma
      memory = "2Gi"

      # Database connection (using MongoDB Container App)
      env {
        name  = "DATABASE_URL"
        value = "mongodb://admin:${var.mongodb_root_password}@dculus-mongodb-${local.unique_suffix}:27017/dculus_forms?retryWrites=true&w=majority"
      }

      # Authentication secrets
      env {
        name  = "JWT_SECRET"
        value = var.jwt_secret
      }

      env {
        name  = "BETTER_AUTH_SECRET"
        value = var.better_auth_secret
      }

      # Application configuration
      env {
        name  = "BETTER_AUTH_URL"
        value = "https://dculus-mongodb-backend-${local.unique_suffix}.thankfulsand-56d7988d.eastus.azurecontainerapps.io"
      }

      env {
        name  = "BASE_URL"
        value = "https://dculus-mongodb-backend-${local.unique_suffix}.thankfulsand-56d7988d.eastus.azurecontainerapps.io"
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "PORT"
        value = "4000"  # Your backend runs on port 4000
      }

      # Optional: Cloudflare R2 storage (if you use it)
      # env {
      #   name  = "CLOUDFLARE_R2_ACCESS_KEY"
      #   value = "your-cloudflare-r2-access-key"
      # }
      
      # env {
      #   name  = "CLOUDFLARE_R2_SECRET_KEY"
      #   value = "your-cloudflare-r2-secret-key"
      # }
      
      # env {
      #   name  = "CLOUDFLARE_R2_ENDPOINT"
      #   value = "https://your-account-id.r2.cloudflarestorage.com"
      # }
    }
  }

  # External HTTPS ingress for your GraphQL API
  ingress {
    external_enabled = true
    target_port      = 4000
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
    Purpose     = "Dculus Forms Backend API"
  }

  depends_on = [azurerm_container_app.mongodb]
}