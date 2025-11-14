# MongoDB Atlas API Credentials
variable "mongodb_atlas_public_key" {
  description = "MongoDB Atlas public API key"
  type        = string
  sensitive   = true
}

variable "mongodb_atlas_private_key" {
  description = "MongoDB Atlas private API key"
  type        = string
  sensitive   = true
}

variable "mongodb_atlas_org_id" {
  description = "MongoDB Atlas organization ID"
  type        = string
  sensitive   = true
}

# Database Configuration
variable "database_password" {
  description = "Database user password"
  type        = string
  sensitive   = true
}

variable "database_username" {
  description = "Database username"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "dculus_forms"
}

# Environment Configuration
variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production"
  }
}

variable "project_name" {
  description = "MongoDB Atlas project name"
  type        = string
}

variable "cluster_name" {
  description = "MongoDB Atlas cluster name"
  type        = string
}
