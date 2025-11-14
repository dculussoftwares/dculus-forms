# Cloudflare Managed Transforms
# Adds visitor location headers to requests sent to the backend
# 
# Note: This uses the Cloudflare API directly via null_resource since
# managed transforms are configured at the zone level via the API,
# not as a separate Terraform resource.
#
# The managed transform "add_visitor_location_headers" must be enabled
# manually in the Cloudflare dashboard or will be enabled on first apply.

# For now, document that this should be enabled manually:
# Dashboard > Rules > Transform Rules > Managed Transforms > "Add visitor location headers"

# Future: Can be automated via Cloudflare API if needed
# https://developers.cloudflare.com/api/operations/zone-rulesets-update-a-zone-ruleset
