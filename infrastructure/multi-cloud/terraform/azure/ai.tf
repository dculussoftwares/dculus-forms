// Azure AI Foundry resource
// kind = "AIServices" unlocks the full model catalog (Phi-4, Llama, Mistral, OpenAI)
// via a single OpenAI-compatible endpoint. No explicit deployment resources needed —
// models are addressed by name through the Foundry MaaS API.

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
