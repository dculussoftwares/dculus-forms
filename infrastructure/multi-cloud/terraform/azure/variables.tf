variable "app_name" {
  description = "Name of the application (used as prefix for resources)"
  type        = string
  default     = "dculus-forms"
}

variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
  default     = "dculus-forms-rg"
}

variable "location" {
  description = "Azure region where resources will be created"
  type        = string
  default     = "East US"
}

variable "container_app_domain" {
  description = "Domain for container apps (region-specific)"
  type        = string
  default     = "thankfulbay-2c831716.eastus.azurecontainerapps.io"
}

variable "mongodb_connection_string" {
  description = "MongoDB connection string"
  type        = string
  sensitive   = true
}


variable "better_auth_secret" {
  description = "Better Auth secret (minimum 32 characters)"
  type        = string
  sensitive   = true
}

variable "s3_access_key" {
  description = "S3 access key for file storage"
  type        = string
  sensitive   = true
  default     = ""
}

variable "s3_secret_key" {
  description = "S3 secret key for file storage"
  type        = string
  sensitive   = true
  default     = ""
}

variable "s3_endpoint" {
  description = "S3 endpoint URL"
  type        = string
  default     = ""
}

variable "s3_private_bucket_name" {
  description = "S3 private bucket name"
  type        = string
  default     = ""
}

variable "s3_public_bucket_name" {
  description = "S3 public bucket name"
  type        = string
  default     = ""
}

variable "cors_origins" {
  description = "CORS origins for the backend API (comma-separated)"
  type        = string
  default     = "http://localhost:3000,http://localhost:5173"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Dculus Forms"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}