# Production Environment Configuration

environment  = "production"
project_name = "dculus-forms"
r2_location  = "APAC"

# CORS allowed origins for production
cors_allowed_origins = [
  "https://dculus-forms-app.pages.dev",
  "https://dculus-forms-viewer-app.pages.dev",
  "https://dculus-forms-admin-app.pages.dev"
]

# Enable public access via custom domain (not r2.dev)
enable_public_access = false

# Custom domain for public bucket (configure after deployment)
# Example: "cdn.dculus.com" or "assets.dculus.com"
public_bucket_custom_domain = ""

# Resource tags
tags = {
  Environment = "production"
  Project     = "dculus-forms"
  ManagedBy   = "terraform"
  Owner       = "dculus-team"
}
