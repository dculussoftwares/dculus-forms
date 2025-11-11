variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
}

variable "root_domain" {
  description = "Base domain managed in Cloudflare"
  type        = string
  default     = "dculus.com"
}

variable "service_domain_prefix" {
  description = "Prefix for the service hostname"
  type        = string
  default     = "form-services"
}

variable "backend_fqdn" {
  description = "Ingress FQDN of the Azure Container App backend"
  type        = string
}

variable "managed_certificate_validation_token" {
  description = "DNS TXT token required for Azure managed certificate validation"
  type        = string
  default     = ""
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone identifier for the managed domain"
  type        = string
}

variable "cloudflare_api_token" {
  description = "API token with DNS edit permissions"
  type        = string
  sensitive   = true
}
