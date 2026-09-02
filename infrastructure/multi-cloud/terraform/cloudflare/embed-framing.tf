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
# ── Why exactly one environment owns this ────────────────────────────────────
# Environments that share a Cloudflare zone run this stack with separate state.
# A zone can hold exactly one entrypoint ruleset per phase
# (`http_response_headers_transform` here), and the provider's Create is not an
# upsert — a second environment applying would fail with "already exists". So
# `var.manage_embed_framing` gates the resource: keep it true for exactly one
# environment and false for the rest. That one rule's expression lists every
# environment's viewer host (var.viewer_embed_framing_hosts), so a single apply
# covers them all.
#
# This repo owns it from **dev** (dev/terraform.tfvars) — `main` deploys dev on
# every push while production only deploys on a `v*` tag, so gating to production
# (as #339 first did) left the rule unapplied for days and failed the @embed
# E2E scenarios on every run. A single-environment deployment (e.g. a fork
# running only production) can just leave the default `true`.
#
# If the zone ever gains a hand-made response-header transform rule, the first
# apply here fails; import the existing ruleset and fold its rules in.
#
# See docs/form-embed-v1-spec.md §15.6 and apps/form-viewer/public/_headers.

variable "manage_embed_framing" {
  description = <<-EOT
    Whether THIS stack creates the zone-level Response Header Transform Rule that
    makes the viewer's /embed/* route framable by any site. The rule is a zone
    singleton, so when several environments share one zone exactly one of them
    must own it (true here, false in the others). A single-environment
    deployment can leave the default.
  EOT
  type    = bool
  default = true
}

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
  # One environment owns the zone singleton — see the note above.
  count = var.manage_embed_framing ? 1 : 0

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
