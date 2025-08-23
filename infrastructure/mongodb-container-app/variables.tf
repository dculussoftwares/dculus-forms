variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
  default     = "dculus-mongodb-rg"
}

variable "location" {
  description = "Azure region where resources will be created"
  type        = string
  default     = "East US"
}

variable "prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "dculus"
  
  validation {
    condition     = can(regex("^[a-z0-9]+$", var.prefix)) && length(var.prefix) <= 10
    error_message = "Prefix must be lowercase alphanumeric and max 10 characters."
  }
}

variable "mongodb_image" {
  description = "MongoDB Docker image"
  type        = string
  default     = "mongo:7.0"
}

variable "mongodb_cpu" {
  description = "CPU allocation for MongoDB container"
  type        = number
  default     = 1.0
}

variable "mongodb_memory" {
  description = "Memory allocation for MongoDB container"
  type        = string
  default     = "2Gi"
}

variable "mongodb_root_username" {
  description = "MongoDB root username"
  type        = string
  default     = "root"
}

variable "mongodb_init_database" {
  description = "Initial database to create"
  type        = string
  default     = "dculus_forms"
}

variable "mongodb_external_access" {
  description = "Enable external access to MongoDB (requires custom VNET for TCP ingress). For security, MongoDB should typically be internal-only."
  type        = bool
  default     = false
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Dculus Forms"
    Environment = "dev"
    ManagedBy   = "Terraform"
    Owner       = "Dculus Industries"
  }
}
