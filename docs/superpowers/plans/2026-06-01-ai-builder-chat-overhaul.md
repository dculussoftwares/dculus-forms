# AI Builder Chat — Stability & Feature Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stability gaps in the AI form-editing chat and add 10 UX and capability improvements across three sequential phases.

**Architecture:** The system is a Vercel AI SDK `ToolLoopAgent` on Express streaming to a `useChat` hook via `DefaultChatTransport`. Mutations flow from the agent's tool outputs through `applyAIOp` into the Y.js collaborative store. All new state (highlighted field, pending validation suggestions) lives in a new `aiSlice` added to the Zustand store.

**Tech Stack:** Vercel AI SDK v5 (`ai`, `@ai-sdk/react`, `@ai-sdk/azure`), Express, Zustand, Y.js, Apollo Client, React, Tailwind CSS, Vitest, zod.

---

## File Map

**New files:**
- `apps/form-app/src/store/slices/aiSlice.ts` — `aiHighlightedFieldId` + `pendingValidationSuggestions`
- `apps/form-app/src/hooks/useAIChips.ts` — context-aware chip derivation
- `apps/form-app/src/components/form-builder/AITokenMeter.tsx` — quota progress bar
- `apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx` — per-turn diff
- `apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx` — accept/dismiss validation UI

**Modified files:**
- `apps/backend/src/routes/aiChat.ts` — schema cache, budget cache, `pruneMessages` Layer 1, `for-await` stream bridge, invalidation endpoint
- `apps/backend/src/lib/formEditAgent.ts` — `stepCountIs(15)`, `prepareStep`
- `apps/backend/src/lib/aiFormEditTools.ts` — `navigateToPage`, `proposeValidation`, `bulkUpdateFields`, shared `updatesSchema`
- `apps/backend/src/services/aiChatService.ts` — `autoGenerateTitle` inner try/catch
- `apps/backend/src/services/aiUsageService.ts` — budget cache with invalidation
- `apps/form-app/src/store/types/store.types.ts` — add `AISlice` interface + `FormBuilderState`
- `apps/form-app/src/store/useFormBuilderStore.ts` — mount `createAISlice`
- `apps/form-app/src/store/slices/selectionSlice.ts` — no change (setSelectedPage already exists)
- `apps/form-app/src/hooks/useYjsUndoManager.ts` — export `getUndoStackDepth`
- `apps/form-app/src/hooks/useAIChat.ts` — undo depth tracking, schema invalidation call
- `apps/form-app/src/lib/applyAIOp.ts` — `NAVIGATE_TO_PAGE`, `BULK_UPDATE_FIELDS`, `PROPOSE_VALIDATION`, highlight, schema invalidation
- `apps/form-app/src/lib/aiAgentTypes.ts` — new tool part types, `MUTATION_TOOL_NAMES` additions
- `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` — live status, change summary, undo badge, token meter, dynamic chips
- `apps/form-app/src/components/form-builder/tabs/PageBuilderFieldCard.tsx` — AI highlight ring + scroll
- `apps/form-app/src/graphql/aiChat.ts` — `AI_TOKEN_USAGE` query
- `apps/form-app/src/locales/en/aiEditDrawer.json` — new keys for all new UI strings
- `apps/form-app/src/locales/ta/aiEditDrawer.json` — Tamil translations for all new keys

---

## PHASE 1 — Stability

---

### Task 1: Schema cache + invalidation endpoint

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts`
- Test: `apps/backend/src/routes/__tests__/aiChat.test.ts`

- [ ] **Step 1: Write the failing test for schema cache**

Add to `apps/backend/src/routes/__tests__/aiChat.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('schema cache', () => {
  it('returns cached schema on second call within TTL', async () => {
    const { getFormSchema } = await import('../aiChat.js');
    // first call
    const s1 = await getFormSchema('form-1');
    // second call — prisma.form.findUnique should NOT be called again
    const s2 = await getFormSchema('form-1');
    expect(s1).toBe(s2); // same reference = cache hit
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -A5 'schema cache'
```

Expected: `getFormSchema is not a function` (not yet exported).

- [ ] **Step 3: Implement schema cache in `aiChat.ts`**

At the top of `apps/backend/src/routes/aiChat.ts`, after the existing imports, add:

```ts
// ── Schema cache ──────────────────────────────────────────────────────────────
const schemaCache = new Map<string, { schema: { pages: any[] }; cachedAt: number }>();
const SCHEMA_CACHE_TTL_MS = 10_000;

export async function getFormSchema(formId: string): Promise<{ pages: any[] }> {
  const hit = schemaCache.get(formId);
  if (hit && Date.now() - hit.cachedAt < SCHEMA_CACHE_TTL_MS) return hit.schema;
  const schema = (await getFormSchemaFromYjs(formId)) ?? { pages: [] };
  schemaCache.set(formId, { schema, cachedAt: Date.now() });
  return schema;
}
```

Replace the `getFormSchemaFromYjs(conv.formId)` call inside the `POST /chat` handler (line ~162) with:

```ts
const schema = await getFormSchema(conv.formId);
```

Add the invalidation endpoint after the `aiChatRouter.post('/chat', ...)` block:

```ts
aiChatRouter.post('/invalidate-schema', async (req, res) => {
  const auth = await createBetterAuthContext(req);
  try { requireAuth(auth); } catch { res.status(401).end(); return; }
  const { formId } = req.body as { formId?: string };
  if (formId) schemaCache.delete(formId);
  res.status(204).end();
});
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -A5 'schema cache'
```

Expected: `✓ returns cached schema on second call within TTL`

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts apps/backend/src/routes/__tests__/aiChat.test.ts
git commit -m "feat(ai): add schema cache (10 s TTL) and invalidation endpoint"
```

---

### Task 2: `pruneMessages` (both layers) + `stepCountIs(15)` + `prepareStep`

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts`
- Modify: `apps/backend/src/lib/formEditAgent.ts`
- Test: `apps/backend/src/routes/__tests__/aiChat.test.ts`

- [ ] **Step 1: Add `pruneMessages` import to the mock and add test**

In `apps/backend/src/routes/__tests__/aiChat.test.ts`, update the `vi.mock('ai', ...)` block:

```ts
vi.mock('ai', () => ({
  validateUIMessages: vi.fn().mockImplementation(({ messages }) => Promise.resolve(messages)),
  convertToModelMessages: vi.fn().mockResolvedValue([{ role: 'user', content: 'hi' }]),
  pruneMessages: vi.fn().mockImplementation(({ messages }) => messages), // pass-through
}));
```

Add a test:

```ts
import { pruneMessages } from 'ai';

describe('context pruning', () => {
  it('calls pruneMessages on converted model messages', async () => {
    // arrange: POST /chat with a valid body (reuse existing test setup)
    // ... (trigger the handler via supertest)
    expect(pruneMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning: 'all',
        toolCalls: 'before-last-3-messages',
        emptyMessages: 'remove',
      })
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -A5 'context pruning'
```

Expected: `pruneMessages` not called yet.

- [ ] **Step 3: Add Layer 1 pruning to `aiChat.ts`**

Add import at the top of `apps/backend/src/routes/aiChat.ts`:

```ts
import {
  validateUIMessages, convertToModelMessages, pruneMessages,
} from 'ai';
```

In the `POST /chat` handler, replace:

```ts
const modelMessages = await convertToModelMessages(validated);
const result = await agent.stream({ messages: modelMessages });
```

With:

```ts
const modelMessages = await convertToModelMessages(validated);
const prunedModelMessages = pruneMessages({
  messages: modelMessages,
  reasoning: 'all',
  toolCalls: 'before-last-3-messages',
  emptyMessages: 'remove',
});
const result = await agent.stream({ messages: prunedModelMessages });
```

- [ ] **Step 4: Update `formEditAgent.ts` — stepCountIs(15) + prepareStep**

Replace the full content of `apps/backend/src/lib/formEditAgent.ts` with:

```ts
import { ToolLoopAgent, InferAgentUIMessage, stepCountIs, pruneMessages, type ModelMessage } from 'ai';
import { getPrimaryModel } from './ai.js';
import { createFormEditTools } from './aiFormEditTools.js';

const COMPACTION_THRESHOLD_TOKENS = 50_000;
const estimateTokens = (msgs: ModelMessage[]) => JSON.stringify(msgs).length / 4;

export function createFormEditAgent(schema: { pages: any[] }, instructions?: string) {
  const tools = createFormEditTools(schema);
  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(15),
    tools,
    prepareStep: ({ messages }) => {
      if (estimateTokens(messages) > COMPACTION_THRESHOLD_TOKENS) {
        return {
          messages: pruneMessages({
            messages,
            reasoning: 'all',
            toolCalls: 'before-last-3-messages',
            emptyMessages: 'remove',
          }),
        };
      }
      return undefined;
    },
    ...(instructions ? { instructions } : {}),
  });
}

export type FormEditAgentUIMessage = InferAgentUIMessage<ReturnType<typeof createFormEditAgent>>;
```

- [ ] **Step 5: Run tests**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -E '(pruning|PASS|FAIL)'
```

Expected: all pruning tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts apps/backend/src/lib/formEditAgent.ts apps/backend/src/routes/__tests__/aiChat.test.ts
git commit -m "feat(ai): add pruneMessages context compaction (both layers) and raise step cap to 15"
```

---

### Task 3: Stream bridge, budget cache, and `autoGenerateTitle` fix

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts`
- Modify: `apps/backend/src/services/aiUsageService.ts`
- Modify: `apps/backend/src/services/aiChatService.ts`
- Test: `apps/backend/src/services/__tests__/aiChatService.test.ts`

- [ ] **Step 1: Write a test for `autoGenerateTitle` surviving a deleted conversation**

In `apps/backend/src/services/__tests__/aiChatService.test.ts`, add:

```ts
import { vi } from 'vitest';

describe('autoGenerateTitle', () => {
  it('does not throw when the conversation is deleted before title saves', async () => {
    vi.mocked(prisma.aIChatConversation.update).mockRejectedValueOnce(
      new Error('Record not found')
    );
    // Should resolve without throwing
    await expect(
      new Promise<void>((resolve) => {
        autoGenerateTitle('conv-deleted', 'Hello world');
        setTimeout(resolve, 50); // fire-and-forget resolves async
      })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -A5 'autoGenerateTitle'
```

Expected: unhandled rejection causes test to fail.

- [ ] **Step 3: Fix `autoGenerateTitle` in `aiChatService.ts`**

In `apps/backend/src/services/aiChatService.ts`, replace the `.then` body:

```ts
export function autoGenerateTitle(conversationId: string, firstMessage: string): void {
  generateText({
    model: getFastModel(),
    prompt: `Generate a short title (max 7 words, no quotes) for a form editing conversation that starts with: "${firstMessage.slice(0, 200)}"`,
  })
    .then(async ({ text }) => {
      try {
        const title = text.trim().slice(0, 60);
        await prisma.aIChatConversation.update({ where: { id: conversationId }, data: { title } });
      } catch (err) {
        logger.warn({ err, conversationId }, 'Failed to save auto-generated title');
      }
    })
    .catch((err) => logger.warn({ err, conversationId }, 'Failed to auto-generate conversation title'));
}
```

- [ ] **Step 4: Add token budget cache to `aiUsageService.ts`**

Add to the top of `apps/backend/src/services/aiUsageService.ts`, after the imports:

```ts
const budgetCache = new Map<string, { result: { allowed: boolean; used: number; limit: number }; cachedAt: number }>();
const BUDGET_CACHE_TTL_MS = 30_000;
```

Wrap `checkAITokenBudget` body with cache logic:

```ts
export async function checkAITokenBudget(organizationId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const hit = budgetCache.get(organizationId);
  if (hit && Date.now() - hit.cachedAt < BUDGET_CACHE_TTL_MS) return hit.result;

  const { start } = currentPeriod();
  const [usage, subscription] = await Promise.all([
    prisma.aIUsage.findFirst({ where: { organizationId, periodStart: start } }),
    prisma.subscription.findUnique({ where: { organizationId } }),
  ]);
  const planId = subscription?.planId ?? 'free';
  const limit = AI_TOKEN_LIMITS[planId] ?? AI_TOKEN_LIMITS.free;
  const used = usage?.tokensUsed ?? 0;
  const result = { allowed: used < limit, used, limit };

  budgetCache.set(organizationId, { result, cachedAt: Date.now() });
  return result;
}
```

At the top of `recordAITokenUsage`, add cache invalidation:

```ts
export async function recordAITokenUsage(organizationId: string, tokensUsed: number): Promise<void> {
  budgetCache.delete(organizationId); // invalidate so next check is fresh
  // ... rest unchanged
```

- [ ] **Step 5: Replace stream bridge in `aiChat.ts`**

Replace these lines in the `POST /chat` handler:

```ts
// Remove this:
Readable.fromWeb(webResponse.body as any).pipe(res);
```

With:

```ts
try {
  for await (const chunk of webResponse.body as any) {
    res.write(chunk);
  }
} finally {
  res.end();
}
```

Also remove the `import { Readable } from 'stream';` line at the top if it is now unused.

- [ ] **Step 6: Run all backend unit tests**

```bash
pnpm test:unit --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts apps/backend/src/services/aiUsageService.ts apps/backend/src/services/aiChatService.ts apps/backend/src/services/__tests__/aiChatService.test.ts
git commit -m "fix(ai): stream bridge for-await, budget cache 30 s, autoGenerateTitle error guard"
```

---

### Task 4: Frontend schema invalidation after mutations

**Files:**
- Modify: `apps/form-app/src/lib/applyAIOp.ts`

- [ ] **Step 1: Add invalidation call at the end of `applyAIOp`**

At the top of `apps/form-app/src/lib/applyAIOp.ts`, add:

```ts
const API_URL = import.meta.env.VITE_API_URL as string;

function invalidateSchema(formId: string): void {
  fetch(`${API_URL}/api/ai/invalidate-schema`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ formId }),
  }).catch(() => { /* fire-and-forget, ignore failures */ });
}
```

Update the `applyAIOp` signature to accept `formId`:

```ts
export function applyAIOp(
  op: any,
  store: Pick<
    FormBuilderState,
    | 'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField'
    | 'reorderFields' | 'updateLayout' | 'updatePageTitle' | 'reorderPages'
    | 'addPageAtPosition' | 'removePage'
  >,
  formId?: string
): void {
```

At the end of the `switch` statement, before the closing `}` of the function, add:

```ts
  // Invalidate backend schema cache after any mutation
  if (formId) invalidateSchema(formId);
```

- [ ] **Step 2: Update the `useAIChat.ts` caller to pass `formId`**

In `apps/form-app/src/hooks/useAIChat.ts`, in the `useEffect` that calls `applyAIOp`, update the call:

```ts
applyAIOp((part as any).output, store, formId);
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check 2>&1 | grep -E '(applyAIOp|error)' | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/lib/applyAIOp.ts apps/form-app/src/hooks/useAIChat.ts
git commit -m "feat(ai-frontend): fire-and-forget schema cache invalidation after each mutation"
```

---

## PHASE 2 — UX & Feedback

---

### Task 5: New `AISlice` Zustand slice

**Files:**
- Create: `apps/form-app/src/store/slices/aiSlice.ts`
- Modify: `apps/form-app/src/store/types/store.types.ts`
- Modify: `apps/form-app/src/store/useFormBuilderStore.ts`

- [ ] **Step 1: Define `AISlice` interface in `store.types.ts`**

Add after the `SelectionSlice` interface in `apps/form-app/src/store/types/store.types.ts`:

```ts
export interface ValidationSuggestion {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  validation?: {
    minLength?: number | null;
    maxLength?: number | null;
    minSelections?: number | null;
    maxSelections?: number | null;
  };
  min?: number | null;
  max?: number | null;
  required?: boolean;
}

export interface AISlice {
  aiHighlightedFieldId: string | null;
  setAIHighlightedFieldId: (id: string | null) => void;
  pendingValidationSuggestions: ValidationSuggestion[];
  setPendingValidationSuggestions: (suggestions: ValidationSuggestion[]) => void;
  acceptValidationSuggestion: (fieldId: string) => ValidationSuggestion | null;
  dismissValidationSuggestion: (fieldId: string) => void;
}
```

Update `FormBuilderState`:

```ts
export type FormBuilderState = CollaborationSlice &
  PagesSlice &
  FieldsSlice &
  LayoutSlice &
  SelectionSlice &
  AISlice &
  ResetSlice;
```

- [ ] **Step 2: Create `aiSlice.ts`**

Create `apps/form-app/src/store/slices/aiSlice.ts`:

```ts
import type { AISlice, SliceCreator, ValidationSuggestion } from '../types/store.types';

export const createAISlice: SliceCreator<AISlice> = (set, get) => ({
  aiHighlightedFieldId: null,
  setAIHighlightedFieldId: (id) => set({ aiHighlightedFieldId: id }),

  pendingValidationSuggestions: [],
  setPendingValidationSuggestions: (suggestions) =>
    set({ pendingValidationSuggestions: suggestions }),

  acceptValidationSuggestion: (fieldId) => {
    const { pendingValidationSuggestions } = get();
    const suggestion = pendingValidationSuggestions.find((s) => s.fieldId === fieldId) ?? null;
    set({
      pendingValidationSuggestions: pendingValidationSuggestions.filter((s) => s.fieldId !== fieldId),
    });
    return suggestion;
  },

  dismissValidationSuggestion: (fieldId) => {
    const { pendingValidationSuggestions } = get();
    set({
      pendingValidationSuggestions: pendingValidationSuggestions.filter((s) => s.fieldId !== fieldId),
    });
  },
});
```

- [ ] **Step 3: Mount `createAISlice` in `useFormBuilderStore.ts`**

Add the import at the top:

```ts
import { createAISlice } from './slices/aiSlice';
```

Add it to the store composition (after `createSelectionSlice`):

```ts
...createAISlice(set, get),
```

- [ ] **Step 4: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/store/slices/aiSlice.ts apps/form-app/src/store/types/store.types.ts apps/form-app/src/store/useFormBuilderStore.ts
git commit -m "feat(ai-frontend): add AISlice to store (aiHighlightedFieldId, pendingValidationSuggestions)"
```

---

### Task 6: Live tool-call status labels

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`
- Modify: `apps/form-app/src/locales/en/aiEditDrawer.json`
- Modify: `apps/form-app/src/locales/ta/aiEditDrawer.json`

- [ ] **Step 1: Add i18n keys for tool status labels**

In `apps/form-app/src/locales/en/aiEditDrawer.json`, add inside the root object:

```json
"toolStatus": {
  "listFields": "Reading form structure…",
  "getField": "Reading field details…",
  "addField": "Adding field…",
  "updateField": "Updating field…",
  "removeField": "Removing field…",
  "reorderFields": "Reordering fields…",
  "updateLayout": "Updating layout…",
  "addPage": "Adding page…",
  "removePage": "Removing page…",
  "renamePage": "Renaming page…",
  "reorderPages": "Reordering pages…",
  "navigateToPage": "Navigating to page…",
  "bulkUpdateFields": "Updating fields…",
  "proposeValidation": "Analysing validation rules…",
  "default": "Working…"
},
"changeSummary": {
  "title": "Changes made",
  "added": "Added",
  "updated": "Updated",
  "removed": "Removed",
  "bulkUpdated": "Updated {{count}} fields",
  "undoThis": "Undo this"
},
"tokenMeter": {
  "label": "AI usage this month",
  "used": "{{percent}}% used",
  "resets": "Resets {{date}}",
  "limitReached": "Token limit reached.",
  "upgrade": "Upgrade plan"
},
"chips": {
  "analyseForm": "Analyse form",
  "listAllFields": "List all fields",
  "makeAllRequired": "Make all required",
  "generateFields": "Generate fields",
  "reorganisePages": "Reorganise pages",
  "suggestValidation": "Suggest validation",
  "remixForm": "Remix this form"
},
"validation": {
  "title": "Suggested validation rules",
  "rationale": "Rationale",
  "accept": "Accept",
  "skip": "Skip",
  "acceptAll": "Accept all"
}
```

- [ ] **Step 2: Add Tamil translations in `ta/aiEditDrawer.json`**

Add the same keys in `apps/form-app/src/locales/ta/aiEditDrawer.json`:

```json
"toolStatus": {
  "listFields": "படிவ கட்டமைப்பை படிக்கிறது…",
  "getField": "புல விவரங்களை படிக்கிறது…",
  "addField": "புலம் சேர்க்கிறது…",
  "updateField": "புலத்தை புதுப்பிக்கிறது…",
  "removeField": "புலத்தை நீக்குகிறது…",
  "reorderFields": "புலங்களை மறுவரிசைப்படுத்துகிறது…",
  "updateLayout": "தளவமைப்பை புதுப்பிக்கிறது…",
  "addPage": "பக்கம் சேர்க்கிறது…",
  "removePage": "பக்கத்தை நீக்குகிறது…",
  "renamePage": "பக்கத்தை மறுபெயரிடுகிறது…",
  "reorderPages": "பக்கங்களை மறுவரிசைப்படுத்துகிறது…",
  "navigateToPage": "பக்கத்திற்கு செல்கிறது…",
  "bulkUpdateFields": "புலங்களை புதுப்பிக்கிறது…",
  "proposeValidation": "சரிபார்ப்பு விதிகளை பகுப்பாய்கிறது…",
  "default": "செயல்படுகிறது…"
},
"changeSummary": {
  "title": "செய்யப்பட்ட மாற்றங்கள்",
  "added": "சேர்க்கப்பட்டது",
  "updated": "புதுப்பிக்கப்பட்டது",
  "removed": "நீக்கப்பட்டது",
  "bulkUpdated": "{{count}} புலங்கள் புதுப்பிக்கப்பட்டன",
  "undoThis": "இதை செயல் தவிர்"
},
"tokenMeter": {
  "label": "இந்த மாதம் AI பயன்பாடு",
  "used": "{{percent}}% பயன்படுத்தப்பட்டது",
  "resets": "{{date}} அன்று மீட்டமைக்கப்படும்",
  "limitReached": "டோக்கன் வரம்பு அடைந்தது.",
  "upgrade": "திட்டத்தை மேம்படுத்து"
},
"chips": {
  "analyseForm": "படிவத்தை பகுப்பாய்",
  "listAllFields": "அனைத்து புலங்களையும் பட்டியலிடு",
  "makeAllRequired": "அனைத்தையும் கட்டாயமாக்கு",
  "generateFields": "புலங்களை உருவாக்கு",
  "reorganisePages": "பக்கங்களை மறுவழிமைப்படுத்து",
  "suggestValidation": "சரிபார்ப்பை பரிந்துரை",
  "remixForm": "படிவத்தை மாற்றியமை"
},
"validation": {
  "title": "பரிந்துரைக்கப்பட்ட சரிபார்ப்பு விதிகள்",
  "rationale": "காரணம்",
  "accept": "ஏற்கு",
  "skip": "தவிர்",
  "acceptAll": "அனைத்தையும் ஏற்கு"
}
```

- [ ] **Step 3: Add `toolStatusLabel()` and update `AssistantMessage` in `AIEditDrawer.tsx`**

Add this function inside `AIEditDrawer.tsx`, before the `AssistantMessage` component:

```ts
function toolStatusLabel(part: FormEditToolPart, t: (key: string) => string): string {
  const toolName = part.type.replace('tool-', '');
  const key = `toolStatus.${toolName}`;
  const label = t(key);
  // If translation exists (not the same as the key), use it; else fallback
  return label !== key ? label : t('toolStatus.default');
}
```

In `AssistantMessage`, replace the current `showStatusIndicator` logic:

```tsx
function AssistantMessage({ message, isStreaming }: { message: FormEditAgentUIMessage; isStreaming: boolean }) {
  const { t } = useTranslation('aiEditDrawer');
  const textParts = message.parts.filter((p) => p.type === 'text') as { type: 'text'; text: string }[];
  const combinedText = textParts.map((p) => p.text).join('');

  // Find any tool part currently in-flight (not yet output-available)
  const inFlightPart = isStreaming
    ? (message.parts as FormEditToolPart[]).find(
        (p) => p.type.startsWith('tool-') && (p as any).state !== 'output-available'
      )
    : undefined;

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <div className="space-y-1.5">
          {combinedText && <TextBubble text={combinedText} isStreaming={isStreaming && !inFlightPart} />}
          {inFlightPart && (
            <StatusIndicator text={toolStatusLabel(inFlightPart, t)} />
          )}
          {!inFlightPart && !combinedText && isStreaming && <StatusIndicator />}
          <div className="flex flex-wrap gap-1.5">
            {message.parts.map((part, i) => {
              if (part.type === 'tool-listFields') return <ListFieldsToolPart key={i} part={part as any} />;
              if (part.type === 'tool-getField') return <GetFieldToolPart key={i} part={part as any} />;
              if (MUTATION_TOOL_NAMES.has(part.type.slice(5))) return <MutationToolPart key={i} part={part as any} />;
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Add `import { MUTATION_TOOL_NAMES } from '../../lib/aiAgentTypes';` to the imports in `AIEditDrawer.tsx`.

- [ ] **Step 4: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx apps/form-app/src/locales/en/aiEditDrawer.json apps/form-app/src/locales/ta/aiEditDrawer.json
git commit -m "feat(ai-frontend): live tool-call status labels during streaming"
```

---

### Task 7: `ChangeSummaryCard` component

**Files:**
- Create: `apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx`
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Create `ChangeSummaryCard.tsx`**

```tsx
// apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx
import React from 'react';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import type { FormEditAgentUIMessage } from '../../../lib/aiAgentTypes';
import { buildOpLabel } from '../../../hooks/useAIChat';

type OpColor = 'green' | 'blue' | 'red';

const ADD_OPS = new Set(['ADD_FIELD', 'ADD_PAGE']);
const REMOVE_OPS = new Set(['REMOVE_FIELD', 'REMOVE_PAGE']);

function opColor(opType: string): OpColor {
  if (ADD_OPS.has(opType)) return 'green';
  if (REMOVE_OPS.has(opType)) return 'red';
  return 'blue';
}

const COLOR_CLASSES: Record<OpColor, string> = {
  green: 'text-green-600',
  blue: 'text-blue-600',
  red: 'text-red-600',
};

const PREFIX: Record<OpColor, string> = {
  green: '+',
  blue: '~',
  red: '−',
};

interface Props {
  message: FormEditAgentUIMessage;
  onUndo?: () => void;
  canUndo?: boolean;
}

const ChangeSummaryCard: React.FC<Props> = ({ message, onUndo, canUndo }) => {
  const { t } = useTranslation('aiEditDrawer');

  const mutationParts = message.parts.filter(
    (p) =>
      p.type.startsWith('tool-') &&
      (p as any).state === 'output-available' &&
      (p as any).output?.type &&
      !['listFields', 'getField', 'proposeValidation'].includes((p as any).output.type
        ?.toLowerCase()
        .replace('_', ''))
  );

  if (mutationParts.length === 0) return null;

  return (
    <div className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-muted-foreground">{t('changeSummary.title')}</span>
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {t('changeSummary.undoThis')}
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {mutationParts.map((part, i) => {
          const output = (part as any).output;
          const color = opColor(output?.type ?? '');
          return (
            <div key={i} className={cn('font-mono', COLOR_CLASSES[color])}>
              {PREFIX[color]} {buildOpLabel(output)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChangeSummaryCard;
```

- [ ] **Step 2: Import and render `ChangeSummaryCard` in `AIEditDrawer.tsx`**

Add the import:

```ts
import ChangeSummaryCard from './tool-parts/ChangeSummaryCard';
```

Update the `AssistantMessage` props interface to accept undo props (these are wired up fully in Task 8):

```ts
function AssistantMessage({
  message,
  isStreaming,
  onUndo,
  canUndo,
}: {
  message: FormEditAgentUIMessage;
  isStreaming: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
}) {
```

Add `<ChangeSummaryCard>` after the tool-parts `<div>` (inside the `AssistantMessage` return):

```tsx
{!isStreaming && (
  <ChangeSummaryCard
    message={message}
    onUndo={onUndo}
    canUndo={canUndo}
  />
)}
```

In the messages list render in `AIEditDrawer`, pass placeholder `onUndo` and `canUndo` for now (Task 8 wires these up with real values):

```tsx
<AssistantMessage
  key={msg.id}
  message={msg}
  isStreaming={isStreaming && msg === lastMsg}
  onUndo={undefined}
  canUndo={false}
/>
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-frontend): add ChangeSummaryCard showing coloured mutation diff per turn"
```

---

### Task 8: Per-message undo badge

**Files:**
- Modify: `apps/form-app/src/hooks/useYjsUndoManager.ts`
- Modify: `apps/form-app/src/hooks/useAIChat.ts`

- [ ] **Step 1: Export `getUndoStackDepth` from `useYjsUndoManager.ts`**

In `apps/form-app/src/hooks/useYjsUndoManager.ts`, add `getUndoStackDepth` to the returned object:

```ts
const getUndoStackDepth = useCallback(
  () => undoManagerRef.current?.undoStack.length ?? 0,
  []
);

return { canUndo, beginBatch, clearBatch, undo, getUndoStackDepth };
```

- [ ] **Step 2: Track undo depth per message in `useAIChat.ts`**

Add refs at the top of `useAIChat`:

```ts
const undoDepthBeforeRef = useRef<number>(0);
const messageUndoDepths = useRef(new Map<string, number>());
const { canUndo, beginBatch, clearBatch, undo, getUndoStackDepth } = useYjsUndoManager();
```

In `handleSendMessage`, capture depth before sending:

```ts
const handleSendMessage = useCallback(
  async (content: string) => {
    if (!activeConversationId || status !== 'ready') return;
    undoDepthBeforeRef.current = getUndoStackDepth();
    clearBatch();
    beginBatch();
    sendMessage({ text: content });
  },
  [activeConversationId, status, clearBatch, beginBatch, sendMessage, getUndoStackDepth]
);
```

In the mutations `useEffect`, after the last mutation is applied, record depth delta:

```ts
useEffect(() => {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return;

  let mutationApplied = false;
  for (const part of last.parts ?? []) {
    if (
      part.type.startsWith('tool-') &&
      MUTATION_TOOL_NAMES.has(part.type.slice(5)) &&
      (part as any).state === 'output-available' &&
      !appliedToolCallIds.current.has((part as any).toolCallId)
    ) {
      appliedToolCallIds.current.add((part as any).toolCallId);
      applyAIOp((part as any).output, store, formId);
      mutationApplied = true;
    }
  }

  if (mutationApplied) {
    const depth = getUndoStackDepth() - undoDepthBeforeRef.current;
    if (depth > 0) messageUndoDepths.current.set(last.id, depth);
  }
}, [messages]);
```

Expose from the hook:

```ts
const lastMutatingMessageId = [...messageUndoDepths.current.keys()].at(-1) ?? null;

return {
  // ... existing returns
  lastMutatingMessageId,
  undoMessage: (messageId: string) => {
    const depth = messageUndoDepths.current.get(messageId) ?? 0;
    for (let i = 0; i < depth; i++) undo();
    messageUndoDepths.current.delete(messageId);
  },
};
```

- [ ] **Step 3: Pass undo props to `ChangeSummaryCard` in `AIEditDrawer.tsx`**

Destructure new values from `useAIChat`:

```ts
const { ..., lastMutatingMessageId, undoMessage } = useAIChat({ formId, organizationId });
```

In the messages list render, pass to each `AssistantMessage`:

```tsx
<AssistantMessage
  key={msg.id}
  message={msg}
  isStreaming={isStreaming && msg === lastMsg}
  onUndo={() => undoMessage(msg.id)}
  canUndo={msg.id === lastMutatingMessageId && !isStreaming}
/>
```

- [ ] **Step 4: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/hooks/useYjsUndoManager.ts apps/form-app/src/hooks/useAIChat.ts apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-frontend): per-message undo badge scoped to most recent mutation turn"
```

---

### Task 9: `useAIChips` hook — context-aware quick chips

**Files:**
- Create: `apps/form-app/src/hooks/useAIChips.ts`
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Create `useAIChips.ts`**

```ts
// apps/form-app/src/hooks/useAIChips.ts
import { useMemo } from 'react';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import { useTranslation } from './useTranslation';

export interface AIChip {
  key: string;
  label: string;
  prompt: string;
}

export function useAIChips(): AIChip[] {
  const pages = useFormBuilderStore((s) => s.pages);
  const { t } = useTranslation('aiEditDrawer');

  return useMemo(() => {
    const allFields = pages.flatMap((p) => p.fields ?? []);
    const totalFields = allFields.length;
    const totalPages = pages.length;
    const hasOptional = allFields.some((f) => !(f as any).validation?.required && !(f as any).required);
    const hasNoValidation = allFields.some(
      (f) => !(f as any).validation?.minLength && !(f as any).validation?.maxLength && !(f as any).min == null && !(f as any).max == null
    );

    const candidates: AIChip[] = [];

    if (totalFields === 0) {
      candidates.push({
        key: 'generateFields',
        label: t('chips.generateFields'),
        prompt: 'Generate appropriate fields for this form based on its title and purpose.',
      });
    }

    if (totalFields > 0) {
      candidates.push({
        key: 'analyseForm',
        label: t('chips.analyseForm'),
        prompt: `Please analyse this form. Use listFields to read all pages and fields first, then give structured feedback on: (1) field order and logical flow, (2) missing fields for this type of form, (3) unclear or confusing labels, (4) fields that should be required but aren't. Be concise and actionable.`,
      });
    }

    if (hasOptional && totalFields > 0) {
      candidates.push({
        key: 'makeAllRequired',
        label: t('chips.makeAllRequired'),
        prompt: 'Make every field on every page required.',
      });
    }

    if (totalPages > 1) {
      candidates.push({
        key: 'reorganisePages',
        label: t('chips.reorganisePages'),
        prompt: 'Review the page structure of this form and suggest a better organisation. Reorder pages if needed and rename them to be clearer.',
      });
    }

    if (hasNoValidation && totalFields > 2) {
      candidates.push({
        key: 'suggestValidation',
        label: t('chips.suggestValidation'),
        prompt: 'Use listFields to read all fields, then use proposeValidation to suggest appropriate validation rules for each field based on its label and type.',
      });
    }

    if (totalFields > 2) {
      candidates.push({
        key: 'remixForm',
        label: t('chips.remixForm'),
        prompt: 'I want to transform this form for a different purpose. Please remix it into: ',
      });
    }

    return candidates.slice(0, 3);
  }, [pages, t]);
}
```

- [ ] **Step 2: Replace hardcoded chips in `AIEditDrawer.tsx`**

Remove the `QUICK_CHIP_PROMPTS` constant and the `QuickChips` component's hardcoded `chips` array.

Add import:

```ts
import { useAIChips } from '../../hooks/useAIChips';
```

Inside `AIEditDrawer`, add:

```ts
const chips = useAIChips();
```

Replace `<QuickChips>` render with:

```tsx
{!isStreaming && activeConversationId && chips.length > 0 && (
  <div className="mb-2 flex flex-wrap gap-1.5">
    {chips.map((chip) => (
      <button
        key={chip.key}
        onClick={() => sendMessage(chip.prompt)}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground',
          'transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground'
        )}
      >
        {['analyseForm', 'generateFields', 'suggestValidation', 'remixForm'].includes(chip.key) && (
          <Sparkles className="h-3 w-3" />
        )}
        {chip.label}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/hooks/useAIChips.ts apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-frontend): replace hardcoded chips with context-aware useAIChips hook"
```

---

### Task 10: Field highlight on add/edit

**Files:**
- Modify: `apps/form-app/src/lib/applyAIOp.ts`
- Modify: `apps/form-app/src/components/form-builder/tabs/PageBuilderFieldCard.tsx`

- [ ] **Step 1: Emit `aiHighlightedFieldId` from `applyAIOp`**

Update the `applyAIOp` signature to include `setAIHighlightedFieldId`:

```ts
export function applyAIOp(
  op: any,
  store: Pick<
    FormBuilderState,
    | 'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField'
    | 'reorderFields' | 'updateLayout' | 'updatePageTitle' | 'reorderPages'
    | 'addPageAtPosition' | 'removePage' | 'setSelectedPage'
    | 'setAIHighlightedFieldId' | 'setPendingValidationSuggestions'
  >,
  formId?: string
): void {
```

In the `ADD_FIELD` case, after calling `store.addField(...)` or `store.addFieldAtIndex(...)`:

```ts
// highlight the newly added field — derive its id from the op (backend pre-generates it)
// addField returns void; we identify the new field by label+type on the last field of the page
const page = (store.pages as any[]).find((p: any) => p.id === targetPageId);
const newField = page?.fields?.[page.fields.length - 1];
if (newField?.id) {
  store.setAIHighlightedFieldId(newField.id);
  setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
}
```

In the `UPDATE_FIELD` case, after `store.updateField(...)`:

```ts
store.setAIHighlightedFieldId(op.fieldId);
setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
```

- [ ] **Step 2: Add highlight ring to `PageBuilderFieldCard.tsx`**

In `apps/form-app/src/components/form-builder/tabs/PageBuilderFieldCard.tsx`, inside the `FieldCard` component:

Add this near the top of the component body:

```ts
const aiHighlightedFieldId = useFormBuilderStore((s) => s.aiHighlightedFieldId);
const isAIHighlighted = aiHighlightedFieldId === field.id;
const cardRef = React.useRef<HTMLDivElement>(null);

React.useEffect(() => {
  if (isAIHighlighted && cardRef.current) {
    cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}, [isAIHighlighted]);
```

Attach `cardRef` to the card's root element and add the highlight class conditionally:

```tsx
<div
  ref={cardRef}
  className={cn(
    // ... existing classes
    isAIHighlighted && 'ring-2 ring-primary ring-offset-2 transition-all duration-300'
  )}
>
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/lib/applyAIOp.ts apps/form-app/src/components/form-builder/tabs/PageBuilderFieldCard.tsx
git commit -m "feat(ai-frontend): field highlight ring + auto-scroll on AI add/edit"
```

---

### Task 11: `navigateToPage` tool

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`
- Modify: `apps/backend/src/routes/aiChat.ts` (system prompt)
- Modify: `apps/form-app/src/lib/aiAgentTypes.ts`
- Modify: `apps/form-app/src/lib/applyAIOp.ts`

- [ ] **Step 1: Add `navigateToPage` tool to `aiFormEditTools.ts`**

In `apps/backend/src/lib/aiFormEditTools.ts`, add inside the returned object (before the closing `}`):

```ts
navigateToPage: tool({
  description:
    'Navigate the form builder canvas to a specific page. Call this before editing fields on a page the user is not currently viewing.',
  inputSchema: z.object({
    pageId: z.string().describe('The page ID to navigate to — get it from listFields'),
  }),
  execute: async ({ pageId }) => ({ type: 'NAVIGATE_TO_PAGE' as const, pageId }),
}),
```

- [ ] **Step 2: Add to system prompt in `aiChat.ts`**

In `buildSystemPrompt`, append to the system prompt string:

```ts
`- Use navigateToPage before editing fields on a page the user isn't currently viewing.`
```

- [ ] **Step 3: Add `NavigateToPageToolPart` to `aiAgentTypes.ts`**

In `apps/form-app/src/lib/aiAgentTypes.ts`:

```ts
export interface NavigateToPageToolPart {
  type: 'tool-navigateToPage';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string };
  output?: { type: 'NAVIGATE_TO_PAGE'; pageId: string };
}
```

Add to `FormEditToolPart` union and to `MUTATION_TOOL_NAMES`:

```ts
export const MUTATION_TOOL_NAMES = new Set([
  'addField', 'updateField', 'removeField', 'reorderFields',
  'updateLayout', 'renamePage', 'reorderPages', 'addPage', 'removePage',
  'navigateToPage',
]);
```

- [ ] **Step 4: Handle `NAVIGATE_TO_PAGE` in `applyAIOp.ts`**

Add a new case:

```ts
case 'NAVIGATE_TO_PAGE': {
  const pageExists = (store.pages as any[]).some((p: any) => p.id === op.pageId);
  if (pageExists) store.setSelectedPage(op.pageId);
  break;
}
```

- [ ] **Step 5: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/routes/aiChat.ts apps/form-app/src/lib/aiAgentTypes.ts apps/form-app/src/lib/applyAIOp.ts
git commit -m "feat(ai): add navigateToPage tool — AI can switch canvas page mid-conversation"
```

---

## PHASE 3 — New AI Capabilities

---

### Task 12: Token usage meter

**Files:**
- Modify: `apps/form-app/src/graphql/aiChat.ts`
- Create: `apps/form-app/src/components/form-builder/AITokenMeter.tsx`
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Add `AI_TOKEN_USAGE` GraphQL query**

In `apps/form-app/src/graphql/aiChat.ts`, add:

```ts
export const AI_TOKEN_USAGE = gql`
  query AITokenUsage($organizationId: ID!) {
    aiTokenUsage(organizationId: $organizationId) {
      used
      limit
      resetAt
    }
  }
`;
```

- [ ] **Step 2: Create `AITokenMeter.tsx`**

```tsx
// apps/form-app/src/components/form-builder/AITokenMeter.tsx
import React from 'react';
import { useQuery } from '@apollo/client';
import { cn } from '@dculus/utils';
import { AI_TOKEN_USAGE } from '../../graphql/aiChat';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  organizationId: string;
}

const AITokenMeter: React.FC<Props> = ({ organizationId }) => {
  const { t } = useTranslation('aiEditDrawer');
  const { data } = useQuery(AI_TOKEN_USAGE, {
    variables: { organizationId },
    pollInterval: 30_000,
    fetchPolicy: 'cache-and-network',
  });

  const usage = data?.aiTokenUsage;
  if (!usage) return null;

  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const resetDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(usage.resetAt)
  );

  const barColor =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-green-500';
  const textColor =
    pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <div className="border-t border-border px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{t('tokenMeter.label')}</span>
        <span className={cn('text-xs font-medium', textColor)}>
          {(usage.used / 1000).toFixed(0)}k / {(usage.limit / 1000).toFixed(0)}k
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className={cn('text-xs', textColor)}>
          {t('tokenMeter.used', { values: { percent: pct } })}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('tokenMeter.resets', { values: { date: resetDate } })}
        </span>
      </div>
      {pct >= 100 && (
        <p className="mt-1 text-xs text-red-600">
          {t('tokenMeter.limitReached')}{' '}
          <a href="/pricing" className="underline">{t('tokenMeter.upgrade')}</a>
        </p>
      )}
    </div>
  );
};

export default AITokenMeter;
```

- [ ] **Step 3: Add `AITokenMeter` to `AIEditDrawer.tsx`**

Add import:

```ts
import AITokenMeter from './AITokenMeter';
```

In the drawer JSX, add `<AITokenMeter>` between the messages area and the input area:

```tsx
<AITokenMeter organizationId={organizationId} />

{/* Input */}
<div className="border-t border-border p-3">
  {/* ... existing input */}
</div>
```

- [ ] **Step 4: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/graphql/aiChat.ts apps/form-app/src/components/form-builder/AITokenMeter.tsx apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-frontend): token usage meter in drawer footer (green/amber/red, 30 s poll)"
```

---

### Task 13: `proposeValidation` tool (backend)

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`
- Modify: `apps/backend/src/routes/aiChat.ts` (system prompt)
- Test: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createFormEditTools } from '../aiFormEditTools.js';

describe('proposeValidation', () => {
  it('returns PROPOSE_VALIDATION op with suggestions', async () => {
    const tools = createFormEditTools({ pages: [] });
    const result = await tools.proposeValidation.execute({
      suggestions: [
        { fieldId: 'f1', fieldLabel: 'Age', fieldType: 'number', min: 0, max: 120 },
      ],
      rationale: 'Age should be between 0 and 120',
    });
    expect(result.type).toBe('PROPOSE_VALIDATION');
    expect(result.suggestions[0].fieldId).toBe('f1');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -A5 'proposeValidation'
```

Expected: `tools.proposeValidation is not a function`.

- [ ] **Step 3: Add `proposeValidation` tool to `aiFormEditTools.ts`**

In `apps/backend/src/lib/aiFormEditTools.ts`, add the tool before the closing `}` of the return object:

```ts
proposeValidation: tool({
  description:
    'Propose validation rules for fields based on their label and type. Use instead of updateField when suggesting validation — the user reviews before applying. Never call updateField for validation without explicit user confirmation.',
  inputSchema: z.object({
    suggestions: z.array(
      z.object({
        fieldId: z.string(),
        fieldLabel: z.string(),
        fieldType: z.string(),
        validation: z
          .object({
            minLength: z.number().nullable().optional(),
            maxLength: z.number().nullable().optional(),
            minSelections: z.number().nullable().optional(),
            maxSelections: z.number().nullable().optional(),
          })
          .optional(),
        min: z.number().nullable().optional(),
        max: z.number().nullable().optional(),
        required: z.boolean().optional(),
      })
    ),
    rationale: z.string().describe('Brief explanation of why these rules were chosen'),
  }),
  execute: async (args) => ({ type: 'PROPOSE_VALIDATION' as const, ...args }),
}),
```

- [ ] **Step 4: Add system prompt line in `aiChat.ts`**

In `buildSystemPrompt`, append:

```ts
`- When asked to suggest or review validation rules, call proposeValidation with all affected fields at once. Never call updateField for validation without explicit user confirmation.`
```

- [ ] **Step 5: Run tests**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -A5 'proposeValidation'
```

Expected: `✓ returns PROPOSE_VALIDATION op with suggestions`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/routes/aiChat.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "feat(ai): proposeValidation tool — AI suggests validation rules for user review"
```

---

### Task 14: `ValidationSuggestionCard` + frontend wiring

**Files:**
- Modify: `apps/form-app/src/lib/aiAgentTypes.ts`
- Modify: `apps/form-app/src/lib/applyAIOp.ts`
- Create: `apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx`
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Add `ProposeValidationToolPart` to `aiAgentTypes.ts`**

```ts
export interface ProposeValidationToolPart {
  type: 'tool-proposeValidation';
  toolCallId: string;
  state: ToolState;
  input?: { suggestions: any[]; rationale: string };
  output?: { type: 'PROPOSE_VALIDATION'; suggestions: any[]; rationale: string };
}
```

Add to `FormEditToolPart` union. Do NOT add `'proposeValidation'` to `MUTATION_TOOL_NAMES`.

- [ ] **Step 2: Handle `PROPOSE_VALIDATION` in `applyAIOp.ts`**

Add a case (does NOT call any store mutation — only sets pending suggestions):

```ts
case 'PROPOSE_VALIDATION': {
  store.setPendingValidationSuggestions(op.suggestions ?? []);
  break;
}
```

- [ ] **Step 3: Create `ValidationSuggestionCard.tsx`**

```tsx
// apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx
import React from 'react';
import { Button } from '@dculus/ui';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ValidationSuggestion } from '../../../store/types/store.types';

interface Props {
  organizationId?: string;
}

const ValidationSuggestionCard: React.FC<Props> = () => {
  const { t } = useTranslation('aiEditDrawer');
  const {
    pendingValidationSuggestions,
    acceptValidationSuggestion,
    dismissValidationSuggestion,
    updateField,
    pages,
  } = useFormBuilderStore();

  if (pendingValidationSuggestions.length === 0) return null;

  function applyUpdates(suggestion: ValidationSuggestion) {
    const pageId = pages.find((p) =>
      p.fields?.some((f) => f.id === suggestion.fieldId)
    )?.id;
    if (!pageId) return;
    const updates: Record<string, unknown> = {};
    if (suggestion.validation) updates.validation = suggestion.validation;
    if (suggestion.min != null) updates.min = suggestion.min;
    if (suggestion.max != null) updates.max = suggestion.max;
    if (suggestion.required != null) updates.validation = { ...((updates.validation as any) ?? {}), required: suggestion.required };
    updateField(pageId, suggestion.fieldId, updates as any);
  }

  const handleAccept = (fieldId: string) => {
    const suggestion = acceptValidationSuggestion(fieldId);
    if (suggestion) applyUpdates(suggestion);
  };

  const handleAcceptAll = () => {
    [...pendingValidationSuggestions].forEach((s) => {
      applyUpdates(s);
      dismissValidationSuggestion(s.fieldId);
    });
  };

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
      <p className="mb-2 font-medium text-blue-800">{t('validation.title')}</p>
      <div className="space-y-2">
        {pendingValidationSuggestions.map((s) => (
          <div key={s.fieldId} className="flex items-start justify-between gap-2 rounded border border-blue-100 bg-white p-2">
            <div>
              <p className="font-medium text-blue-900">"{s.fieldLabel}" ({s.fieldType})</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {Object.entries({
                  ...(s.validation ?? {}),
                  ...(s.min != null ? { min: s.min } : {}),
                  ...(s.max != null ? { max: s.max } : {}),
                })
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => handleAccept(s.fieldId)}>
                {t('validation.accept')}
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => dismissValidationSuggestion(s.fieldId)}>
                {t('validation.skip')}
              </Button>
            </div>
          </div>
        ))}
        <button
          className="text-xs text-blue-700 underline"
          onClick={handleAcceptAll}
        >
          {t('validation.acceptAll')}
        </button>
      </div>
    </div>
  );
};

export default ValidationSuggestionCard;
```

- [ ] **Step 4: Render `ValidationSuggestionCard` in `AIEditDrawer.tsx`**

Add import:

```ts
import ValidationSuggestionCard from './tool-parts/ValidationSuggestionCard';
```

Add inside the messages area, just above `<div ref={messagesEndRef} />`:

```tsx
<ValidationSuggestionCard />
```

Also update the `AssistantMessage` tool-parts render to handle `tool-proposeValidation` — render a simple pill (the card is rendered separately at the bottom):

```tsx
if (part.type === 'tool-proposeValidation' && (part as any).state === 'output-available') {
  return (
    <span key={i} className="text-xs text-blue-600 italic">
      ✦ {t('validation.title')}
    </span>
  );
}
```

- [ ] **Step 5: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/form-app/src/lib/aiAgentTypes.ts apps/form-app/src/lib/applyAIOp.ts apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-frontend): ValidationSuggestionCard with per-field accept/dismiss and accept-all"
```

---

### Task 15: `bulkUpdateFields` tool

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`
- Modify: `apps/backend/src/routes/aiChat.ts` (system prompt)
- Modify: `apps/form-app/src/lib/aiAgentTypes.ts`
- Modify: `apps/form-app/src/lib/applyAIOp.ts`
- Test: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`, add:

```ts
describe('bulkUpdateFields', () => {
  it('returns BULK_UPDATE_FIELDS with fieldIds and updates', async () => {
    const tools = createFormEditTools({ pages: [] });
    const result = await tools.bulkUpdateFields.execute({
      fieldIds: ['f1', 'f2'],
      updates: { required: true },
    });
    expect(result.type).toBe('BULK_UPDATE_FIELDS');
    expect(result.fieldIds).toEqual(['f1', 'f2']);
    expect(result.updates.required).toBe(true);
  });
});
```

- [ ] **Step 2: Extract shared `updatesSchema` and add `bulkUpdateFields` in `aiFormEditTools.ts`**

At the top of `createFormEditTools`, before the return, extract:

```ts
const updatesSchema = z.object({
  label: z.string().optional(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
  options: z.array(z.string()).optional(),
  validation: z.object({
    required: z.boolean().optional(),
    minLength: z.number().nullable().optional(),
    maxLength: z.number().nullable().optional(),
    minSelections: z.number().nullable().optional(),
    maxSelections: z.number().nullable().optional(),
  }).optional(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  minDate: z.string().nullable().optional(),
  maxDate: z.string().nullable().optional(),
});
```

Update `updateField.inputSchema` to use `updatesSchema`:

```ts
inputSchema: z.object({ fieldId: z.string(), updates: updatesSchema }),
```

Add `bulkUpdateFields`:

```ts
bulkUpdateFields: tool({
  description:
    'Apply the same update to multiple fields at once. Use instead of multiple updateField calls when applying the same change to 3 or more fields.',
  inputSchema: z.object({
    fieldIds: z.array(z.string()).min(2).describe('IDs of all fields to update'),
    updates: updatesSchema,
  }),
  execute: async (args) => ({ type: 'BULK_UPDATE_FIELDS' as const, ...args }),
}),
```

- [ ] **Step 3: Add system prompt line**

In `buildSystemPrompt` in `aiChat.ts`, append:

```ts
`- Use bulkUpdateFields instead of multiple updateField calls when applying the same change to 3 or more fields.`
```

- [ ] **Step 4: Add `BulkUpdateFieldsToolPart` to `aiAgentTypes.ts`**

```ts
export interface BulkUpdateFieldsToolPart {
  type: 'tool-bulkUpdateFields';
  toolCallId: string;
  state: ToolState;
  input?: { fieldIds: string[]; updates: Record<string, unknown> };
  output?: { type: 'BULK_UPDATE_FIELDS'; fieldIds: string[]; updates: Record<string, unknown> };
}
```

Add to `FormEditToolPart` union and to `MUTATION_TOOL_NAMES`:

```ts
export const MUTATION_TOOL_NAMES = new Set([
  'addField', 'updateField', 'removeField', 'reorderFields',
  'updateLayout', 'renamePage', 'reorderPages', 'addPage', 'removePage',
  'navigateToPage', 'bulkUpdateFields',
]);
```

- [ ] **Step 5: Handle `BULK_UPDATE_FIELDS` in `applyAIOp.ts`**

```ts
case 'BULK_UPDATE_FIELDS': {
  for (const fieldId of op.fieldIds ?? []) {
    const pageId = findPageForField(store.pages, fieldId);
    if (pageId) store.updateField(pageId, fieldId, op.updates);
  }
  break;
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -A5 'bulkUpdateFields'
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/routes/aiChat.ts apps/form-app/src/lib/aiAgentTypes.ts apps/form-app/src/lib/applyAIOp.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "feat(ai): bulkUpdateFields tool — apply same change to N fields in one tool call"
```

---

### Task 16: Remix form — system prompt + chip

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts` (system prompt only)
- Modify: `apps/form-app/src/hooks/useAIChips.ts` (remix chip already included — verify prompt)

- [ ] **Step 1: Add remix instructions to system prompt in `aiChat.ts`**

In `buildSystemPrompt`, append to the returned string:

```ts
`- When asked to 'remix', 'transform', or 'convert' the form for a different purpose: (1) call listFields to read the full current structure across all pages, (2) remove fields that clearly don't fit the new purpose using removeField, (3) add fields that belong using addField, (4) preserve fields that work for both purposes and update their labels if needed via updateField, (5) call updateLayout to update the title and CTA button. Do not remove the last field on a page before adding new ones — add first, then remove.`
```

- [ ] **Step 2: Verify the remix chip is in `useAIChips.ts`**

Confirm the chip with `key: 'remixForm'` exists with prompt:

```ts
prompt: 'I want to transform this form for a different purpose. Please remix it into: ',
```

This prompt is intentionally incomplete — the user types the new purpose before sending. The chip's `onClick` should set the input field text rather than sending immediately. Update `AIEditDrawer.tsx` chip handler:

```tsx
{chips.map((chip) => (
  <button
    key={chip.key}
    onClick={() => {
      if (chip.key === 'remixForm') {
        setInput(chip.prompt); // pre-fill, let user complete
      } else {
        sendMessage(chip.prompt);
      }
    }}
    // ...
  >
```

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -10
```

- [ ] **Step 4: Run full unit test suite**

```bash
pnpm test:unit 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts apps/form-app/src/hooks/useAIChips.ts apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai): remix form — system prompt instructions + pre-fill chip for form transformation"
```

---

## Final Verification

- [ ] **Start all services and manually verify each phase**

```bash
pnpm dev
```

Open the form builder. Open the AI drawer. Test:

1. **Phase 1:** Send a message — confirm no Y.js re-parse delay after first message in a conversation. Check server logs for cache hits.
2. **Phase 2:** Ask "Add an email field" — confirm live status label "Adding field…" appears before the result. Confirm the new field pulses in the canvas. Confirm change summary card appears. Confirm undo badge appears on the completed message.
3. **Phase 2:** Ask "Make all fields required" — confirm `bulkUpdateFields` chip appears for forms with multiple optional fields.
4. **Phase 2:** Switch to a multi-page form — confirm "Reorganise pages" chip appears.
5. **Phase 3:** Check the token meter appears in the drawer footer and shows the correct colour.
6. **Phase 3:** Ask "Suggest validation for all fields" — confirm validation cards appear with accept/skip per field. Click Accept on one — confirm the field updates in the canvas.
7. **Phase 3:** Click "Remix this form" chip — confirm the input is pre-filled with the prompt, not sent immediately.

- [ ] **Run type-check and lint**

```bash
pnpm type-check && pnpm lint
```

Expected: no errors.
