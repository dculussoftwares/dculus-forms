# MongoDB Atlas M0 Free Tier Cluster
resource "mongodbatlas_cluster" "main" {
  project_id = mongodbatlas_project.main.id
  name       = var.cluster_name

  # M0 Free Tier Configuration
  provider_name               = "TENANT"
  backing_provider_name       = "AWS"
  provider_region_name        = "AP_SOUTH_1" # Mumbai, India
  provider_instance_size_name = "M0"

  # MongoDB version
  mongo_db_major_version = "8.0"

  # M0 clusters are always replica sets
  cluster_type = "REPLICASET"

  # Auto-scaling is not available for M0
  auto_scaling_disk_gb_enabled = false

  # Prevent accidental cluster deletion
  lifecycle {
    prevent_destroy = false
  }
}
