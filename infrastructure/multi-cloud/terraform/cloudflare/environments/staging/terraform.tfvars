# Staging Environment Configuration

environment  = "staging"
project_name = "dculus-forms"
r2_location  = "APAC"

# CORS allowed origins for staging
cors_allowed_origins = [
  "https://dculus-forms-app-staging.pages.dev",
  "https://dculus-forms-viewer-app-staging.pages.dev",
  "https://dculus-forms-admin-app-staging.pages.dev"
]

# Disable public access via r2.dev for staging
enable_public_access = false

# Custom domain (configure if needed)
public_bucket_custom_domain = ""

# Resource tags
tags = {
  Environment = "staging"
  Project     = "dculus-forms"
  ManagedBy   = "terraform"
  Owner       = "dculus-team"
}
