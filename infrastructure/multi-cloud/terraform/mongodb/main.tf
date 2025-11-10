terraform {
  required_version = ">= 1.6.0"

  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.18"
    }
  }
}

# MongoDB Atlas Provider
provider "mongodbatlas" {
  public_key  = var.mongodb_atlas_public_key
  private_key = var.mongodb_atlas_private_key
}

# MongoDB Atlas Project
resource "mongodbatlas_project" "main" {
  name   = var.project_name
  org_id = var.mongodb_atlas_org_id

  # Prevent accidental project deletion
  lifecycle {
    prevent_destroy = false
  }
}
