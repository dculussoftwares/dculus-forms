terraform {
  backend "azurerm" {
    resource_group_name  = "dculus-forms-terraform-state"
    storage_account_name = "dculusformstfstate"
    container_name       = "tfstate-production"
    key                  = "cloudflare-pages.tfstate"
  }
}
