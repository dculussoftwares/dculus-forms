# AI Model Swap: DeepSeek-V3-0324 + gpt-4.1-nano Design

**Date:** 2026-06-07
**Status:** Approved

## Goal

Replace the current Azure OpenAI models (`gpt-5.4-mini` primary, `gpt-5.4-nano` fast) with a cheaper combo that stays within the Azure ecosystem. Primary savings driver: output tokens for `gpt-5.4-mini` cost $4.50/1M — the new combo drops that to $0.89/1M (DeepSeek) and $0.40/1M (gpt-4.1-nano).

## Selected Models

| Role | Model | Endpoint type | Input / Output per 1M |
|---|---|---|---|
| Primary | `DeepSeek-V3-0324` | Azure AI Foundry MaaS (OpenAI-compatible) | $0.40 / $0.89 |
| Fast | `gpt-4.1-nano` | Azure OpenAI (same account) | $0.10 / $0.40 |

Both live under the existing `azurerm_cognitive_account` (`kind = "AIServices"`). Same account key for both.

**What each model handles:**
- Primary: form edit agent (ToolLoopAgent + multi-step tool calls), form generation (structured output), field insights (structured output)
- Fast: auto-title generation (simple fire-and-forget text)

## Design Principle: Generic Env Vars

Env vars are model-agnostic — names like `AI_PRIMARY_*` and `AI_FAST_*` rather than `AZURE_OPENAI_*` or `DEEPSEEK_*`. Swapping models in future requires only env var changes, zero code changes.

## Environment Variables

### New vars (backend `.env`)

```bash
# Primary model — complex tasks (form edit agent, form generation, field insights)
AI_PRIMARY_BASE_URL="https://<account>.services.ai.azure.com/models/DeepSeek-V3-0324"
AI_PRIMARY_API_KEY="<azure-ai-foundry-account-key>"
AI_PRIMARY_MODEL="DeepSeek-V3-0324"

# Fast model — lightweight tasks (auto-title generation)
AI_FAST_BASE_URL="https://<account>.openai.azure.com/"
AI_FAST_API_KEY="<same-azure-ai-foundry-account-key>"
AI_FAST_MODEL="gpt-4.1-nano"
AI_FAST_API_VERSION="2024-12-01-preview"   # presence signals Azure OpenAI path
```

### Retired vars

```bash
# Removed:
AI_PROVIDER
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_PRIMARY_DEPLOYMENT
AZURE_OPENAI_FAST_DEPLOYMENT
```

## Code Changes — `apps/backend/src/lib/ai.ts`

Single file rewrite. All callers (`formEditAgent.ts`, `aiService.ts`, `aiFieldInsightService.ts`, `aiChatService.ts`) use `getPrimaryModel()` / `getFastModel()` — their interfaces are unchanged.

### Provider routing logic

`AI_FAST_API_VERSION` being set is the branch signal:
- **Present** → fast model is an Azure OpenAI deployment → use `@ai-sdk/azure` (`createAzure`) with the api-version
- **Absent** → endpoint is OpenAI-compatible (Foundry MaaS) → use `@ai-sdk/openai` (`createOpenAI`) with custom `baseURL`

Both primary and fast share this same `buildModel()` helper. No new npm packages — `@ai-sdk/azure` and `@ai-sdk/openai` are already installed.

### Prompt caching

`buildPromptCacheOptions()` returns `undefined` when primary model does not use Azure OpenAI (DeepSeek uses implicit prefix caching, not key-based). Callers already handle `undefined` gracefully — no change needed.

### Telemetry

`getPrimaryModelId()` returns `process.env.AI_PRIMARY_MODEL` directly. No hardcoded model names.

### Token limits

`AI_TOKEN_LIMITS` stays unchanged — limits are per subscription plan, not per model.

## Terraform Changes

### `infrastructure/multi-cloud/terraform/azure/ai.tf`

**Remove:** `azurerm_cognitive_deployment.gpt54mini`

**Rename:** `azurerm_cognitive_deployment.gpt54nano` → `azurerm_cognitive_deployment.fast`
- model name: `gpt-4.1-nano`, version: `2025-04-14`, format: `OpenAI`

**Add:** `azurerm_cognitive_deployment.primary`
- model name: `DeepSeek-V3-0324`, version: `1`, format: `DeepSeek`
- Same `cognitive_account_id`, same `GlobalStandard` SKU

### `infrastructure/multi-cloud/terraform/azure/variables.tf`

**Remove:** `ai_provider`, `azure_openai_primary_deployment`, `azure_openai_fast_deployment`

**Add:**
```hcl
variable "ai_primary_model" {
  description = "Primary model deployment name"
  type        = string
  default     = "DeepSeek-V3-0324"
}

variable "ai_fast_model" {
  description = "Fast model deployment name"
  type        = string
  default     = "gpt-4.1-nano"
}
```

**Keep unchanged:** `ai_primary_tpm`, `ai_fast_tpm`, `ai_location`

### `infrastructure/multi-cloud/terraform/azure/main.tf` — Container App env vars

**Remove 5 blocks:** `AI_PROVIDER`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_PRIMARY_DEPLOYMENT`, `AZURE_OPENAI_FAST_DEPLOYMENT`

**Add 7 blocks:**
```hcl
env { name = "AI_PRIMARY_BASE_URL"
      value = "https://${azurerm_cognitive_account.ai.custom_subdomain_name}.services.ai.azure.com/models/${var.ai_primary_model}" }
env { name = "AI_PRIMARY_API_KEY"
      value = azurerm_cognitive_account.ai.primary_access_key }
env { name = "AI_PRIMARY_MODEL"
      value = var.ai_primary_model }
env { name = "AI_FAST_BASE_URL"
      value = azurerm_cognitive_account.ai.endpoint }
env { name = "AI_FAST_API_KEY"
      value = azurerm_cognitive_account.ai.primary_access_key }
env { name = "AI_FAST_MODEL"
      value = var.ai_fast_model }
env { name = "AI_FAST_API_VERSION"
      value = "2024-12-01-preview" }
```

## Full File Surface

| File | Change type |
|---|---|
| `apps/backend/src/lib/ai.ts` | Rewrite |
| `apps/backend/.env` | Env var swap |
| `apps/backend/.env.example` | Env var swap |
| `infrastructure/multi-cloud/terraform/azure/ai.tf` | Model deployment swap |
| `infrastructure/multi-cloud/terraform/azure/variables.tf` | Variable rename |
| `infrastructure/multi-cloud/terraform/azure/main.tf` | Env block swap |

## What Does NOT Change

- `formEditAgent.ts` — calls `getPrimaryModel()`, interface unchanged
- `aiService.ts` — calls `getPrimaryModel()`, interface unchanged
- `aiFieldInsightService.ts` — calls `getPrimaryModel()`, interface unchanged
- `aiChatService.ts` — calls `getFastModel()`, interface unchanged
- `aiUsageService.ts` — token budget logic is plan-based, not model-based
- `aiTelemetry.ts` — calls `getPrimaryModelId()`, interface unchanged
- All GraphQL resolvers, routes, tests

## Cost Comparison

| Role | Before | After | Savings |
|---|---|---|---|
| Primary output | $4.50/1M | $0.89/1M | ~5x |
| Primary input | $0.75/1M | $0.40/1M | ~2x |
| Fast output | $1.25/1M | $0.40/1M | ~3x |
| Fast input | $0.20/1M | $0.10/1M | 2x |
