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

output "public_cdn_domain" {
  description = "Custom CDN domain for public R2 bucket"
  value       = "public-cdn-${var.environment}.dculus.com"
}

output "public_cdn_url" {
  description = "Full CDN URL for public bucket"
  value       = "https://public-cdn-${var.environment}.dculus.com"
}

output "dns_record_status" {
  description = "Status of the DNS record configuration"
  value       = "Automatically managed by R2 Custom Domain - Proxied through Cloudflare"
}

# R2 API Token Outputs (S3-compatible credentials)
output "r2_access_key_id" {
  description = "R2 Access Key ID (API Token ID) - Used as AWS_ACCESS_KEY_ID"
  value       = cloudflare_api_token.r2_access.id
  sensitive   = true
}

output "r2_secret_access_key" {
  description = "R2 Secret Access Key (Token Value) - Used as AWS_SECRET_ACCESS_KEY"
  value       = cloudflare_api_token.r2_access.value
  sensitive   = true
}

output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT

    ========================================
    R2 Buckets & CDN Successfully Deployed!
    ========================================

    Environment: ${var.environment}
    Private Bucket: ${cloudflare_r2_bucket.private.name}
    Public Bucket: ${cloudflare_r2_bucket.public.name}

    CDN CONFIGURATION:
    ✓ DNS Record: public-cdn-${var.environment}.dculus.com
    ✓ Custom Domain: Connected to R2 bucket
    ✓ CDN Status: Proxied through Cloudflare
    ✓ Cache Rules: Edge caching enabled (2hr/1hr TTL)
    ✓ HTTPS: Automatic SSL certificates active

    PUBLIC CDN URL:
    → https://public-cdn-${var.environment}.dculus.com

    NEXT STEPS:

    1. Generate R2 API Tokens:
       - Go to: https://dash.cloudflare.com/${var.cloudflare_account_id}/r2/api-tokens
       - Create token with "Object Read & Write" permissions
       - Scope to buckets: ${cloudflare_r2_bucket.private.name}, ${cloudflare_r2_bucket.public.name}
       - Save Access Key ID and Secret Access Key

    2. Update Backend Environment Variables:
       PUBLIC_S3_ENDPOINT=${var.cloudflare_account_id}.r2.cloudflarestorage.com
       S3_REGION=auto
       PRIVATE_S3_BUCKET_NAME=${cloudflare_r2_bucket.private.name}
       PUBLIC_S3_BUCKET_NAME=${cloudflare_r2_bucket.public.name}
       PUBLIC_S3_CDN_URL=https://public-cdn-${var.environment}.dculus.com
       PUBLIC_S3_ACCESS_KEY=<your-r2-access-key-id>
       PUBLIC_S3_SECRET_KEY=<your-r2-secret-access-key>

    3. Test CDN Access (wait 1-2 minutes for DNS propagation):
       # Upload test file
       aws s3 cp test.jpg s3://${cloudflare_r2_bucket.public.name}/ \
         --endpoint-url https://${var.cloudflare_account_id}.r2.cloudflarestorage.com

       # Access via CDN
       curl -I https://public-cdn-${var.environment}.dculus.com/test.jpg

       # Should see Cloudflare headers: cf-cache-status, cf-ray, etc.

    For detailed documentation: infrastructure/multi-cloud/terraform/cloudflare/README.md
    ========================================
  EOT
}
