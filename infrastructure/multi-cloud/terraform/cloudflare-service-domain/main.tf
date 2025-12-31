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
  service_hostname = var.environment == "production" ? "${var.service_domain_prefix}.${var.root_domain}" : "${var.service_domain_prefix}-${var.environment}.${var.root_domain}"
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

