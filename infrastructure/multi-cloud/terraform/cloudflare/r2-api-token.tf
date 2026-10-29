# R2 API Token for S3-compatible access to R2 buckets
# This token is used to generate Access Key ID and Secret Access Key for S3 API access

resource "cloudflare_api_token" "r2_access" {
  name = "${var.project_name}-r2-token-${var.environment}"

  policies = [{
    effect = "allow"
    # Bucket-scoped object access only: no account-level "Storage Write" (which can create
    # or delete buckets) and no access to other environments' buckets.
    permission_groups = [{
      id = "6a018a9f2fc74eb6b293b0c548f38b39" # Workers R2 Storage Bucket Item Read
      }, {
      id = "2efd5506f9c8494dacb1fa10a3e7d5b6" # Workers R2 Storage Bucket Item Write
    }]
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.private.name}" = "*"
      "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.public.name}"  = "*"
    })
  }]
}
