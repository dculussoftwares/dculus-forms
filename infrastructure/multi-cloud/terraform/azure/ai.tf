// Azure AI Foundry resource
// kind = "AIServices" unlocks the full model catalog (Phi-4, Llama, Mistral, OpenAI)
// via a single OpenAI-compatible /openai/v1/ endpoint (no deployment ID in URL path).
// Explicit deployments below provide reserved capacity for the default GPT-4o models.
// Admins can switch to any model at runtime via the AI Model Config admin page without
// changing infrastructure — the Foundry endpoint routes by model name in the request body.

resource "azurerm_cognitive_account" "ai" {
  name                = "${local.app_name}-ai"
  resource_group_name = azurerm_resource_group.main.name
  location            = coalesce(var.ai_location, var.location)
  kind                = "AIServices"
  sku_name            = "S0"

  project_management_enabled = true
  custom_subdomain_name      = "${local.app_name}-ai"

  identity {
    type = "SystemAssigned"
  }

  public_network_access_enabled = true
  tags                          = var.tags
}

// Default model deployments — provide reserved GlobalStandard capacity.
// The backend routes all AI calls through the Foundry /v1/ endpoint, so the
// model name in the request body selects the model, not the deployment name.
// These deployments ensure gpt-4o and gpt-4o-mini are always available without
// depending on serverless/MaaS availability in the target region.

resource "azurerm_cognitive_deployment" "gpt4o" {
  name                 = "gpt-4o"
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
  name                 = "gpt-4o-mini"
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
  description = "Azure OpenAI-compatible endpoint (legacy, preserved for reference)"
  value       = azurerm_cognitive_account.ai.endpoint
}

output "ai_foundry_endpoint" {
  description = "Azure AI Foundry unified endpoint — supports all models (OpenAI + non-OpenAI)"
  value       = "https://${azurerm_cognitive_account.ai.custom_subdomain_name}.services.ai.azure.com/"
}

output "ai_api_key" {
  description = "Azure AI Foundry API key"
  value       = azurerm_cognitive_account.ai.primary_access_key
  sensitive   = true
}

output "ai_resource_name" {
  description = "Azure AI Foundry resource name"
  value       = azurerm_cognitive_account.ai.name
}
