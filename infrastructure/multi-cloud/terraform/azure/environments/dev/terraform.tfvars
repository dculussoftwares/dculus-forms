project_name        = "dculus-forms"
environment         = "dev"
location            = "East US"
container_image     = "dculus/forms-backend"
container_image_tag = "latest"
better_auth_url     = "https://dculus-forms-dev-backend.kindocean-e9e3f3f1.eastus.azurecontainerapps.io"

# Resource configuration
cpu_cores    = 0.25
memory_gb    = 0.5
min_replicas = 1
max_replicas = 3

# Container configuration
container_port           = 4000
target_port              = 4000
external_enabled         = true
allow_insecure_traffic   = false
ingress_transport        = "auto"

# Monitoring
log_analytics_retention_days = 30

# Tags
tags = {
  Environment = "dev"
  Project     = "dculus-forms"
  ManagedBy   = "terraform"
  Component   = "backend"
}
