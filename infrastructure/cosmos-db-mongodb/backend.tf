terraform {
  backend "azurerm" {
    resource_group_name  = "dculus-global-terraform-assets-resource-grp"
    storage_account_name = "dculusterraformstates"
    container_name       = "cosmos-db-mongodb-deployment"
    key                  = "terraform.tfstate"
  }
}