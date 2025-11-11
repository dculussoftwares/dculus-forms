project_name        = "dculus-forms"
environment         = "staging"
location            = "East US"
container_image     = "dculus/forms-backend"
container_image_tag = "latest"
better_auth_url     = "https://dculus-forms-staging-backend.kindocean-e9e3f3f1.eastus.azurecontainerapps.io"

# Resource configuration
cpu_cores    = 0.5
memory_gb    = 1.0
min_replicas = 1
max_replicas = 5

# Container configuration
container_port           = 4000
target_port              = 4000
external_enabled         = true
allow_insecure_traffic   = false
ingress_transport        = "auto"

# Monitoring
# Tags
tags = {
  Environment = "staging"
  Project     = "dculus-forms"
  ManagedBy   = "terraform"
  Component   = "backend"
}
