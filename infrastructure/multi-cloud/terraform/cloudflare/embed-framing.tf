# Form Embed v1 — let the viewer's /embed/* route be framed by any site.
#
# The `dculus.com` zone has the "Add security headers" Managed Transform enabled,
# which stamps `X-Frame-Options: SAMEORIGIN` onto every response in the zone
# (visible even on form-app-*, which ships no `_headers` file). That header has no
# "any origin" value and runs downstream of Cloudflare Pages, so the viewer's
# `public/_headers` cannot undo it. Without this rule the inline and lightbox
# embed types render blank — in the Collect panel preview and on every host page.
#
# This is a zone-level Response Header Transform Rule. A custom transform rule
# runs AFTER Managed Transforms and after the Pages `_headers` file, so its
# operations win:
#   - remove  X-Frame-Options            → no legacy framing block
#   - set     Content-Security-Policy     → `frame-ancestors *`, replacing the
#                                           combined `* , 'self'` that `_headers`
#                                           would otherwise emit on this path
# Everything outside viewer `/embed/*` is untouched and keeps SAMEORIGIN.
#
# ── Why this lives in the R2/zone stack and is gated to one environment ───────
# The three environments share one Cloudflare zone but run this stack with
# separate state. A zone can hold exactly one entrypoint ruleset per phase
# (`http_response_headers_transform` here), and the provider's Create is not an
# upsert — a second environment applying would fail with "already exists". So a
# single environment owns it, and its one rule lists the viewer hostnames of
# ALL environments (see var.viewer_embed_framing_hosts below).
#
# That owner is `dev`, not production: only `main` -> dev deploys on every push,
# while production deploys only on a `v*` tag. #339 originally gated this to
# production and the rule then sat unapplied for days — every deploy that ran
# the E2E suite failed the two @embed iframe scenarios because /embed/* on the
# deployed viewer still carried `X-Frame-Options: SAMEORIGIN`. Gating to dev
# means the next push to main creates the zone rule for all three environments.
# A later production/staging deploy sees count=0 here and leaves it alone.
#
# If the zone ever gains a hand-made response-header transform rule, this
# resource's first apply will fail; import the existing ruleset and fold its
# rules in here.
#
# See docs/form-embed-v1-spec.md §15.6 and apps/form-viewer/public/_headers.

variable "viewer_embed_framing_hosts" {
  description = "Viewer hostnames whose /embed/* path must be framable by any site (all environments — this is a zone-wide rule)."
  type        = list(string)
  default = [
    "viewer.dculus.com",             # production
    "viewer-app-staging.dculus.com", # staging
    "viewer-app-dev.dculus.com",     # dev
  ]
}

locals {
  # Cloudflare Rules list literal: {"a" "b" "c"} (space-separated, quoted).
  embed_framing_expression = format(
    "(http.host in {%s} and starts_with(http.request.uri.path, \"/embed/\"))",
    join(" ", [for h in var.viewer_embed_framing_hosts : jsonencode(h)])
  )
}

resource "cloudflare_ruleset" "embed_framing" {
  # Owned by dev — the environment that actually deploys on every push to main.
  count = var.environment == "dev" ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  name        = "Form Embed - allow framing of viewer /embed/*"
  description = "Managed by Terraform (cloudflare/embed-framing.tf). Removes X-Frame-Options and opens frame-ancestors for the viewer embed route across all environments."
  kind        = "zone"
  phase       = "http_response_headers_transform"

  rules = [{
    ref         = "form_embed_allow_framing"
    description = "Viewer /embed/* is embedded on third-party pages"
    expression  = local.embed_framing_expression
    action      = "rewrite"
    action_parameters = {
      headers = {
        "X-Frame-Options" = {
          operation = "remove"
        }
        "Content-Security-Policy" = {
          operation = "set"
          value     = "frame-ancestors *"
        }
      }
    }
  }]
}
