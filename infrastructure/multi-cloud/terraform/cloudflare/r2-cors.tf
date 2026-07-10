# CORS configuration for the private R2 bucket.
#
# Needed by form-app's PDF Templates designer: when opening a template built
# from an uploaded base PDF, the browser fetches the PDF directly from R2 via
# a pre-signed URL (to hydrate pdfme's Designer) — a cross-origin `fetch()`
# that Chrome blocks without a matching Access-Control-Allow-Origin response
# header. R2 buckets have no CORS policy by default, which is why this was
# failing with "No 'Access-Control-Allow-Origin' header is present".
#
# Scoped to the private bucket only: the public bucket is served through the
# public-cdn-{env}.dculus.com custom domain (see r2-custom-domains.tf), not
# fetched cross-origin from form-app directly, so it doesn't need this.
resource "aws_s3_bucket_cors_configuration" "private" {
  bucket = cloudflare_r2_bucket.private.name

  cors_rule {
    allowed_methods = ["GET"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}
