// Azure AI Foundry (Azure OpenAI Service)
// Deployed separately from the Container App so it can be shared across envs
// and managed independently (model upgrades don't require app redeployment).

resource "azurerm_cognitive_account" "ai" {
  name                = "${local.app_name}-ai"
  resource_group_name = azurerm_resource_group.main.name
  // Azure OpenAI is not available in all regions — East US has broadest model availability
  location            = coalesce(var.ai_location, var.location)
  kind                = "OpenAI"
  sku_name            = "S0"
  tags                = var.tags

  public_network_access_enabled = true
}

resource "azurerm_cognitive_deployment" "gpt4o" {
  name                 = var.azure_openai_primary_deployment
  cognitive_account_id = azurerm_cognitive_account.ai.id

  model {
    format  = "OpenAI"
    name    = "gpt-4o"
    version = "2024-11-20"
  }

  sku {
    name     = "GlobalStandard"
    capacity = var.ai_primary_tpm
  }
}

resource "azurerm_cognitive_deployment" "gpt4o_mini" {
  name                 = var.azure_openai_fast_deployment
  cognitive_account_id = azurerm_cognitive_account.ai.id

  model {
    format  = "OpenAI"
    name    = "gpt-4o-mini"
    version = "2024-07-18"
  }

  sku {
    name     = "GlobalStandard"
    capacity = var.ai_fast_tpm
  }
}

output "ai_endpoint" {
  description = "Azure OpenAI endpoint — set as AZURE_OPENAI_ENDPOINT in Container App"
  value       = azurerm_cognitive_account.ai.endpoint
}

output "ai_resource_name" {
  description = "Azure OpenAI resource name — set as AZURE_OPENAI_RESOURCE_NAME in Container App"
  value       = azurerm_cognitive_account.ai.name
}
