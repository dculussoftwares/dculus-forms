variable "application_name" {
  description = "Name of the application"
  type        = string
  default     = "dculus-mongodb"
  validation {
    condition = can(regex("^[a-z0-9-]{3,24}$", var.application_name))
    error_message = "Application name must be 3-24 characters long and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US"
}

variable "mongodb_root_password" {
  description = "MongoDB root password"
  type        = string
  default     = "SecureRootPassword123!"
  sensitive   = true
}

variable "mongodb_app_password" {
  description = "MongoDB application user password"
  type        = string
  default     = "DculusAppPassword123!"
  sensitive   = true
}

variable "mongodb_port" {
  description = "MongoDB port"
  type        = number
  default     = 27017
}

variable "storage_size_gb" {
  description = "Size of persistent storage in GB"
  type        = number
  default     = 10
}

variable "container_cpu" {
  description = "CPU allocation for container (0.25, 0.5, 0.75, 1.0, etc.)"
  type        = number
  default     = 1.0
}

variable "container_memory" {
  description = "Memory allocation for container in Gi (0.5Gi, 1Gi, 1.5Gi, 2Gi, etc.)"
  type        = string
  default     = "2Gi"
}

variable "enable_external_access" {
  description = "Enable external access to MongoDB (false for internal only)"
  type        = bool
  default     = false
}

variable "mongodb_version" {
  description = "MongoDB version to deploy"
  type        = string
  default     = "7-jammy"
  validation {
    condition = can(regex("^[0-9]+(\\.[0-9]+)*(-[a-z]+)?$", var.mongodb_version))
    error_message = "MongoDB version must be in format 'X.Y' or 'X-distribution' (e.g., '7.0', '7-jammy')."
  }
}

variable "backup_retention_days" {
  description = "Number of days to retain backup data"
  type        = number
  default     = 7
}

variable "enable_zone_redundancy" {
  description = "Enable zone redundancy for Container Apps Environment (2025 feature)"
  type        = bool
  default     = true
}

variable "workload_profile_type" {
  description = "Workload profile type for dedicated compute (Consumption, D4, D8, D16, D32, E4, E8, E16, E32)"
  type        = string
  default     = "D4"
  validation {
    condition = contains(["Consumption", "D4", "D8", "D16", "D32", "E4", "E8", "E16", "E32"], var.workload_profile_type)
    error_message = "Workload profile type must be one of: Consumption, D4, D8, D16, D32, E4, E8, E16, E32."
  }
}

variable "max_workload_instances" {
  description = "Maximum number of workload profile instances"
  type        = number
  default     = 3
  validation {
    condition = var.max_workload_instances >= 1 && var.max_workload_instances <= 100
    error_message = "Max workload instances must be between 1 and 100."
  }
}

variable "subnet_id" {
  description = "Subnet ID for Container Apps Environment (optional for enhanced networking)"
  type        = string
  default     = null
}


variable "min_replicas" {
  description = "Minimum number of container replicas"
  type        = number
  default     = 1
  validation {
    condition = var.min_replicas >= 0 && var.min_replicas <= 30
    error_message = "Min replicas must be between 0 and 30."
  }
}

variable "max_replicas" {
  description = "Maximum number of container replicas"
  type        = number
  default     = 5
  validation {
    condition = var.max_replicas >= 1 && var.max_replicas <= 30
    error_message = "Max replicas must be between 1 and 30."
  }
}

# Backend Application Variables
variable "backend_docker_image" {
  description = "Docker image for the Dculus backend application"
  type        = string
  default     = "your-registry/dculus-backend:latest"
}

variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  default     = "your-super-secret-jwt-key-change-in-production-make-it-at-least-32-characters"
  sensitive   = true
}

variable "better_auth_secret" {
  description = "Better Auth secret for authentication"
  type        = string
  default     = "your-super-secret-key-change-this-in-production-make-it-at-least-32-characters"
  sensitive   = true
}

