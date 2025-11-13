project_name        = "dculus-forms"
environment         = "dev"
location            = "East US"
container_image     = "dculus/forms-backend"
container_image_tag = "latest"
better_auth_url     = "https://dculus-forms-dev-backend.kindocean-e9e3f3f1.eastus.azurecontainerapps.io"

# Root domain for frontend applications (CORS origins will be auto-generated)
root_domain         = "dculus.com"

# Additional custom CORS origins (optional, comma-separated)
# Frontend URLs are automatically included: https://form-app-dev.dculus.com, etc.
# Localhost URLs are automatically included for dev/staging environments
cors_origins        = ""

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
# Tags
tags = {
  Environment = "dev"
  Project     = "dculus-forms"
  ManagedBy   = "terraform"
  Component   = "backend"
}
