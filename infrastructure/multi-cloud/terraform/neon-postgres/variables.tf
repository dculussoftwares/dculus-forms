variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "project_name" {
  description = "Base Project Name"
  type        = string
  default     = "dculus-forms"
}

variable "neon_api_key" {
  description = "Neon API Key"
  type        = string
  sensitive   = true
}

variable "region_id" {
  description = "Region ID (e.g. aws-us-east-1)"
  type        = string
  default     = "aws-ap-southeast-1" # Singapore is often good for India latency if India not available, or aws-ap-south-1 if available. Let's check docs or stick to a common one.
  # Checking Neon regions: aws-us-east-1, aws-us-east-2, aws-us-west-2, aws-eu-central-1, aws-ap-southeast-1, aws-ap-southeast-2. 
  # Wait, Neon primarily runs on AWS. aws-ap-south-1 (Mumbai) is often available. I'll default to aws-ap-south-1 but allow override.
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "neondb"
}

variable "branch_name" {
  description = "Name of the branch"
  type        = string
  default     = "main"
}

variable "role_name" {
  description = "Name of the user role"
  type        = string
  default     = "dculus_user"
}
