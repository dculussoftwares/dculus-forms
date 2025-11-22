variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "Central India"
}

variable "admin_username" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "pgadmin"
}

variable "admin_password" {
  description = "PostgreSQL admin password (optional - will be generated if not provided)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "allow_public_access" {
  description = "Allow public access to PostgreSQL (set to false in production)"
  type        = bool
  default     = true
}
