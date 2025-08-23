# 2025 MongoDB Container App Configuration - Simple & Stable
application_name = "dculus-mongodb"
environment = "production"
location = "East US"

# 2025 enhanced features
enable_zone_redundancy = false  # Requires subnet, disable for simplicity
workload_profile_type = "Consumption"  # Start with serverless

# Container resources
container_cpu = 1.0
container_memory = "2Gi"
storage_size_gb = 20

# Scaling (simple)
min_replicas = 1
max_replicas = 3

# Security  
enable_external_access = false  # Keep internal, use web admin interface instead
mongodb_root_password = "SecureMongoDB2025!@#$"

# Storage retention
backup_retention_days = 30

# Backend Application Configuration
backend_docker_image = "dculus/forms-backend:latest"  # Your published Docker Hub image
jwt_secret = "dculus-forms-jwt-secret-2025-production-at-least-32-characters-long"
better_auth_secret = "dculus-forms-better-auth-secret-2025-production-32-chars-min"