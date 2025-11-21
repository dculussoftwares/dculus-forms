project_name        = "dculus-forms"
environment         = "production"
location            = "Southeast Asia"
container_image     = "dculus/forms-backend"
container_image_tag = "latest"
better_auth_url     = "https://dculus-forms-production-backend.kindocean-e9e3f3f1.eastus.azurecontainerapps.io"

# Root domain for frontend applications (CORS origins will be auto-generated)
root_domain         = "dculus.com"

# Additional custom CORS origins (optional, comma-separated)
# Frontend URLs are automatically included:
#   - https://form-app-production.dculus.com
#   - https://form-app.dculus.com (production alias)
#   - https://form-viewer-production.dculus.com
#   - https://form-viewer.dculus.com (production alias)
#   - https://admin-app-production.dculus.com
#   - https://admin-app.dculus.com (production alias)
cors_origins        = ""

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
# Tags
tags = {
  Environment = "production"
  Project     = "dculus-forms"
  ManagedBy   = "terraform"
  Component   = "backend"
}
