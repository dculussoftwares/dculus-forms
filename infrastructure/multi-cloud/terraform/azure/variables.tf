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
