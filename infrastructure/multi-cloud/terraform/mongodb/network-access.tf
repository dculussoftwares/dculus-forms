# Network Access - Allow access from anywhere
# This is required for Azure Container Apps as they don't have static IPs
resource "mongodbatlas_project_ip_access_list" "main" {
  project_id = mongodbatlas_project.main.id
  cidr_block = "0.0.0.0/0"
  comment    = "Azure Container Apps and development access - ${var.environment}"
}
