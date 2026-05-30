# AI Model Configuration — Design Spec

**Date:** 2026-05-30  
**Status:** Approved  

---

## Goal

Make the AI model used for builder chat and form generation fully configurable at runtime — no redeployment needed. Admins can assign a different model per subscription plan via the admin-app UI. Both existing and new users are unaffected by the change: safe defaults are seeded on startup.

---

## Approach: Unified Foundry Endpoint + DB Config

Azure AI Foundry exposes an OpenAI-compatible API for all models (OpenAI and non-OpenAI) through a single `*.services.ai.azure.com/openai` endpoint. The DB stores one `AIModelConfig` row per plan. At request time the backend reads the user's plan, fetches the config from a 60s in-memory cache, and calls the appropriate model. No Terraform changes are needed to switch models after initial setup.

---

## Section 1 — Terraform

### Changes to `ai.tf`

- Remove the two `azurerm_cognitive_deployment` resources (`gpt4o`, `gpt4o_mini`). Foundry's pay-per-use MaaS handles model routing — no explicit deployments required.
- Keep `azurerm_cognitive_account.ai` exactly as-is (`kind = "AIServices"`, `project_management_enabled = true`).
- Add two outputs that are already computed but not yet wired into the Container App:
  - `AZURE_AI_FOUNDRY_ENDPOINT` → `https://{custom_subdomain}.services.ai.azure.com/openai`
  - `AZURE_AI_API_KEY` → same key as today (`azurerm_cognitive_account.ai.primary_access_key`)

### Changes to `variables.tf`

Remove variables that only existed to support the now-removed deployment resources:
- `azure_openai_primary_deployment`
- `azure_openai_fast_deployment`
- `ai_primary_tpm`
- `ai_fast_tpm`

Keep: `ai_location`, `ai_provider`.

### Changes to `main.tf`

In the Container App `env` block:
- Remove: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_PRIMARY_DEPLOYMENT`, `AZURE_OPENAI_FAST_DEPLOYMENT`
- Add: `AZURE_AI_FOUNDRY_ENDPOINT`, `AZURE_AI_API_KEY`

### GitHub Actions

No workflow changes needed. The new env vars flow automatically from Terraform outputs → Container App env vars, exactly like today's AI vars.

---

## Section 2 — Database & Backend

### Prisma Schema

```prisma
model AIModelConfig {
  id           String   @id @default(uuid())
  plan         String   @unique  // "free" | "starter" | "advanced"
  primaryModel String           // e.g. "gpt-4o", "Phi-4", "Meta-Llama-3.3-70B-Instruct"
  fastModel    String           // e.g. "gpt-4o-mini", "Phi-4-mini"
  updatedAt    DateTime @updatedAt
  updatedBy    String?          // userId of last admin who changed it
}
```

### Default Seeding

`aiConfigService.seedDefaults()` is called at backend startup. If no rows exist it inserts:

| Plan | Primary | Fast |
|------|---------|------|
| `free` | `gpt-4o` | `gpt-4o-mini` |
| `starter` | `gpt-4o` | `gpt-4o-mini` |
| `advanced` | `gpt-4o` | `gpt-4o-mini` |

All plans start identical to the current hardcoded behaviour — existing users see no change.

### `apps/backend/src/lib/ai.ts` (rewrite)

- Single `createAzure` client using `AZURE_AI_FOUNDRY_ENDPOINT` + `AZURE_AI_API_KEY`.
- The Foundry endpoint accepts any model name (OpenAI or non-OpenAI) in the same request format.
- Old `getPrimaryModel()` / `getFastModel()` replaced by:

```ts
export function getModelForPlan(plan: string, role: 'primary' | 'fast'): LanguageModel
```

- Hardcoded fallback: if config lookup fails → `gpt-4o` (primary) / `gpt-4o-mini` (fast). The app never errors due to missing config.
- `AI_TOKEN_LIMITS` constant stays as-is.

### `apps/backend/src/services/aiConfigService.ts` (new)

```ts
getConfig(plan: string): Promise<AIModelConfig>     // cached 60s
listConfigs(): Promise<AIModelConfig[]>
updateConfig(plan, primaryModel, fastModel, updatedBy): Promise<AIModelConfig>
seedDefaults(): Promise<void>                        // idempotent, called at startup
invalidateCache(): void
```

60s TTL in-memory cache (plain `Map` + timestamp). No external cache dependency.

### `apps/backend/src/graphql/resolvers/aiConfig.ts` (new)

```graphql
Query:
  aiModelConfigs: [AIModelConfig!]!   # admin/superAdmin only

Mutation:
  updateAIModelConfig(
    plan: String!
    primaryModel: String!
    fastModel: String!
  ): AIModelConfig!                   # admin/superAdmin only
```

Both guarded with `requireAuth` + system role check (`admin` or `superAdmin`).

### Updated call sites

- `aiChatService.ts` — `buildChatStream()` accepts `userPlan: string`, calls `getModelForPlan(userPlan, 'primary')`
- `aiService.ts` — `generateFormWithAI()` accepts `userPlan: string`, calls `getModelForPlan(userPlan, 'primary')`
- `aiChat.ts` route — resolves user's current plan from `Subscription` table and passes it down

### `SUPPORTED_MODELS` constant (new, in `aiConfigService.ts`)

Curated list of supported model names shown in admin dropdowns:

```ts
export const SUPPORTED_MODELS = [
  // OpenAI via Foundry
  { id: 'gpt-4o',           label: 'GPT-4o' },
  { id: 'gpt-4o-mini',      label: 'GPT-4o Mini' },
  { id: 'gpt-4.1',          label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini',     label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano',     label: 'GPT-4.1 Nano' },
  // Non-OpenAI via Foundry
  { id: 'Phi-4',                           label: 'Phi-4' },
  { id: 'Phi-4-mini',                      label: 'Phi-4 Mini' },
  { id: 'Meta-Llama-3.3-70B-Instruct',     label: 'Llama 3.3 70B' },
  { id: 'Mistral-Large-2411',              label: 'Mistral Large' },
  { id: 'Mistral-Small-24-09',             label: 'Mistral Small' },
];
```

---

## Section 3 — Admin UI

### New page: `apps/admin-app/src/pages/AIModelSettings.tsx`

Accessible at `/settings/ai-models`. Requires `admin` or `superAdmin` role.

UI layout — table with one row per plan, two dropdowns per row (primary model, fast model), single Save button:

```
AI Model Configuration

Plan       Primary Model              Fast Model
──────────────────────────────────────────────────────
Free       [GPT-4o          ▼]        [GPT-4o Mini  ▼]
Starter    [GPT-4o          ▼]        [GPT-4o Mini  ▼]
Advanced   [GPT-4o          ▼]        [GPT-4o Mini  ▼]
                                                [Save]
```

- Dropdowns populated from `SUPPORTED_MODELS` (returned by `aiModelConfigs` query).
- Save calls `updateAIModelConfig` mutation for each plan that changed.
- Uses existing `toastSuccess` / `toastError` for feedback.
- Linked from admin Settings nav.

---

## Backward Compatibility

- Existing users: unaffected. `seedDefaults()` only runs if the table is empty.
- If `AIModelConfig` row is missing for a plan at request time: falls back to `gpt-4o`/`gpt-4o-mini`.
- Old env vars (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`) removed from Terraform but the app no longer reads them — clean cut.
- DB migration runs before Container App starts in CI — table always exists at runtime.

---

## Out of Scope

- Per-user or per-organization model overrides (plan-level granularity is sufficient)
- Model availability validation (admin picks from the curated list — no live Azure API check)
- Token usage tracking per model (existing `AI_TOKEN_LIMITS` per plan is unchanged)
