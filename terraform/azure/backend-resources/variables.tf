variable "resource_group_name" {
  description = "Name of the Azure Resource Group for MongoDB backend"
  type        = string
  default     = "dculus-mongodb-backend"
}

variable "location" {
  description = "Azure region where MongoDB resources will be created"
  type        = string
  default     = "East US"
}

variable "mongodb_admin_password" {
  description = "Password for MongoDB admin user"
  type        = string
  sensitive   = true
}