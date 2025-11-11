variable "project_name" {
  description = "Name of the project (used as prefix for resources)"
  type        = string
  default     = "dculus-forms"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "location" {
  description = "Azure region where resources will be created"
  type        = string
  default     = "East US"
}

variable "cpu_cores" {
  description = "CPU cores for container app"
  type        = number
  default     = 0.25
}

variable "memory_gb" {
  description = "Memory in GB for container app"
  type        = number
  default     = 0.5
}

variable "min_replicas" {
  description = "Minimum number of replicas"
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum number of replicas"
  type        = number
  default     = 10
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 4000
}

variable "target_port" {
  description = "Target port for ingress"
  type        = number
  default     = 4000
}

variable "external_enabled" {
  description = "Enable external ingress"
  type        = bool
  default     = true
}

variable "allow_insecure_traffic" {
  description = "Allow insecure HTTP traffic"
  type        = bool
  default     = false
}

variable "ingress_transport" {
  description = "Ingress transport protocol"
  type        = string
  default     = "auto"
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

variable "better_auth_url" {
  description = "Better Auth URL (backend URL)"
  type        = string
  default     = ""
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

variable "s3_cdn_url" {
  description = "CDN URL for serving public S3 assets"
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

variable "container_image" {
  description = "Docker container image repository"
  type        = string
  default     = "dculus/forms-backend"
}

variable "container_image_tag" {
  description = "Docker container image tag"
  type        = string
  default     = "latest"
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

variable "enable_form_services_domain" {
  description = "Enable custom domain binding for form-services-{env}.dculus.com"
  type        = bool
  default     = false
}

variable "form_services_domain_prefix" {
  description = "Prefix portion of the form services domain"
  type        = string
  default     = "form-services"
}

variable "form_services_root_domain" {
  description = "Root domain for the form services hostname"
  type        = string
  default     = "dculus.com"
}

variable "form_services_certificate_type" {
  description = "Certificate strategy for the form services domain (managed or bring_your_own)"
  type        = string
  default     = "managed"
  validation {
    condition     = contains(["managed", "bring_your_own"], var.form_services_certificate_type)
    error_message = "form_services_certificate_type must be either 'managed' or 'bring_your_own'."
  }
}

variable "form_services_domain_validation_method" {
  description = "Validation method for Azure managed certificates"
  type        = string
  default     = "TXT"
  validation {
    condition     = contains(["TXT", "CNAME", "HTTP"], var.form_services_domain_validation_method)
    error_message = "form_services_domain_validation_method must be one of TXT, CNAME, or HTTP."
  }
}

variable "form_services_certificate_pfx_base64" {
  description = "Base64 encoded PFX certificate used to bind the custom domain"
  type        = string
  sensitive   = true
  default     = ""
}

variable "form_services_certificate_password" {
  description = "Password for the PFX certificate"
  type        = string
  sensitive   = true
  default     = ""
}

variable "form_services_bind_custom_domain" {
  description = "Whether to attach the custom domain to the container app ingress in this apply"
  type        = bool
  default     = false
}
