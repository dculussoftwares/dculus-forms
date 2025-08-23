variable "resource_group_name" {
  description = "Name of the Azure Resource Group for backend"
  type        = string
  default     = "dculus-backend-rg"
}

variable "create_resource_group" {
  description = "Whether to create a new resource group or use existing"
  type        = bool
  default     = true
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

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# MongoDB infrastructure references
variable "mongodb_resource_group_name" {
  description = "Name of the resource group containing MongoDB infrastructure"
  type        = string
  default     = "dculus-mongodb-rg"
}

variable "mongodb_container_app_environment_name" {
  description = "Name of the Container App Environment where MongoDB is deployed"
  type        = string
  default     = "dculus-mongodb-env"
}

variable "mongodb_key_vault_name" {
  description = "Name of the Key Vault containing MongoDB secrets"
  type        = string
  default     = "dculus-mongodb-kv"
}

# Backend container configuration
variable "backend_image" {
  description = "Docker image for the backend container"
  type        = string
  default     = "node:18-alpine"
}

variable "backend_cpu" {
  description = "CPU allocation for backend container"
  type        = number
  default     = 1.0
}

variable "backend_memory" {
  description = "Memory allocation for backend container"
  type        = string
  default     = "2Gi"
}

variable "min_replicas" {
  description = "Minimum number of backend replicas"
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum number of backend replicas"
  type        = number
  default     = 3
}

# Cloudflare R2 configuration
variable "cloudflare_r2_access_key" {
  description = "Cloudflare R2 access key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudflare_r2_secret_key" {
  description = "Cloudflare R2 secret key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudflare_r2_endpoint" {
  description = "Cloudflare R2 endpoint URL"
  type        = string
  default     = ""
}

variable "cloudflare_r2_private_bucket_name" {
  description = "Cloudflare R2 private bucket name"
  type        = string
  default     = ""
}

variable "cloudflare_r2_public_bucket_name" {
  description = "Cloudflare R2 public bucket name"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Dculus Forms"
    Environment = "dev"
    ManagedBy   = "Terraform"
    Owner       = "Dculus Industries"
    Component   = "Backend"
  }
}