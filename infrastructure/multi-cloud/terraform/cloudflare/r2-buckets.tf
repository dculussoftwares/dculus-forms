# Private R2 Bucket - For form attachments, user uploads, and sensitive data
resource "cloudflare_r2_bucket" "private" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-private-${var.environment}"
  location   = var.r2_location
}

# Public R2 Bucket - For public assets, form backgrounds, and static content
resource "cloudflare_r2_bucket" "public" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-public-${var.environment}"
  location   = var.r2_location
}

# Note: CORS configuration and lifecycle policies must be configured using the AWS S3 provider
# See README.md for instructions on configuring CORS and other bucket policies
