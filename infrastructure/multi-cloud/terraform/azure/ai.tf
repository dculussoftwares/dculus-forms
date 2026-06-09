// Azure AI Foundry resource
// kind = "AIServices" is the Foundry resource type — a superset of the old "OpenAI" kind.
// It preserves the existing OpenAI endpoint, API key, and all existing deployments while
// unlocking the broader model catalog (DeepSeek, Meta, Mistral, xAI), Agent service,
// and Foundry Tools. Requires managed identity, custom_subdomain_name, and
// project_management_enabled = true (maps to allowProjectManagement in ARM/Bicep).

resource "azurerm_cognitive_account" "ai" {
  name                = "${local.app_name}-ai"
  resource_group_name = azurerm_resource_group.main.name
  // Azure AI Foundry is not available in all regions — East US has broadest model availability
  location            = coalesce(var.ai_location, var.location)
  kind                = "AIServices"
  sku_name            = "S0"

  // Required for Foundry: enables project management and the broader model catalog
  project_management_enabled = true

  // Required for the Foundry API endpoint (*.services.ai.azure.com) and Entra ID auth
  custom_subdomain_name = "${local.app_name}-ai"

  // Required for Foundry upgrade: managed identity is used during the upgrade operation
  identity {
    type = "SystemAssigned"
  }

  public_network_access_enabled = true
  tags                          = var.tags
}

// Primary model — gpt-5.4-mini via Azure AI Services (GlobalStandard = pay-per-token)
resource "azurerm_cognitive_deployment" "primary" {
  name                 = var.ai_primary_model
  cognitive_account_id = azurerm_cognitive_account.ai.id

  model {
    format  = "OpenAI"
    name    = "gpt-5.4-mini"
    version = "2026-03-17"
  }

  sku {
    name     = "GlobalStandard"
    capacity = var.ai_primary_tpm
  }
}

// Fast model — gpt-5.4-nano via Azure AI Services (GlobalStandard = pay-per-token)
resource "azurerm_cognitive_deployment" "fast" {
  name                 = var.ai_fast_model
  cognitive_account_id = azurerm_cognitive_account.ai.id

  model {
    format  = "OpenAI"
    name    = "gpt-5.4-nano"
    version = "2026-03-17"
  }

  sku {
    name     = "GlobalStandard"
    capacity = var.ai_fast_tpm
  }
}

output "ai_endpoint" {
  description = "Azure OpenAI-compatible endpoint — set as AZURE_OPENAI_ENDPOINT in Container App (preserved after Foundry upgrade)"
  value       = azurerm_cognitive_account.ai.endpoint
}

output "ai_foundry_endpoint" {
  description = "Azure AI Foundry endpoint — use this for non-OpenAI Foundry models and Agent service"
  value       = "https://${azurerm_cognitive_account.ai.custom_subdomain_name}.services.ai.azure.com/"
}

output "ai_resource_name" {
  description = "Azure AI Foundry resource name — set as AZURE_OPENAI_RESOURCE_NAME in Container App"
  value       = azurerm_cognitive_account.ai.name
}
