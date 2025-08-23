output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.dculus_backend.name
}

output "resource_group_id" {
  description = "ID of the created resource group"
  value       = azurerm_resource_group.dculus_backend.id
}

output "location" {
  description = "Location of the resource group"
  value       = azurerm_resource_group.dculus_backend.location
}