variable "application_name" {
  description = "Name of the application"
  type        = string
  default     = "dculus-mongodb"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US"
}

variable "vm_size" {
  description = "Size of the virtual machine"
  type        = string
  default     = "Standard_B2s"
}

variable "admin_username" {
  description = "Admin username for the VM"
  type        = string
  default     = "azureuser"
}

# SSH access disabled by default - only MongoDB access needed

variable "allowed_mongodb_ips" {
  description = "List of IP addresses/ranges allowed for MongoDB access"
  type        = list(string)
  default     = ["0.0.0.0/0"] # WARNING: Change this to your specific IP ranges
}

variable "mongodb_version" {
  description = "MongoDB version to install"
  type        = string
  default     = "8.0"
}

variable "disk_size_gb" {
  description = "Size of the OS disk in GB"
  type        = number
  default     = 30
}

variable "mongodb_port" {
  description = "MongoDB port"
  type        = number
  default     = 27017
}