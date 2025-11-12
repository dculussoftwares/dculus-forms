# Custom domain for Cloudflare Pages project
resource "cloudflare_pages_domain" "form_app" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.form_app.name
  domain       = "form-app-${var.environment}.${var.root_domain}"
}

# DNS CNAME record pointing to Cloudflare Pages subdomain
resource "cloudflare_record" "form_app_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "form-app-${var.environment}"
  type    = "CNAME"
  value   = cloudflare_pages_project.form_app.subdomain
  proxied = true
  ttl     = 1 # Automatic when proxied=true

  comment = "Custom domain for form-app ${var.environment} environment (Cloudflare Pages)"
}
