terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.43.0"
    }
  }
}

provider "cloudflare" {
  # The provider will automatically use CLOUDFLARE_API_TOKEN environment variable
  # No need to explicitly set api_token here
}
