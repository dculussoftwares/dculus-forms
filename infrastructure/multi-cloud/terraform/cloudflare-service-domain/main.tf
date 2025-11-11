terraform {
  required_version = ">= 1.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  service_hostname = "${var.service_domain_prefix}-${var.environment}.${var.root_domain}"
}

# DNS record that routes the service hostname through Cloudflare to the Azure Container App ingress
resource "cloudflare_record" "form_services_backend" {
  zone_id = var.cloudflare_zone_id
  name    = local.service_hostname
  type    = "CNAME"
  value   = var.backend_fqdn
  proxied = true

  comment = "Managed by Terraform - routes traffic to Azure Container App backend"
}

resource "cloudflare_record" "form_services_validation" {
  count   = var.managed_certificate_validation_token != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "_acme-challenge.${local.service_hostname}"
  type    = "TXT"
  value   = var.managed_certificate_validation_token
  ttl     = 120

  comment = "Azure managed certificate validation token"

  depends_on = [cloudflare_record.form_services_backend]
}
