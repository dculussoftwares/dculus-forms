variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare Account ID"
}

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API Token with Pages write permissions"
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare Zone ID for dculus.com domain"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, production)"
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "root_domain" {
  type        = string
  default     = "dculus.com"
  description = "Root domain for custom domains"
}
