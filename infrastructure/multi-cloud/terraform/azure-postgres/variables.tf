variable "project_name" {
  description = "Name of the project used as prefix for Azure resources"
  type        = string
  default     = "dculus-forms"
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "location" {
  description = "Azure region where the PostgreSQL server will be created"
  type        = string
  default     = "East US"
}

variable "postgres_admin_username" {
  description = "Administrator username for the PostgreSQL server"
  type        = string
  default     = "dculusadmin"
}

variable "postgres_admin_password" {
  description = "Administrator password for the PostgreSQL server"
  type        = string
  sensitive   = true
}

variable "postgres_version" {
  description = "PostgreSQL version to deploy"
  type        = string
  default     = "15"
}

variable "postgres_sku_name" {
  description = "SKU name for the PostgreSQL flexible server"
  type        = string
  default     = "Standard_B1ms"
}

variable "postgres_sku_tier" {
  description = "SKU tier for the PostgreSQL flexible server"
  type        = string
  default     = "Burstable"
}

variable "postgres_storage_gb" {
  description = "Storage size (in GB) for the PostgreSQL server"
  type        = number
  default     = 32
}
 
variable "postgres_resource_group_name" {
  description = "Optional override for the PostgreSQL resource group name"
  type        = string
  default     = ""
}

variable "postgres_backup_retention_days" {
  description = "Number of days for automatic backups"
  type        = number
  default     = 7
}

variable "postgres_geo_redundant_backup" {
  description = "Enable geo-redundant backups"
  type        = bool
  default     = false
}

variable "postgres_high_availability_mode" {
  description = "High availability mode for the flexible server"
  type        = string
  default     = "Disabled"
}

variable "postgres_database_name" {
  description = "Database name that the application will use"
  type        = string
  default     = "dculus_forms"
}

variable "postgres_firewall_allow_all" {
  description = "Allow all public IPs to access the server"
  type        = bool
  default     = true
}

variable "postgres_firewall_start_ip" {
  description = "Firewall rule start IP address (used when allow_all=false)"
  type        = string
  default     = "0.0.0.0"
}

variable "postgres_firewall_end_ip" {
  description = "Firewall rule end IP address (used when allow_all=false)"
  type        = string
  default     = "0.0.0.0"
}

variable "tags" {
  description = "Tags applied to created resources"
  type        = map(string)
  default = {
    Project   = "Dculus Forms"
    ManagedBy = "Terraform"
  }
}
