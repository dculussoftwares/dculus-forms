variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = false
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token with R2 permissions"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production"
  }
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "dculus-forms"
}

variable "r2_location" {
  description = "R2 bucket location hint"
  type        = string
  default     = "APAC"
  validation {
    condition     = contains(["WNAM", "ENAM", "WEUR", "EEUR", "APAC", "AUTO"], var.r2_location)
    error_message = "Location must be one of: WNAM, ENAM, WEUR, EEUR, APAC, AUTO"
  }
}

variable "cors_allowed_origins" {
  description = "Allowed origins for CORS configuration"
  type        = list(string)
  default     = []
}

variable "public_bucket_custom_domain" {
  description = "Optional custom domain for public R2 bucket"
  type        = string
  default     = ""
}

variable "enable_public_access" {
  description = "Enable public access to public bucket via r2.dev subdomain"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
