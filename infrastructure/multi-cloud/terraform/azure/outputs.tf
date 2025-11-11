output "backend_url" {
  description = "URL of the deployed backend service"
  value       = "https://${azurerm_container_app.backend.ingress[0].fqdn}"
}

output "backend_fqdn" {
  description = "Fully Qualified Domain Name of the backend service"
  value       = azurerm_container_app.backend.ingress[0].fqdn
}

output "container_app_environment_id" {
  description = "ID of the Container App Environment"
  value       = azurerm_container_app_environment.main.id
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "deployment_info" {
  description = "Deployment summary information"
  value = {
    environment           = var.environment
    backend_url           = "https://${azurerm_container_app.backend.ingress[0].fqdn}"
    graphql_endpoint      = "https://${azurerm_container_app.backend.ingress[0].fqdn}/graphql"
    health_check_endpoint = "https://${azurerm_container_app.backend.ingress[0].fqdn}/health"
    container_app_name    = azurerm_container_app.backend.name
    resource_group        = azurerm_resource_group.main.name
    location              = azurerm_resource_group.main.location
    container_image       = local.full_container_image
    replicas              = "${var.min_replicas}-${var.max_replicas}"
    cpu_memory            = "${var.cpu_cores} cores / ${var.memory_gb}Gi"
  }
}

output "form_services_domain" {
  description = "Custom domain bound to the backend service"
  value       = local.form_services_domain_enabled ? local.form_services_domain : ""
}

output "form_services_certificate_id" {
  description = "Resource ID of the certificate bound to the form services domain"
  value       = local.form_services_certificate_id
}

output "form_services_managed_certificate_validation_token" {
  description = "DNS TXT token required for managed certificate validation"
  value       = local.form_services_validation_token
}
