output "service_domain" {
  description = "Fully qualified domain configured in Cloudflare"
  value       = local.service_hostname
}

output "target_backend_fqdn" {
  description = "Azure Container App ingress FQDN"
  value       = var.backend_fqdn
}

