# Staging Environment Configuration

environment  = "staging"
project_name = "dculus-forms"
r2_location  = "APAC"

# The shared zone-level embed-framing rule (embed-framing.tf) is owned by the dev
# stack — a Cloudflare zone holds one ruleset per phase, so only one environment
# may create it. A single-environment deployment should set this true instead.
manage_embed_framing = false

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
