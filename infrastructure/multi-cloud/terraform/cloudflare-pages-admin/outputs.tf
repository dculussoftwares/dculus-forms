output "pages_project_name" {
  description = "Cloudflare Pages project name"
  value       = cloudflare_pages_project.admin_app.name
}

output "pages_project_id" {
  description = "Cloudflare Pages project ID"
  value       = cloudflare_pages_project.admin_app.id
}

output "pages_url" {
  description = "Cloudflare Pages default URL (*.pages.dev)"
  value       = "https://${cloudflare_pages_project.admin_app.subdomain}"
}

output "custom_domain" {
  description = "Custom domain for admin-app"
  value       = "https://${local.custom_domain}"
}

output "pages_subdomain" {
  description = "Cloudflare Pages subdomain"
  value       = cloudflare_pages_project.admin_app.subdomain
}

output "deployment_info" {
  description = "Deployment information for admin-app"
  value = {
    environment       = var.environment
    project_name      = cloudflare_pages_project.admin_app.name
    custom_domain     = "https://${local.custom_domain}"
    pages_url         = "https://${cloudflare_pages_project.admin_app.subdomain}"
    dns_record_name   = local.cname_name
    production_branch = cloudflare_pages_project.admin_app.production_branch
  }
}

