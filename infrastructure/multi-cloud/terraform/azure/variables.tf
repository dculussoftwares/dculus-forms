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
  default     = "Central India"
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

variable "postgres_connection_string" {
  description = "PostgreSQL connection string"
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

variable "public_s3_access_key" {
  description = "Public S3 bucket access key for file storage"
  type        = string
  sensitive   = true
  default     = ""
}

variable "public_s3_secret_key" {
  description = "Public S3 bucket secret key for file storage"
  type        = string
  sensitive   = true
  default     = ""
}

variable "public_s3_endpoint" {
  description = "Public S3 bucket endpoint URL"
  type        = string
  default     = ""
}

variable "public_s3_cdn_url" {
  description = "CDN URL for serving public S3 assets"
  type        = string
  default     = ""
}

variable "private_s3_bucket_name" {
  description = "S3 private bucket name"
  type        = string
  default     = ""
}

variable "public_s3_bucket_name" {
  description = "S3 public bucket name"
  type        = string
  default     = ""
}

variable "cors_origins" {
  description = "CORS origins for the backend API (comma-separated). Additional custom origins to include beyond auto-generated frontend URLs."
  type        = string
  default     = ""
}

variable "root_domain" {
  description = "Root domain for the application (used to construct frontend URLs)"
  type        = string
  default     = "dculus.com"
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

variable "admin_email" {
  description = "Admin email for initial super admin account"
  type        = string
  sensitive   = true
  default     = ""
}

variable "admin_password" {
  description = "Admin password for initial super admin account"
  type        = string
  sensitive   = true
  default     = ""
}

variable "admin_name" {
  description = "Admin name for initial super admin account"
  type        = string
  default     = "Super Admin"
}

variable "email_host" {
  description = "SMTP email host (e.g., AWS SES endpoint)"
  type        = string
  default     = ""
}

variable "email_port" {
  description = "SMTP email port"
  type        = string
  default     = "587"
}

variable "email_user" {
  description = "SMTP email username (e.g., AWS SES access key)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "email_password" {
  description = "SMTP email password (e.g., AWS SES secret key)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "email_from" {
  description = "From email address for sending emails"
  type        = string
  default     = ""
}

variable "chargebee_site" {
  description = "Chargebee site name"
  type        = string
  default     = ""
}

variable "chargebee_api_key" {
  description = "Chargebee API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "sentry_dsn" {
  description = "Sentry DSN for backend observability"
  type        = string
  default     = ""
}

variable "run_seed" {
  description = "Whether to run database seeding on container startup"
  type        = bool
  default     = false
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
