# Custom Domain Configuration for Public R2 Bucket
# This enables CDN access via public-cdn-{env}.dculus.com

locals {
  # Custom domain for the public bucket
  public_cdn_domain = "public-cdn-${var.environment}.dculus.com"
}

# R2 Custom Domain - Connect the custom domain to the R2 bucket
# This resource will automatically create the DNS CNAME record
# pointing to public.r2.dev with the R2 custom domain connection
#
# IMPORTANT: This resource creates its own DNS record automatically
# Do NOT create a separate cloudflare_dns_record resource as it will conflict
resource "cloudflare_r2_custom_domain" "public_cdn" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.public.name
  zone_id     = var.cloudflare_zone_id
  domain      = local.public_cdn_domain
  enabled     = true
}

# Page Rule for CDN cache optimization
resource "cloudflare_page_rule" "public_cdn_cache" {
  zone_id  = var.cloudflare_zone_id
  target   = "public-cdn-${var.environment}.dculus.com/*"
  priority = 1
  status   = "active"

  actions = {
    cache_level         = "cache_everything"
    edge_cache_ttl      = 7200
    browser_cache_ttl   = 3600
    disable_performance = false
  }

  depends_on = [cloudflare_r2_custom_domain.public_cdn]
}

# Optional: Advanced Cache Rules using Rulesets
# Uncomment if you prefer more granular cache control over Page Rules
# resource "cloudflare_ruleset" "public_cdn_cache" {
#   zone_id     = local.zone_id
#   name        = "Public CDN Cache Rules - ${var.environment}"
#   description = "Cache optimization for public R2 bucket CDN"
#   kind        = "zone"
#   phase       = "http_request_cache_settings"
#
#   rules {
#     action = "set_cache_settings"
#     action_parameters {
#       cache = true
#       edge_ttl {
#         mode    = "override_origin"
#         default = 7200  # 2 hours
#       }
#       browser_ttl {
#         mode    = "override_origin"
#         default = 3600  # 1 hour
#       }
#     }
#     expression  = "(http.host eq \"public-cdn-${var.environment}.dculus.com\")"
#     description = "Cache all public CDN assets"
#     enabled     = true
#   }
#
#   depends_on = [cloudflare_record.public_cdn]
# }

# ===================================
# App Hosting Buckets - Public Access
# ===================================
# Enable public URL access for form-app, form-viewer, and admin-app R2 buckets
# These buckets will be accessible via their r2.dev public URLs

# Form App - Public URL Access
# Note: Public access via r2.dev must be enabled manually via Cloudflare Dashboard
# Navigate to: R2 > Bucket > Settings > Public Access > Allow Access
# This will generate a URL like: https://pub-<hash>.r2.dev
resource "cloudflare_r2_bucket" "form_app_public_access" {
  account_id = var.cloudflare_account_id
  name       = cloudflare_r2_bucket.form_app_hosting.name
  location   = var.r2_location

  lifecycle {
    ignore_changes = [name, location]
    prevent_destroy = false
  }
}

# Form Viewer - Public URL Access
resource "cloudflare_r2_bucket" "form_viewer_public_access" {
  account_id = var.cloudflare_account_id
  name       = cloudflare_r2_bucket.form_viewer_hosting.name
  location   = var.r2_location

  lifecycle {
    ignore_changes = [name, location]
    prevent_destroy = false
  }
}

# Admin App - Public URL Access
resource "cloudflare_r2_bucket" "admin_app_public_access" {
  account_id = var.cloudflare_account_id
  name       = cloudflare_r2_bucket.admin_app_hosting.name
  location   = var.r2_location

  lifecycle {
    ignore_changes = [name, location]
    prevent_destroy = false
  }
}

# NOTE: R2 Public Access Configuration
# =====================================
# Cloudflare R2 buckets require manual activation of public access via the dashboard:
# 
# 1. Go to Cloudflare Dashboard > R2
# 2. Select each bucket (form-app, form-viewer, admin-app)
# 3. Navigate to Settings > Public Access
# 4. Click "Allow Access" to enable public r2.dev URL
# 5. Copy the generated public URL (format: https://pub-<hash>.r2.dev)
# 
# The public URLs will need to be:
# - Added to your GitHub Actions secrets for deployment
# - Added to backend CORS configuration
# - Used in your deployment workflows
#
# Alternatively, you can use custom domains (similar to the public bucket above)
# by adding cloudflare_r2_custom_domain resources with your own domain names.
