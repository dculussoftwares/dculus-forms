variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
  default     = "dculus-backend"
}

variable "location" {
  description = "Azure region where resources will be created"
  type        = string
  default     = "East US"
}

variable "mongodb_admin_username" {
  description = "MongoDB admin username"
  type        = string
  default     = "admin"
}

variable "mongodb_admin_password" {
  description = "MongoDB admin password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "better_auth_secret" {
  description = "Better Auth secret key"
  type        = string
  sensitive   = true
}

variable "cloudflare_r2_access_key" {
  description = "Cloudflare R2 access key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_r2_secret_key" {
  description = "Cloudflare R2 secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_r2_endpoint" {
  description = "Cloudflare R2 endpoint"
  type        = string
  default     = ""
}

variable "cloudflare_r2_private_bucket" {
  description = "Cloudflare R2 private bucket name"
  type        = string
  default     = ""
}

variable "cloudflare_r2_public_bucket" {
  description = "Cloudflare R2 public bucket name"
  type        = string
  default     = ""
}