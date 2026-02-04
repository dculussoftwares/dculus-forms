provider "neon" {
  api_key = var.neon_api_key
}

resource "neon_project" "main" {

  name                      = "${var.project_name}-${var.environment}"
  region_id                 = var.region_id
  history_retention_seconds = 0
}

resource "neon_role" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_project.main.default_branch_id
  name       = var.role_name
}

resource "neon_database" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_project.main.default_branch_id
  name       = var.database_name
  owner_name = neon_role.main.name
}
