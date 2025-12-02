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

output "form_app_bucket_name" {
  description = "Name of the form-app hosting R2 bucket"
  value       = cloudflare_r2_bucket.form_app_hosting.name
}

output "form_viewer_bucket_name" {
  description = "Name of the form-viewer hosting R2 bucket"
  value       = cloudflare_r2_bucket.form_viewer_hosting.name
}

output "admin_app_bucket_name" {
  description = "Name of the admin-app hosting R2 bucket"
  value       = cloudflare_r2_bucket.admin_app_hosting.name
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
# Note: Token ID is not sensitive, but token value is
# Token value uses nonsensitive() to allow job output passing in GitHub Actions
# Values are immediately masked via ::add-mask:: in the workflow for security
output "r2_access_key_id" {
  description = "R2 Access Key ID (API Token ID) - Used as AWS_ACCESS_KEY_ID"
  value       = cloudflare_api_token.r2_access.id
}

output "r2_secret_access_key" {
  description = "R2 Secret Access Key (SHA256 of Token Value) - Used as AWS_SECRET_ACCESS_KEY"
  value     = cloudflare_api_token.r2_access.value
  sensitive = true
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

    APP HOSTING BUCKETS:
    ✓ Form App Bucket: ${cloudflare_r2_bucket.form_app_hosting.name}
    ✓ Form Viewer Bucket: ${cloudflare_r2_bucket.form_viewer_hosting.name}
    ✓ Admin App Bucket: ${cloudflare_r2_bucket.admin_app_hosting.name}

    NEXT STEPS:

    1. R2 API Tokens (Generated Automatically):
       - Access Key ID: ${cloudflare_api_token.r2_access.id}
       - Secret Access Key: <sensitive> (See 'r2_secret_access_key' output)

    2. Update Backend Environment Variables:
       PUBLIC_S3_ENDPOINT=${var.cloudflare_account_id}.r2.cloudflarestorage.com
       S3_REGION=auto
       PRIVATE_S3_BUCKET_NAME=${cloudflare_r2_bucket.private.name}
       PUBLIC_S3_BUCKET_NAME=${cloudflare_r2_bucket.public.name}
       PUBLIC_S3_CDN_URL=https://public-cdn-${var.environment}.dculus.com
       PUBLIC_S3_ACCESS_KEY=<your-r2-access-key-id>
       PUBLIC_S3_SECRET_KEY=<your-r2-secret-access-key>

    3. Enable Public Access for App Hosting Buckets:
       Go to Cloudflare Dashboard > R2 and enable public access:
       
       For each bucket (${cloudflare_r2_bucket.form_app_hosting.name}, 
                        ${cloudflare_r2_bucket.form_viewer_hosting.name}, 
                        ${cloudflare_r2_bucket.admin_app_hosting.name}):
       
       a. Navigate to Settings > Public Access
       b. Click "Allow Access" to enable public r2.dev URL
       c. Copy the generated URL (format: https://pub-<hash>.r2.dev)
       d. Add to GitHub Actions secrets:
          - FORM_APP_PUBLIC_URL
          - FORM_VIEWER_PUBLIC_URL
          - ADMIN_APP_PUBLIC_URL
       e. Add to backend CORS allowed origins

    4. Test CDN Access (wait 1-2 minutes for DNS propagation):
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

# App Hosting Bucket Public URL Outputs
# Note: These URLs will be generated after enabling public access via dashboard
output "form_app_public_url_instructions" {
  description = "Instructions to enable public URL for form-app bucket"
  value       = "Enable public access in Cloudflare Dashboard > R2 > ${cloudflare_r2_bucket.form_app_hosting.name} > Settings > Public Access > Allow Access"
}

output "form_viewer_public_url_instructions" {
  description = "Instructions to enable public URL for form-viewer bucket"
  value       = "Enable public access in Cloudflare Dashboard > R2 > ${cloudflare_r2_bucket.form_viewer_hosting.name} > Settings > Public Access > Allow Access"
}

output "admin_app_public_url_instructions" {
  description = "Instructions to enable public URL for admin-app bucket"
  value       = "Enable public access in Cloudflare Dashboard > R2 > ${cloudflare_r2_bucket.admin_app_hosting.name} > Settings > Public Access > Allow Access"
}

output "app_buckets_summary" {
  description = "Summary of app hosting buckets requiring public access"
  value = {
    form_app = {
      bucket_name = cloudflare_r2_bucket.form_app_hosting.name
      action      = "Enable public access via Cloudflare Dashboard"
      url_format  = "https://pub-<hash>.r2.dev (generated after enabling)"
    }
    form_viewer = {
      bucket_name = cloudflare_r2_bucket.form_viewer_hosting.name
      action      = "Enable public access via Cloudflare Dashboard"
      url_format  = "https://pub-<hash>.r2.dev (generated after enabling)"
    }
    admin_app = {
      bucket_name = cloudflare_r2_bucket.admin_app_hosting.name
      action      = "Enable public access via Cloudflare Dashboard"
      url_format  = "https://pub-<hash>.r2.dev (generated after enabling)"
    }
  }
}

