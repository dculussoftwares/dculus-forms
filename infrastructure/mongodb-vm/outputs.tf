output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.mongodb_rg.name
}

output "vm_name" {
  description = "Name of the virtual machine"
  value       = azurerm_linux_virtual_machine.mongodb_vm.name
}

output "public_ip_address" {
  description = "Public IP address of the MongoDB VM"
  value       = azurerm_public_ip.mongodb_public_ip.ip_address
}

output "fqdn" {
  description = "Fully qualified domain name of the MongoDB VM"
  value       = azurerm_public_ip.mongodb_public_ip.fqdn
}

output "mongodb_port" {
  description = "MongoDB port"
  value       = var.mongodb_port
}

output "mongodb_admin_connection_string" {
  description = "MongoDB admin connection string (use with caution)"
  value       = "mongodb://admin:SecureAdminPassword123!@${azurerm_public_ip.mongodb_public_ip.ip_address}:${var.mongodb_port}/admin"
  sensitive   = true
}

output "mongodb_app_connection_string" {
  description = "MongoDB application connection string (use with caution)"
  value       = "mongodb://dculus_app:DculusAppPassword123!@${azurerm_public_ip.mongodb_public_ip.ip_address}:${var.mongodb_port}/dculus_forms"
  sensitive   = true
}

output "network_security_group_id" {
  description = "ID of the network security group"
  value       = azurerm_network_security_group.mongodb_nsg.id
}

# SSH access disabled - only MongoDB connection strings provided

output "allowed_mongodb_ips" {
  description = "IP ranges allowed for MongoDB access"
  value       = var.allowed_mongodb_ips
}

output "installation_info" {
  description = "MongoDB installation information"
  value = {
    mongodb_version = var.mongodb_version
    vm_size         = var.vm_size
    disk_size_gb    = var.disk_size_gb
    location        = var.location
    admin_username  = var.admin_username
  }
}

output "mongodb_connection_instructions" {
  description = "MongoDB connection instructions"
  value       = <<-EOT
    === MongoDB Connection Strings ===
    
    🔗 Application Database Connection:
    mongodb://dculus_app:DculusAppPassword123!@${azurerm_public_ip.mongodb_public_ip.ip_address}:${var.mongodb_port}/dculus_forms
    
    🔗 Admin Database Connection:
    mongodb://admin:SecureAdminPassword123!@${azurerm_public_ip.mongodb_public_ip.ip_address}:${var.mongodb_port}/admin
    
    📝 Connection Details:
    - Server: ${azurerm_public_ip.mongodb_public_ip.ip_address}:${var.mongodb_port}
    - App Database: dculus_forms
    - App User: dculus_app
    - Admin User: admin
    
    ⚠️  Security Notes:
    - Change passwords immediately in production
    - Restrict allowed_mongodb_ips to your specific IP ranges
    - Enable SSL/TLS for production use
  EOT
}