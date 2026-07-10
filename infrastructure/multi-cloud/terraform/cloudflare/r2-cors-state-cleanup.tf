# One-time cleanup for PR #110.
#
# That PR's first draft configured private-bucket CORS via the aws provider
# (aws_s3_bucket_cors_configuration.private) before being corrected to use
# the native cloudflare_r2_bucket_cors resource in r2-cors.tf. The draft was
# briefly applied to the dev environment by a pull_request-triggered CI run
# (the same run that exposed the should_deploy gating bug fixed in
# multi-cloud-deployment.yml), leaving aws_s3_bucket_cors_configuration.private
# orphaned in dev's Terraform state once the aws resource was dropped from
# config. Every plan/apply since has failed trying to refresh it without an
# aws provider block present.
#
# destroy = false: this only forgets the state entry. It does not touch the
# real R2 bucket, whose CORS policy is already managed by
# cloudflare_r2_bucket_cors.private (r2-cors.tf).
#
# Delete this file together with the temporary aws provider block in main.tf
# once this has applied successfully (state list should no longer show
# aws_s3_bucket_cors_configuration.private).
removed {
  from = aws_s3_bucket_cors_configuration.private

  lifecycle {
    destroy = false
  }
}
