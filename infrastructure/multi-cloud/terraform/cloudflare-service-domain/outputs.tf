output "service_domain" {
  description = "Fully qualified domain configured in Cloudflare"
  value       = local.service_hostname
}

output "target_backend_fqdn" {
  description = "Azure Container App ingress FQDN"
  value       = var.backend_fqdn
}

output "managed_transforms_id" {
  description = "ID of the managed transforms configuration"
  value       = cloudflare_managed_headers.add_visitor_location_headers.id
}

output "visitor_location_headers_enabled" {
  description = "Whether visitor location headers are enabled"
  value       = true
}

