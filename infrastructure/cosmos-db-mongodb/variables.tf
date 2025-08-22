variable "location" {
  type        = string
  default     = "westus2"
  description = "Azure region for the Cosmos DB deployment"
}

variable "application_name" {
  type        = string
  default     = "dculus-forms"
  description = "Name of the application"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Environment name"
}

variable "database_name" {
  type        = string
  default     = "dculus_forms_db"
  description = "Name of the MongoDB database"
}