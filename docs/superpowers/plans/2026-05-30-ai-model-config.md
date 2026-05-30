# AI Model Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded GPT-4o deployments with a DB-driven, per-plan model config that lets admins switch models at runtime via an admin UI — with zero impact on existing users.

**Architecture:** Azure AI Foundry exposes a single OpenAI-compatible endpoint (`*.services.ai.azure.com/openai`) for all models (GPT, Phi-4, Llama, Mistral). A new `AIModelConfig` DB table maps each subscription plan to a primary + fast model. A 60-second in-memory cache keeps DB reads minimal. Safe defaults (`gpt-4o` / `gpt-4o-mini`) are seeded on first startup so existing users see no change.

**Tech Stack:** Terraform (azurerm ≥4.57), Prisma (existing), Vercel AI SDK `@ai-sdk/azure`, Vitest, Apollo Client (admin-app), React + shadcn/ui.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `infrastructure/multi-cloud/terraform/azure/ai.tf` |
| Modify | `infrastructure/multi-cloud/terraform/azure/main.tf` |
| Modify | `infrastructure/multi-cloud/terraform/azure/variables.tf` |
| Modify | `apps/backend/prisma/schema.prisma` |
| **Create** | `apps/backend/src/services/aiConfigService.ts` |
| **Create** | `apps/backend/src/services/__tests__/aiConfigService.test.ts` |
| Modify | `apps/backend/src/lib/ai.ts` |
| Modify | `apps/backend/src/services/aiChatService.ts` |
| Modify | `apps/backend/src/services/aiService.ts` |
| Modify | `apps/backend/src/routes/aiChat.ts` |
| Modify | `apps/backend/src/graphql/resolvers/ai.ts` |
| Modify | `apps/backend/src/index.ts` |
| Modify | `apps/backend/src/graphql/schema.ts` |
| **Create** | `apps/backend/src/graphql/resolvers/aiConfig.ts` |
| Modify | `apps/backend/src/graphql/resolvers.ts` |
| **Create** | `apps/backend/src/graphql/resolvers/__tests__/aiConfig.test.ts` |
| Modify | `apps/backend/src/services/__tests__/aiChatService.test.ts` |
| **Create** | `apps/admin-app/src/locales/en/aiModelConfig.json` |
| Modify | `apps/admin-app/src/locales/index.ts` |
| **Create** | `apps/admin-app/src/graphql/aiModelConfig.ts` |
| **Create** | `apps/admin-app/src/pages/AIModelSettings.tsx` |
| Modify | `apps/admin-app/src/App.tsx` |
| Modify | `apps/admin-app/src/components/AdminLayout.tsx` |

---

## Task 1: Terraform — Remove Hardcoded Deployments, Wire Foundry Env Vars

**Files:**
- Modify: `infrastructure/multi-cloud/terraform/azure/ai.tf`
- Modify: `infrastructure/multi-cloud/terraform/azure/main.tf`
- Modify: `infrastructure/multi-cloud/terraform/azure/variables.tf`

- [ ] **Step 1: Rewrite `ai.tf`**

Replace the entire file:

```hcl
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
```

- [ ] **Step 2: Update AI env vars in Container App (`main.tf`)**

In `main.tf`, find the four AI-related `env` blocks inside `azurerm_container_app.backend > template > container`:

```hcl
      env {
        name  = "AZURE_OPENAI_ENDPOINT"
        value = azurerm_cognitive_account.ai.endpoint
      }

      env {
        name  = "AZURE_OPENAI_API_KEY"
        value = azurerm_cognitive_account.ai.primary_access_key
      }

      env {
        name  = "AZURE_OPENAI_PRIMARY_DEPLOYMENT"
        value = var.azure_openai_primary_deployment
      }

      env {
        name  = "AZURE_OPENAI_FAST_DEPLOYMENT"
        value = var.azure_openai_fast_deployment
      }
```

Replace those four blocks with:

```hcl
      env {
        name  = "AZURE_AI_FOUNDRY_ENDPOINT"
        value = "https://${azurerm_cognitive_account.ai.custom_subdomain_name}.services.ai.azure.com/"
      }

      env {
        name  = "AZURE_AI_API_KEY"
        value = azurerm_cognitive_account.ai.primary_access_key
      }
```

- [ ] **Step 3: Remove deployment-specific variables from `variables.tf`**

Delete these four variable blocks (they only existed to configure the now-removed `azurerm_cognitive_deployment` resources):

```hcl
variable "azure_openai_primary_deployment" { ... }
variable "azure_openai_fast_deployment" { ... }
variable "ai_primary_tpm" { ... }
variable "ai_fast_tpm" { ... }
```

Keep: `ai_location`, `ai_provider`.

- [ ] **Step 4: Commit**

```bash
git add infrastructure/multi-cloud/terraform/azure/ai.tf \
        infrastructure/multi-cloud/terraform/azure/main.tf \
        infrastructure/multi-cloud/terraform/azure/variables.tf
git commit -m "feat(terraform): switch to Foundry unified endpoint, remove hardcoded model deployments"
```

---

## Task 2: Prisma — Add AIModelConfig Model

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Add the model to `schema.prisma`**

Append at the end of `apps/backend/prisma/schema.prisma`:

```prisma
model AIModelConfig {
  id           String   @id @default(cuid())
  plan         String   @unique
  primaryModel String
  fastModel    String
  updatedAt    DateTime @updatedAt
  updatedBy    String?

  @@map("ai_model_config")
}
```

- [ ] **Step 2: Create and apply migration**

```bash
cd apps/backend
pnpm exec prisma migrate dev --name add_ai_model_config
```

Expected output includes: `✔ Generated Prisma Client` and a new file under `prisma/migrations/`.

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm db:generate
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat(db): add AIModelConfig table for per-plan AI model configuration"
```

---

## Task 3: aiConfigService — Cache + seedDefaults (TDD)

**Files:**
- Create: `apps/backend/src/services/__tests__/aiConfigService.test.ts`
- Create: `apps/backend/src/services/aiConfigService.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/backend/src/services/__tests__/aiConfigService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    aIModelConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../../lib/prisma.js';
import {
  getConfig,
  listConfigs,
  updateConfig,
  seedDefaults,
  invalidateCache,
  SUPPORTED_MODELS,
} from '../aiConfigService.js';

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCache();
});

const mockFreeConfig = {
  id: 'cfg_1',
  plan: 'free',
  primaryModel: 'gpt-4o',
  fastModel: 'gpt-4o-mini',
  updatedAt: new Date(),
  updatedBy: null,
};

describe('getConfig', () => {
  it('returns config from DB for a given plan', async () => {
    (prisma.aIModelConfig.findUnique as any).mockResolvedValue(mockFreeConfig);
    const result = await getConfig('free');
    expect(result.primaryModel).toBe('gpt-4o');
    expect(result.fastModel).toBe('gpt-4o-mini');
    expect(prisma.aIModelConfig.findUnique).toHaveBeenCalledWith({ where: { plan: 'free' } });
  });

  it('returns fallback defaults when DB returns null', async () => {
    (prisma.aIModelConfig.findUnique as any).mockResolvedValue(null);
    const result = await getConfig('free');
    expect(result.primaryModel).toBe('gpt-4o');
    expect(result.fastModel).toBe('gpt-4o-mini');
  });

  it('serves from cache on second call', async () => {
    (prisma.aIModelConfig.findUnique as any).mockResolvedValue(mockFreeConfig);
    await getConfig('free');
    await getConfig('free');
    expect(prisma.aIModelConfig.findUnique).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after invalidateCache', async () => {
    (prisma.aIModelConfig.findUnique as any).mockResolvedValue(mockFreeConfig);
    await getConfig('free');
    invalidateCache();
    await getConfig('free');
    expect(prisma.aIModelConfig.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('listConfigs', () => {
  it('returns all configs from DB', async () => {
    (prisma.aIModelConfig.findMany as any).mockResolvedValue([mockFreeConfig]);
    const result = await listConfigs();
    expect(result).toHaveLength(1);
    expect(result[0].plan).toBe('free');
  });
});

describe('updateConfig', () => {
  it('upserts config and invalidates cache', async () => {
    const updated = { ...mockFreeConfig, primaryModel: 'Phi-4', updatedBy: 'user_1' };
    (prisma.aIModelConfig.upsert as any).mockResolvedValue(updated);
    const result = await updateConfig('free', 'Phi-4', 'gpt-4o-mini', 'user_1');
    expect(prisma.aIModelConfig.upsert).toHaveBeenCalledWith({
      where: { plan: 'free' },
      update: { primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini', updatedBy: 'user_1' },
      create: { plan: 'free', primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini', updatedBy: 'user_1' },
    });
    expect(result.primaryModel).toBe('Phi-4');
  });
});

describe('seedDefaults', () => {
  it('creates rows when table is empty', async () => {
    (prisma.aIModelConfig.count as any).mockResolvedValue(0);
    (prisma.aIModelConfig.create as any).mockResolvedValue({});
    await seedDefaults();
    expect(prisma.aIModelConfig.create).toHaveBeenCalledTimes(3);
  });

  it('skips creation when rows already exist', async () => {
    (prisma.aIModelConfig.count as any).mockResolvedValue(3);
    await seedDefaults();
    expect(prisma.aIModelConfig.create).not.toHaveBeenCalled();
  });
});

describe('SUPPORTED_MODELS', () => {
  it('includes gpt-4o and Phi-4', () => {
    const ids = SUPPORTED_MODELS.map(m => m.id);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('Phi-4');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/backend
pnpm test:unit -- aiConfigService
```

Expected: all tests fail with "Cannot find module '../aiConfigService.js'".

- [ ] **Step 3: Implement `aiConfigService.ts`**

Create `apps/backend/src/services/aiConfigService.ts`:

```ts
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const SUPPORTED_MODELS = [
  { id: 'gpt-4o',      label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'gpt-4.1',     label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { id: 'Phi-4',                       label: 'Phi-4' },
  { id: 'Phi-4-mini',                  label: 'Phi-4 Mini' },
  { id: 'Meta-Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
  { id: 'Mistral-Large-2411',          label: 'Mistral Large' },
  { id: 'Mistral-Small-24-09',         label: 'Mistral Small' },
] as const;

const DEFAULTS: Record<string, { primaryModel: string; fastModel: string }> = {
  free:     { primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' },
  starter:  { primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' },
  advanced: { primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' },
};

const FALLBACK = { primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' };
const CACHE_TTL_MS = 60_000;

type CachedEntry = { data: { primaryModel: string; fastModel: string }; expiresAt: number };
const cache = new Map<string, CachedEntry>();

export function invalidateCache(): void {
  cache.clear();
}

export async function getConfig(plan: string): Promise<{ primaryModel: string; fastModel: string }> {
  const now = Date.now();
  const cached = cache.get(plan);
  if (cached && cached.expiresAt > now) return cached.data;

  try {
    const row = await prisma.aIModelConfig.findUnique({ where: { plan } });
    const data = row
      ? { primaryModel: row.primaryModel, fastModel: row.fastModel }
      : (DEFAULTS[plan] ?? FALLBACK);
    cache.set(plan, { data, expiresAt: now + CACHE_TTL_MS });
    return data;
  } catch (err) {
    logger.warn({ err, plan }, 'aiConfigService.getConfig failed, using fallback');
    return DEFAULTS[plan] ?? FALLBACK;
  }
}

export async function listConfigs() {
  return prisma.aIModelConfig.findMany({ orderBy: { plan: 'asc' } });
}

export async function updateConfig(
  plan: string,
  primaryModel: string,
  fastModel: string,
  updatedBy: string
) {
  const result = await prisma.aIModelConfig.upsert({
    where: { plan },
    update: { primaryModel, fastModel, updatedBy },
    create: { plan, primaryModel, fastModel, updatedBy },
  });
  cache.delete(plan);
  return result;
}

export async function seedDefaults(): Promise<void> {
  try {
    const count = await prisma.aIModelConfig.count();
    if (count > 0) return;
    logger.info('Seeding default AI model configs...');
    for (const [plan, models] of Object.entries(DEFAULTS)) {
      await prisma.aIModelConfig.create({ data: { plan, ...models } });
    }
    logger.info('AI model config defaults seeded');
  } catch (err) {
    logger.warn({ err }, 'seedDefaults failed — app will use in-memory fallbacks');
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test:unit -- aiConfigService
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/aiConfigService.ts \
        apps/backend/src/services/__tests__/aiConfigService.test.ts
git commit -m "feat(backend): add aiConfigService with per-plan model config and 60s cache"
```

---

## Task 4: Rewrite `ai.ts` — Foundry Endpoint + Plan-Based Model Selection

**Files:**
- Modify: `apps/backend/src/lib/ai.ts`

- [ ] **Step 1: Replace `ai.ts` entirely**

```ts
import { createAzure } from '@ai-sdk/azure';
import type { LanguageModel } from 'ai';
import { getConfig } from '../services/aiConfigService.js';

// Single Foundry client — the *.services.ai.azure.com/openai endpoint is
// OpenAI-compatible and routes to any model (GPT, Phi-4, Llama, Mistral)
// by deployment/model name. Same API key and format for all.
function buildClient() {
  const endpoint = process.env.AZURE_AI_FOUNDRY_ENDPOINT ?? '';
  const apiKey   = process.env.AZURE_AI_API_KEY ?? '';
  return createAzure({
    baseURL: `${endpoint}openai`,
    apiKey,
  });
}

export async function getModelForPlan(plan: string, role: 'primary' | 'fast'): Promise<LanguageModel> {
  try {
    const config = await getConfig(plan);
    const modelName = role === 'primary' ? config.primaryModel : config.fastModel;
    return buildClient().chat(modelName);
  } catch {
    const fallback = role === 'primary' ? 'gpt-4o' : 'gpt-4o-mini';
    return buildClient().chat(fallback);
  }
}

export const AI_TOKEN_LIMITS: Record<string, number> = {
  free:     50_000,
  starter:  500_000,
  advanced: 5_000_000,
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/lib/ai.ts
git commit -m "feat(backend): rewrite ai.ts to use Azure AI Foundry unified endpoint with plan-based model selection"
```

---

## Task 5: Update `aiChatService.ts` and `aiService.ts` to Accept Plan

**Files:**
- Modify: `apps/backend/src/services/aiChatService.ts`
- Modify: `apps/backend/src/services/aiService.ts`

- [ ] **Step 1: Update `aiChatService.ts`**

In `aiChatService.ts`, make three changes:

**1. Update `buildChatStream` signature** (add `userPlan` as 4th param):

```ts
export async function buildChatStream(
  conversationId: string,
  userId: string,
  currentPageId: string | undefined,
  userPlan: string,
) {
```

**2. Replace the `getPrimaryModel()` call inside `buildChatStream`** with:

```ts
  const model = await getModelForPlan(userPlan, 'primary');

  const stream = streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(8),
  }) as unknown as { fullStream: AsyncIterable<any>; text: Promise<string>; usage: Promise<{ totalTokens: number }> };
```

**3. Update `autoGenerateTitle` signature** (add `userPlan` param) and replace `getFastModel()`:

```ts
export function autoGenerateTitle(conversationId: string, firstMessage: string, userPlan: string): void {
  getModelForPlan(userPlan, 'fast')
    .then((model) =>
      generateText({
        model,
        prompt: `Generate a short title (max 7 words, no quotes) for a form editing conversation that starts with: "${firstMessage.slice(0, 200)}"`,
      })
    )
    .then(({ text }) => {
      const title = text.trim().slice(0, 60);
      return prisma.aIChatConversation.update({ where: { id: conversationId }, data: { title } });
    })
    .catch((err) => logger.warn({ err, conversationId }, 'Failed to auto-generate conversation title'));
}
```

**4. Update the import** at the top — replace `getPrimaryModel, getFastModel` with `getModelForPlan`:

```ts
import { getModelForPlan } from '../lib/ai.js';
```

- [ ] **Step 2: Update `aiService.ts`**

**1. Update the import** — replace `getPrimaryModel` with `getModelForPlan`:

```ts
import { getModelForPlan } from '../lib/ai.js';
```

**2. Update `generateFormWithAI` signature** (add `userPlan` param with default):

```ts
export async function generateFormWithAI(
  prompt: string,
  mode: AIFormMode = 'standard',
  userPlan: string = 'free'
): Promise<AIGeneratedForm> {
```

**3. Replace `getPrimaryModel()` call** inside the function body:

```ts
  const { output, usage } = await generateText({
    model: await getModelForPlan(userPlan, 'primary'),
    output: Output.object({ schema: AIFormSchema }),
    system: MODE_SYSTEM_PROMPTS[mode],
    prompt: `Create a form for: ${prompt}`,
  });
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/services/aiChatService.ts \
        apps/backend/src/services/aiService.ts
git commit -m "feat(backend): aiChatService and aiService now accept userPlan for model selection"
```

---

## Task 6: Update Route and AI Resolver to Pass Plan

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts`
- Modify: `apps/backend/src/graphql/resolvers/ai.ts`

- [ ] **Step 1: Update `aiChat.ts` route**

Add a plan lookup before step 5 (`// 5. Build stream`). Import `prisma` and look up the subscription:

**Add import at top** (prisma is not yet imported in this file):

```ts
import { prisma } from '../lib/prisma.js';
```

**Add plan lookup** between the `autoGenerateTitle` call and the `buildChatStream` call:

```ts
    // 5. Resolve subscription plan for model selection
    const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
    const userPlan = subscription?.planId ?? 'free';

    // 6. Build stream
    const stream = await buildChatStream(conversationId, auth.user!.id, currentPageId, userPlan);
```

(Remove the old comment `// 5. Build stream` — renumber to 6.)

**Update `autoGenerateTitle` call** (add `userPlan`):

```ts
      autoGenerateTitle(conversationId, content, userPlan);
```

- [ ] **Step 2: Update AI resolver (`resolvers/ai.ts`)**

**Add prisma import** at top:

```ts
import { prisma } from '../../lib/prisma.js';
```

**Update `generateFormWithAI` mutation** — look up plan and pass it:

```ts
    generateFormWithAI: async (
      _: any,
      { prompt, organizationId, mode = 'standard' }: { prompt: string; organizationId: string; mode?: AIFormMode },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);

      if (!prompt || prompt.trim().length < 3) {
        throw createGraphQLError('Prompt must be at least 3 characters', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      if (prompt.length > 1000) {
        throw createGraphQLError('Prompt must be 1000 characters or less', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      const budget = await checkAITokenBudget(organizationId);
      if (!budget.allowed) {
        throw createGraphQLError(
          `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} tokens used this month). Upgrade your plan to continue.`,
          GRAPHQL_ERROR_CODES.AI_TOKEN_LIMIT_EXCEEDED
        );
      }

      try {
        const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
        const userPlan = subscription?.planId ?? 'free';
        const result = await generateFormWithAI(prompt.trim(), mode, userPlan);
        await recordAITokenUsage(organizationId, result.tokensUsed);
        return result;
      } catch (error) {
        logger.error({ err: error, organizationId }, 'AI form generation failed');
        throw createGraphQLError(
          'AI form generation failed. Please try again.',
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts \
        apps/backend/src/graphql/resolvers/ai.ts
git commit -m "feat(backend): pass subscription plan to AI model selection in chat route and form generation resolver"
```

---

## Task 7: Call `seedDefaults` at Backend Startup

**Files:**
- Modify: `apps/backend/src/index.ts`

- [ ] **Step 1: Add import**

At the top of `apps/backend/src/index.ts`, after the existing service imports, add:

```ts
import { seedDefaults as seedAIModelDefaults } from './services/aiConfigService.js';
```

- [ ] **Step 2: Call `seedDefaults` in `startServer()`**

Inside the `startServer()` function, after `initializeSubscriptionSystem()` and before `await server.start()`, add:

```ts
  // Seed default AI model config (no-op if rows already exist)
  await seedAIModelDefaults();
```

- [ ] **Step 3: Run type check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/index.ts
git commit -m "feat(backend): seed default AI model configs on startup"
```

---

## Task 8: GraphQL Schema + aiConfig Resolver (TDD)

**Files:**
- Modify: `apps/backend/src/graphql/schema.ts`
- Create: `apps/backend/src/graphql/resolvers/__tests__/aiConfig.test.ts`
- Create: `apps/backend/src/graphql/resolvers/aiConfig.ts`
- Modify: `apps/backend/src/graphql/resolvers.ts`

- [ ] **Step 1: Add types to `schema.ts`**

In `apps/backend/src/graphql/schema.ts`, at the end of the `Query` type add:

```graphql
    # Admin: AI Model Config Queries
    aiModelConfigs: [AIModelConfig!]!
    aiSupportedModels: [AIModelOption!]!
```

At the end of the `Mutation` type add:

```graphql
    # Admin: AI Model Config Mutations
    updateAIModelConfig(plan: String!, primaryModel: String!, fastModel: String!): AIModelConfig!
```

After the closing brace of the `Mutation` type, add new types:

```graphql
  type AIModelConfig {
    id: ID!
    plan: String!
    primaryModel: String!
    fastModel: String!
    updatedAt: String!
    updatedBy: String
  }

  type AIModelOption {
    id: String!
    label: String!
  }
```

- [ ] **Step 2: Write the failing resolver tests**

Create `apps/backend/src/graphql/resolvers/__tests__/aiConfig.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/aiConfigService.js', () => ({
  listConfigs: vi.fn(),
  updateConfig: vi.fn(),
  SUPPORTED_MODELS: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'Phi-4',  label: 'Phi-4' },
  ],
}));

import { aiConfigResolvers } from '../aiConfig.js';
import { listConfigs, updateConfig } from '../../../services/aiConfigService.js';

const adminAuth = { isAuthenticated: true, user: { id: 'u1', role: 'admin' }, session: {} };
const superAdminAuth = { isAuthenticated: true, user: { id: 'u2', role: 'superAdmin' }, session: {} };
const userAuth = { isAuthenticated: true, user: { id: 'u3', role: 'user' }, session: {} };
const unauthenticated = { isAuthenticated: false, user: null, session: null };

beforeEach(() => vi.clearAllMocks());

describe('aiModelConfigs query', () => {
  it('returns config list for admin', async () => {
    (listConfigs as any).mockResolvedValue([{ id: '1', plan: 'free', primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' }]);
    const result = await aiConfigResolvers.Query.aiModelConfigs({}, {}, { auth: adminAuth });
    expect(result).toHaveLength(1);
    expect(result[0].plan).toBe('free');
  });

  it('returns config list for superAdmin', async () => {
    (listConfigs as any).mockResolvedValue([]);
    const result = await aiConfigResolvers.Query.aiModelConfigs({}, {}, { auth: superAdminAuth });
    expect(Array.isArray(result)).toBe(true);
  });

  it('throws for non-admin user', async () => {
    await expect(
      aiConfigResolvers.Query.aiModelConfigs({}, {}, { auth: userAuth })
    ).rejects.toThrow();
  });

  it('throws for unauthenticated', async () => {
    await expect(
      aiConfigResolvers.Query.aiModelConfigs({}, {}, { auth: unauthenticated })
    ).rejects.toThrow();
  });
});

describe('aiSupportedModels query', () => {
  it('returns supported models list for admin', async () => {
    const result = await aiConfigResolvers.Query.aiSupportedModels({}, {}, { auth: adminAuth });
    expect(result.map((m: any) => m.id)).toContain('gpt-4o');
    expect(result.map((m: any) => m.id)).toContain('Phi-4');
  });
});

describe('updateAIModelConfig mutation', () => {
  it('updates config and returns updated row for admin', async () => {
    const updated = { id: '1', plan: 'free', primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini', updatedAt: new Date(), updatedBy: 'u1' };
    (updateConfig as any).mockResolvedValue(updated);
    const result = await aiConfigResolvers.Mutation.updateAIModelConfig(
      {},
      { plan: 'free', primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini' },
      { auth: adminAuth }
    );
    expect(result.primaryModel).toBe('Phi-4');
    expect(updateConfig).toHaveBeenCalledWith('free', 'Phi-4', 'gpt-4o-mini', 'u1');
  });

  it('throws for non-admin user', async () => {
    await expect(
      aiConfigResolvers.Mutation.updateAIModelConfig(
        {},
        { plan: 'free', primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini' },
        { auth: userAuth }
      )
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm test:unit -- aiConfig.test
```

Expected: fails with "Cannot find module '../aiConfig.js'".

- [ ] **Step 4: Implement `aiConfig.ts` resolver**

Create `apps/backend/src/graphql/resolvers/aiConfig.ts`:

```ts
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { type BetterAuthContext } from '../../middleware/better-auth-middleware.js';
import { listConfigs, updateConfig, SUPPORTED_MODELS } from '../../services/aiConfigService.js';

function requireAdminRole(auth: BetterAuthContext) {
  if (!auth?.user) {
    throw createGraphQLError('Authentication required', GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED);
  }
  const role = auth.user.role;
  if (role !== 'admin' && role !== 'superAdmin') {
    throw createGraphQLError('Admin privileges required', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }
  return auth.user;
}

export const aiConfigResolvers = {
  Query: {
    aiModelConfigs: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context.auth);
      return listConfigs();
    },

    aiSupportedModels: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context.auth);
      return SUPPORTED_MODELS;
    },
  },

  Mutation: {
    updateAIModelConfig: async (
      _: any,
      { plan, primaryModel, fastModel }: { plan: string; primaryModel: string; fastModel: string },
      context: { auth: BetterAuthContext }
    ) => {
      const user = requireAdminRole(context.auth);
      return updateConfig(plan, primaryModel, fastModel, user.id);
    },
  },
};
```

- [ ] **Step 5: Register in `resolvers.ts`**

Add import at top of `apps/backend/src/graphql/resolvers.ts`:

```ts
import { aiConfigResolvers } from './resolvers/aiConfig.js';
```

Add to `Query` spread:

```ts
    ...aiConfigResolvers.Query,
```

Add to `Mutation` spread:

```ts
    ...aiConfigResolvers.Mutation,
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
pnpm test:unit -- aiConfig.test
```

Expected: all 7 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/graphql/schema.ts \
        apps/backend/src/graphql/resolvers/aiConfig.ts \
        apps/backend/src/graphql/resolvers.ts \
        apps/backend/src/graphql/resolvers/__tests__/aiConfig.test.ts
git commit -m "feat(backend): add aiConfig GraphQL resolver for admin-only AI model management"
```

---

## Task 9: Fix Existing aiChatService Tests

**Files:**
- Modify: `apps/backend/src/services/__tests__/aiChatService.test.ts`

- [ ] **Step 1: Update mock in `aiChatService.test.ts`**

The existing mock at line ~19 mocks `getPrimaryModel` and `getFastModel`. Replace it:

```ts
vi.mock('../../lib/ai.js', () => ({
  getModelForPlan: vi.fn().mockResolvedValue('mock-model'),
}));
```

- [ ] **Step 2: Update `buildChatStream` calls in the test** 

Any test that calls `buildChatStream(conversationId, userId, currentPageId)` must now pass a 4th arg:

```ts
await buildChatStream('conv_1', 'user_1', undefined, 'free');
```

- [ ] **Step 3: Run the full unit test suite**

```bash
pnpm test:unit
```

Expected: all tests pass. Confirm the output shows green for both `aiChatService` and `aiConfigService`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/services/__tests__/aiChatService.test.ts
git commit -m "fix(tests): update aiChatService mocks for getModelForPlan signature"
```

---

## Task 10: Admin App — AI Model Settings Page

**Files:**
- Create: `apps/admin-app/src/locales/en/aiModelConfig.json`
- Modify: `apps/admin-app/src/locales/index.ts`
- Create: `apps/admin-app/src/graphql/aiModelConfig.ts`
- Create: `apps/admin-app/src/pages/AIModelSettings.tsx`
- Modify: `apps/admin-app/src/App.tsx`
- Modify: `apps/admin-app/src/components/AdminLayout.tsx`

- [ ] **Step 1: Create locale file**

Create `apps/admin-app/src/locales/en/aiModelConfig.json`:

```json
{
  "title": "AI Model Configuration",
  "subtitle": "Assign AI models per subscription plan. Changes take effect on the next request.",
  "columns": {
    "plan": "Plan",
    "primaryModel": "Primary Model",
    "fastModel": "Fast Model"
  },
  "plans": {
    "free": "Free",
    "starter": "Starter",
    "advanced": "Advanced"
  },
  "save": "Save Changes",
  "saving": "Saving...",
  "success": "AI model configuration updated successfully.",
  "error": "Failed to update AI model configuration.",
  "noChanges": "No changes to save."
}
```

- [ ] **Step 2: Register locale in `locales/index.ts`**

```ts
import enCommon from './en/common.json';
import enDashboard from './en/dashboard.json';
import enOrganizations from './en/organizations.json';
import enUsers from './en/users.json';
import enTemplates from './en/templates.json';
import enLayout from './en/layout.json';
import enLogin from './en/login.json';
import enApp from './en/app.json';
import enAiModelConfig from './en/aiModelConfig.json';

export const translations = {
  en: {
    common: enCommon,
    dashboard: enDashboard,
    organizations: enOrganizations,
    users: enUsers,
    templates: enTemplates,
    layout: enLayout,
    login: enLogin,
    app: enApp,
    aiModelConfig: enAiModelConfig,
  },
} as const;
```

- [ ] **Step 3: Create GraphQL file**

Create `apps/admin-app/src/graphql/aiModelConfig.ts`:

```ts
import { gql } from '@apollo/client';

export const AI_MODEL_CONFIGS_QUERY = gql`
  query AIModelConfigs {
    aiModelConfigs {
      id
      plan
      primaryModel
      fastModel
      updatedAt
      updatedBy
    }
    aiSupportedModels {
      id
      label
    }
  }
`;

export const UPDATE_AI_MODEL_CONFIG_MUTATION = gql`
  mutation UpdateAIModelConfig($plan: String!, $primaryModel: String!, $fastModel: String!) {
    updateAIModelConfig(plan: $plan, primaryModel: $primaryModel, fastModel: $fastModel) {
      id
      plan
      primaryModel
      fastModel
      updatedAt
    }
  }
`;
```

- [ ] **Step 4: Create `AIModelSettings.tsx` page**

Create `apps/admin-app/src/pages/AIModelSettings.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toastSuccess, toastError } from '@dculus/ui';
import { Bot } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import {
  AI_MODEL_CONFIGS_QUERY,
  UPDATE_AI_MODEL_CONFIG_MUTATION,
} from '../graphql/aiModelConfig';

interface AIModelOption {
  id: string;
  label: string;
}

interface AIModelConfig {
  id: string;
  plan: string;
  primaryModel: string;
  fastModel: string;
}

export default function AIModelSettings() {
  const { t } = useTranslation('aiModelConfig');

  const { data, loading } = useQuery<{
    aiModelConfigs: AIModelConfig[];
    aiSupportedModels: AIModelOption[];
  }>(AI_MODEL_CONFIGS_QUERY);

  const [updateConfig] = useMutation(UPDATE_AI_MODEL_CONFIG_MUTATION);

  // Local state: plan -> { primaryModel, fastModel }
  const [overrides, setOverrides] = useState<Record<string, { primaryModel: string; fastModel: string }>>({});
  const [saving, setSaving] = useState(false);

  const configs = data?.aiModelConfigs ?? [];
  const models = data?.aiSupportedModels ?? [];

  function getField(plan: string, field: 'primaryModel' | 'fastModel'): string {
    return overrides[plan]?.[field] ?? configs.find(c => c.plan === plan)?.[field] ?? '';
  }

  function setField(plan: string, field: 'primaryModel' | 'fastModel', value: string) {
    setOverrides(prev => ({
      ...prev,
      [plan]: { primaryModel: getField(plan, 'primaryModel'), fastModel: getField(plan, 'fastModel'), [field]: value },
    }));
  }

  const changedPlans = configs.filter(c =>
    overrides[c.plan]?.primaryModel !== undefined || overrides[c.plan]?.fastModel !== undefined
  );

  async function handleSave() {
    if (changedPlans.length === 0) {
      toastError(t('noChanges'), '');
      return;
    }
    setSaving(true);
    try {
      for (const c of changedPlans) {
        await updateConfig({
          variables: {
            plan: c.plan,
            primaryModel: getField(c.plan, 'primaryModel'),
            fastModel: getField(c.plan, 'fastModel'),
          },
        });
      }
      setOverrides({});
      toastSuccess(t('success'), '');
    } catch {
      toastError(t('error'), '');
    } finally {
      setSaving(false);
    }
  }

  const PLAN_ORDER = ['free', 'starter', 'advanced'];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-50 p-3 rounded-xl">
          <Bot className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-xs font-medium text-muted-foreground px-1 pb-1 border-b">
                <span>{t('columns.plan')}</span>
                <span>{t('columns.primaryModel')}</span>
                <span>{t('columns.fastModel')}</span>
              </div>

              {PLAN_ORDER.map(plan => (
                <div key={plan} className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-sm font-medium capitalize">
                    {t(`plans.${plan}` as any)}
                  </span>

                  <Select
                    value={getField(plan, 'primaryModel')}
                    onValueChange={v => setField(plan, 'primaryModel', v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={getField(plan, 'fastModel')}
                    onValueChange={v => setField(plan, 'fastModel', v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Add nav item to `AdminLayout.tsx`**

In `apps/admin-app/src/components/AdminLayout.tsx`, add import:

```ts
import { Bot } from 'lucide-react';
```

(It's already imported via `lucide-react` along with other icons — just add `Bot` to the existing destructured import.)

Add to the `navigation` array after `templates`:

```ts
    { name: t('navigation.aiModels'), href: '/settings/ai-models', icon: Bot },
```

Add the translation key to `apps/admin-app/src/locales/en/layout.json`:

```json
{
  "sidebar": { "title": "Admin Dashboard", "subtitle": "Dculus Forms" },
  "navigation": {
    "dashboard": "Dashboard",
    "organizations": "Organizations",
    "users": "Users",
    "templates": "Templates",
    "aiModels": "AI Models",
    "settings": "Settings"
  },
  "userMenu": { "signOut": "Sign Out", "superAdmin": "Super Admin" }
}
```

- [ ] **Step 6: Add route in `App.tsx`**

Add import:

```ts
import AIModelSettings from './pages/AIModelSettings';
```

Add route inside `<Routes>` before the catch-all:

```tsx
        <Route path="/settings/ai-models" element={<AIModelSettings />} />
```

- [ ] **Step 7: Run type check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-app/src/locales/en/aiModelConfig.json \
        apps/admin-app/src/locales/index.ts \
        apps/admin-app/src/graphql/aiModelConfig.ts \
        apps/admin-app/src/pages/AIModelSettings.tsx \
        apps/admin-app/src/App.tsx \
        apps/admin-app/src/components/AdminLayout.tsx
git commit -m "feat(admin-app): add AI Model Settings page for per-plan model configuration"
```

---

## Final Validation

- [ ] **Run full unit test suite**

```bash
pnpm test:unit
```

Expected: all tests pass.

- [ ] **Run type check across all packages**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Run lint**

```bash
pnpm lint
```

Expected: no errors.
