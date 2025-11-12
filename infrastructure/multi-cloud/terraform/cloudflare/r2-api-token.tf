# R2 API Token for S3-compatible access to R2 buckets
# This token is used to generate Access Key ID and Secret Access Key for S3 API access

resource "cloudflare_api_token" "r2_access" {
  name = "${var.project_name}-r2-token-${var.environment}"

  policies = [{
    effect = "allow"
    permission_groups = [{
      id = "bf7481a1826f439697cb59a20b22293e" # Workers R2 Storage Write
    }, {
      id = "6a018a9f2fc74eb6b293b0c548f38b39" # Workers R2 Storage Bucket Item Read
    }, {
      id = "2efd5506f9c8494dacb1fa10a3e7d5b6" # Workers R2 Storage Bucket Item Write
    }]
    resources = {
      # Grant access to all R2 buckets in the account
      "com.cloudflare.api.account.${var.cloudflare_account_id}" = "*"
    }
  }]
}
