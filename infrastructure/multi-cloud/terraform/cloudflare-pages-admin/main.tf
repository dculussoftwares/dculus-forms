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
  # The provider will automatically use CLOUDFLARE_API_TOKEN environment variable
  # No need to explicitly set api_token here
}

# Cloudflare Pages Project for admin-app
resource "cloudflare_pages_project" "admin_app" {
  account_id        = var.cloudflare_account_id
  name              = "form-admin-app-${var.environment}"
  production_branch = "main"

  # Build configuration (not used since we deploy via wrangler CLI)
  build_config {
    build_command   = ""
    destination_dir = ""
  }

  # Deployment configuration
  deployment_configs {
    production {
      compatibility_date  = "2024-01-01"
      compatibility_flags = []
    }
  }
}
