# Custom Domain Configuration for Public R2 Bucket
# This enables CDN access via public-cdn-{env}.dculus.com

locals {
  # Custom domain for the public bucket
  public_cdn_domain = "public-cdn-${var.environment}.dculus.com"
}

# DNS CNAME record pointing to the R2 bucket
# This record is required for the custom domain to work
resource "cloudflare_dns_record" "public_cdn" {
  zone_id = var.cloudflare_zone_id
  name    = "public-cdn-${var.environment}"
  content = "${cloudflare_r2_bucket.public.name}.${var.cloudflare_account_id}.r2.cloudflarestorage.com"
  type    = "CNAME"
  proxied = true  # Enable Cloudflare CDN/proxy
  ttl     = 1     # Auto TTL when proxied
  comment = "Custom domain for public R2 bucket - ${var.environment} environment"
}

# R2 Custom Domain - Connect the custom domain to the R2 bucket
resource "cloudflare_r2_custom_domain" "public_cdn" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.public.name
  zone_id     = var.cloudflare_zone_id
  domain      = local.public_cdn_domain
  enabled     = true

  depends_on = [cloudflare_dns_record.public_cdn]
}

# Page Rule for CDN cache optimization
resource "cloudflare_page_rule" "public_cdn_cache" {
  zone_id  = var.cloudflare_zone_id
  target   = "public-cdn-${var.environment}.dculus.com/*"
  priority = 1
  status   = "active"

  actions = {
    cache_level         = "cache_everything"
    edge_cache_ttl      = 7200  # 2 hours
    browser_cache_ttl   = 3600  # 1 hour
    cache_on_cookie     = ""
    disable_performance = false
  }

  depends_on = [
    cloudflare_dns_record.public_cdn,
    cloudflare_r2_custom_domain.public_cdn
  ]
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
