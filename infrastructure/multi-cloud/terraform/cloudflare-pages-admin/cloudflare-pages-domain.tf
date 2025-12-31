# Custom domain for Cloudflare Pages project
locals {
  custom_domain = var.environment == "production" ? "form-admin-app.${var.root_domain}" : "form-admin-app-${var.environment}.${var.root_domain}"
  cname_name    = var.environment == "production" ? "form-admin-app" : "form-admin-app-${var.environment}"
}

resource "cloudflare_pages_domain" "admin_app" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.admin_app.name
  domain       = local.custom_domain
}

# DNS CNAME record pointing to Cloudflare Pages subdomain
resource "cloudflare_record" "admin_app_cname" {
  zone_id = var.cloudflare_zone_id
  name    = local.cname_name
  type    = "CNAME"
  value   = cloudflare_pages_project.admin_app.subdomain
  proxied = true
  ttl     = 1 # Automatic when proxied=true

  comment = "Custom domain for form-admin-app ${var.environment} environment (Cloudflare Pages)"
}

