terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.43.0"
    }
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

# R2's bucket-level settings (CORS, lifecycle policies) are only exposed via
# its S3-compatible API, not the Cloudflare provider — so bucket CORS is
# managed through the AWS provider pointed at R2's S3 endpoint, using the
# same R2 API token (see r2-api-token.tf) as S3-style credentials.
#
# NOTE: this makes the aws provider's config depend on a resource created in
# this same configuration (cloudflare_api_token.r2_access). Terraform's graph
# handles this correctly in a single `terraform apply` as long as that
# resource already exists in state (true for every environment here, since
# the R2 buckets/token were provisioned before this file was added). If a
# *brand new* environment is ever bootstrapped from scratch, the very first
# apply may need `-target=cloudflare_api_token.r2_access` first, then a
# regular apply, to avoid a "provider config not yet known" ordering error.
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
