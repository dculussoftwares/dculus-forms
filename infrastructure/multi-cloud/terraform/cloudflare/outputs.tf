output "private_bucket_name" {
  description = "Name of the private R2 bucket"
  value       = cloudflare_r2_bucket.private.name
}

output "private_bucket_id" {
  description = "ID of the private R2 bucket"
  value       = cloudflare_r2_bucket.private.id
}

output "public_bucket_name" {
  description = "Name of the public R2 bucket"
  value       = cloudflare_r2_bucket.public.name
}

output "public_bucket_id" {
  description = "ID of the public R2 bucket"
  value       = cloudflare_r2_bucket.public.id
}

output "r2_endpoint_url" {
  description = "R2 S3-compatible API endpoint URL"
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

output "r2_region" {
  description = "R2 region (always 'auto' for R2)"
  value       = "auto"
}

output "environment" {
  description = "Deployed environment"
  value       = var.environment
}

output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT

    ========================================
    R2 Buckets Created Successfully!
    ========================================

    Environment: ${var.environment}
    Private Bucket: ${cloudflare_r2_bucket.private.name}
    Public Bucket: ${cloudflare_r2_bucket.public.name}

    NEXT STEPS:

    1. Generate R2 API Tokens:
       - Go to: https://dash.cloudflare.com/${var.cloudflare_account_id}/r2/api-tokens
       - Create token with "Object Read & Write" permissions
       - Scope to buckets: ${cloudflare_r2_bucket.private.name}, ${cloudflare_r2_bucket.public.name}
       - Save Access Key ID and Secret Access Key

    2. Update Backend Application Environment Variables:
       S3_ENDPOINT=${var.cloudflare_account_id}.r2.cloudflarestorage.com
       S3_REGION=auto
       S3_PRIVATE_BUCKET_NAME=${cloudflare_r2_bucket.private.name}
       S3_PUBLIC_BUCKET_NAME=${cloudflare_r2_bucket.public.name}
       S3_ACCESS_KEY=<your-r2-access-key-id>
       S3_SECRET_KEY=<your-r2-secret-access-key>

    3. Configure CORS (if needed):
       - CORS must be configured using AWS S3 SDK
       - See README.md for CORS configuration examples

    4. Setup Custom Domain for Public Bucket (optional):
       - Go to R2 bucket settings in Cloudflare dashboard
       - Add custom domain under "Public Access"
       - Update DNS records as instructed

    For detailed instructions, see: infrastructure/multi-cloud/terraform/cloudflare/README.md
    ========================================
  EOT
}
