# Cloudflare Managed Transforms
# Adds visitor location headers to requests sent to the backend

resource "cloudflare_managed_headers" "add_visitor_location_headers" {
  zone_id = var.cloudflare_zone_id

  managed_request_headers {
    id      = "add_visitor_location_headers"
    enabled = true
  }
}
