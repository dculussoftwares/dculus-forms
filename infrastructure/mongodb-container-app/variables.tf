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

variable "mongodb_root_password" {
  description = "MongoDB root password"
  type        = string
  default     = "SecureRootPassword123!"
  sensitive   = true
}

variable "mongodb_app_password" {
  description = "MongoDB application user password"
  type        = string
  default     = "DculusAppPassword123!"
  sensitive   = true
}

variable "mongodb_port" {
  description = "MongoDB port"
  type        = number
  default     = 27017
}

variable "storage_size_gb" {
  description = "Size of persistent storage in GB"
  type        = number
  default     = 10
}

variable "container_cpu" {
  description = "CPU allocation for container (0.25, 0.5, 0.75, 1.0, etc.)"
  type        = number
  default     = 0.5
}

variable "container_memory" {
  description = "Memory allocation for container in Gi (0.5, 1.0, 1.5, 2.0, etc.)"
  type        = string
  default     = "1.0Gi"
}