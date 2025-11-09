project_name        = "dculus-forms"
environment         = "production"
location            = "East US"
container_image     = "dculus/forms-backend"
container_image_tag = "latest"
better_auth_url     = "https://dculus-forms-production-backend.kindocean-e9e3f3f1.eastus.azurecontainerapps.io"

# Resource configuration
cpu_cores    = 1.0
memory_gb    = 2.0
min_replicas = 2
max_replicas = 10

# Container configuration
container_port           = 4000
target_port              = 4000
external_enabled         = true
allow_insecure_traffic   = false
ingress_transport        = "auto"

# Monitoring
log_analytics_retention_days = 90

# Tags
tags = {
  Environment = "production"
  Project     = "dculus-forms"
  ManagedBy   = "terraform"
  Component   = "backend"
}
