# Production Environment Configuration

environment  = "production"
project_name = "dculus-forms"
r2_location  = "APAC"

# The shared zone-level embed-framing rule (embed-framing.tf) is owned by the dev
# stack — a Cloudflare zone holds one ruleset per phase, so only one environment
# may create it. A single-environment deployment should set this true instead.
manage_embed_framing = false

# CORS allowed origins for production
cors_allowed_origins = [
  "https://forms.dculus.com",
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
