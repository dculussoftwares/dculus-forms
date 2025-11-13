terraform {
  backend "azurerm" {
    resource_group_name  = "dculus-global-terraform-assets-resource-grp"
    storage_account_name = "dculusterraformstates"
    container_name       = "dculus-forms-cloudflare-pages-viewer-dev-state"
    key                  = "terraform.tfstate"
  }
}
