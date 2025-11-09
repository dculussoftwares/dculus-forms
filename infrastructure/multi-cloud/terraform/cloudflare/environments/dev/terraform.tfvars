# Development Environment Configuration

environment  = "dev"
project_name = "dculus-forms"
r2_location  = "APAC"

# CORS allowed origins for development
cors_allowed_origins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3002",
  "https://dculus-forms-app-dev.pages.dev",
  "https://dculus-forms-viewer-app-dev.pages.dev",
  "https://dculus-forms-admin-app-dev.pages.dev"
]

# Disable public access via r2.dev for development
enable_public_access = false

# Custom domain (leave empty for dev environment)
public_bucket_custom_domain = ""

# Resource tags
tags = {
  Environment = "dev"
  Project     = "dculus-forms"
  ManagedBy   = "terraform"
  Owner       = "dculus-team"
}
