terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # cloudflare_r2_bucket_cors (r2-cors.tf) requires the v5 provider
      version = "~> 5.0"
    }
    # TEMPORARY — see r2-cors-state-cleanup.tf. Remove this block together
    # with that file once the cleanup has applied in every environment that
    # ran the early aws-provider draft of PR #110 (currently just dev).
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }
}

provider "cloudflare" {
  # The provider will automatically use CLOUDFLARE_API_TOKEN environment variable
  # No need to explicitly set api_token here
}

# TEMPORARY — see r2-cors-state-cleanup.tf for why this exists. This is the
# same aws provider config PR #110's first draft used (pointed at R2's
# S3-compatible endpoint via the existing R2 API token), restored only so
# Terraform can refresh/forget the orphaned aws_s3_bucket_cors_configuration
# resource that draft left behind in state. It performs no create/update —
# the `removed` block's `destroy = false` means no API calls are made
# against it at all beyond authentication.
provider "aws" {
  region = "auto" # R2 ignores region; the endpoint override below is what matters

  access_key = cloudflare_api_token.r2_access.id
  secret_key = sha256(cloudflare_api_token.r2_access.value)

  skip_credentials_validation = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
  s3_use_path_style           = true

  endpoints {
    s3 = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
  }
}
