# AI Builder Chat — Stability & Feature Overhaul

**Date:** 2026-06-01  
**Status:** Approved  
**Phases:** 3 (sequential)

---

## Context

The form builder's AI chat (`AIEditDrawer`) is built on the Vercel AI SDK (`ai` + `@ai-sdk/react` + `@ai-sdk/azure`). The core loop works: users send messages, a `ToolLoopAgent` edits the form via 11 tools, mutations are streamed back and applied to the Y.js collaborative document.

Three gaps motivate this work:

1. **Stability** — schema is re-fetched from Y.js on every message, history grows unbounded, the step cap silently truncates multi-step requests, and the stream bridge is fragile.
2. **UX feedback** — while the AI works, users see generic bouncing dots and can't tell what changed or undo a specific turn.
3. **Capability gaps** — no batch tool, no validation suggestions with user confirmation, no "remix" transformation workflow, and no token usage visibility.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  AIEditDrawer (React)                                    │
│  ├── useAIChat()           — conversation + stream mgmt  │
│  ├── useAIChips()          — context-aware quick chips   │ ← new
│  ├── AITokenMeter          — quota progress bar          │ ← new
│  ├── ChangeSummaryCard     — per-turn diff               │ ← new
│  └── ValidationSuggestionCard — accept/dismiss UI        │ ← new
└────────────────┬────────────────────────────────────────┘
                 │ HTTP stream (DefaultChatTransport)
┌────────────────▼────────────────────────────────────────┐
│  POST /api/ai/chat  (Express route)                      │
│  ├── schema cache (10 s TTL, Map<formId,schema>)         │ ← new
│  ├── token budget cache (30 s TTL, Map<orgId,budget>)    │ ← new
│  ├── pruneMessages — cross-request history compaction    │ ← new
│  └── ToolLoopAgent (stepCountIs 15, prepareStep)         │ ← updated
│       tools: 11 existing + navigateToPage                │ ← new
│                         + proposeValidation               │ ← new
│                         + bulkUpdateFields                │ ← new
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Stability

### 1.1 Schema Cache

**Problem:** `getFormSchemaFromYjs()` in `apps/backend/src/routes/aiChat.ts:27` runs on every request — Y.js `applyUpdate` + two Prisma queries.

**Fix:** Module-level cache with 10-second TTL.

```ts
// aiChat.ts (top of file)
const schemaCache = new Map<string, { schema: { pages: any[] }; cachedAt: number }>();
const SCHEMA_CACHE_TTL_MS = 10_000;

async function getFormSchema(formId: string): Promise<{ pages: any[] }> {
  const cached = schemaCache.get(formId);
  if (cached && Date.now() - cached.cachedAt < SCHEMA_CACHE_TTL_MS) return cached.schema;
  const schema = (await getFormSchemaFromYjs(formId)) ?? { pages: [] };
  schemaCache.set(formId, { schema, cachedAt: Date.now() });
  return schema;
}
```

Add `POST /api/ai/invalidate-schema` — called fire-and-forget from `applyAIOp.ts` after each mutation is applied. Clears the cache entry for that `formId`.

### 1.2 Context Management via `pruneMessages` + `prepareStep`

**Problem:** `loadConversationMessages` in `aiChatService.ts:61` fetches every message ever saved, with no pruning. Long conversations hit context limits and slow down.

**Fix (Layer 1 — cross-request):** After `convertToModelMessages`, prune the full history before passing to the agent:

```ts
import { pruneMessages, convertToModelMessages } from 'ai';

const modelMessages = await convertToModelMessages(validated);
const prunedModelMessages = pruneMessages({
  messages: modelMessages,
  reasoning: 'all',                    // strip stale reasoning tokens
  toolCalls: 'before-last-3-messages', // keep tool context from recent turns only
  emptyMessages: 'remove',
});
```

**Fix (Layer 2 — within agent, `prepareStep`):** Add `prepareStep` to `ToolLoopAgent` in `formEditAgent.ts`:

```ts
prepareStep: ({ messages }) => {
  const estimatedTokens = JSON.stringify(messages).length / 4;
  if (estimatedTokens > 50_000) {
    return {
      messages: pruneMessages({
        messages,
        reasoning: 'all',
        toolCalls: 'before-last-3-messages',
        emptyMessages: 'remove',
      }),
    };
  }
},
```

This is the SDK-native approach (`ai` v5) — keeps all user/assistant text, trims only tool internals. Threshold-based so short conversations pay zero cost.

### 1.3 Step Cap: 8 → 15

**Problem:** `stepCountIs(8)` in `formEditAgent.ts:8` silently truncates complex requests. "Add 5 fields across 2 pages" needs up to 12 steps.

**Fix:** Raise to `stepCountIs(15)`. Add `onStepFinish` for a keep-alive SSE comment on slow operations:

```ts
onStepFinish: ({ stepType }) => {
  logger.debug({ stepType, conversationId }, 'AI agent step complete');
},
```

### 1.4 Stream Bridge: `Readable.fromWeb` → `for await`

**Problem:** `Readable.fromWeb(webResponse.body).pipe(res)` in `aiChat.ts:201` drops `onFinish` token counts if the pipe errors mid-stream.

**Fix:** Replace with a try/finally loop:

```ts
try {
  for await (const chunk of webResponse.body as any) {
    res.write(chunk);
  }
} finally {
  res.end();
}
```

### 1.5 Token Budget Cache

**Problem:** `checkAITokenBudget` in `aiUsageService.ts` hits the DB on every message.

**Fix:** Module-level cache with 30-second TTL. `recordAITokenUsage` invalidates the entry for that org. 402 responses remain accurate within 30 seconds.

```ts
const budgetCache = new Map<string, { result: BudgetResult; cachedAt: number }>();
const BUDGET_CACHE_TTL_MS = 30_000;
```

### 1.6 `autoGenerateTitle` Error Boundary

**Problem:** If the conversation is deleted between title generation and the DB update, the unhandled rejection leaks.

**Fix:** Wrap the `.then` chain in its own try/catch:

```ts
.then(async ({ text }) => {
  try {
    const title = text.trim().slice(0, 60);
    await prisma.aIChatConversation.update({ where: { id: conversationId }, data: { title } });
  } catch (err) {
    logger.warn({ err, conversationId }, 'Failed to save auto-generated title');
  }
})
```

---

## Phase 2 — UX & Feedback

### 2.1 Live Tool-Call Status Labels

**Files:** `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

In `AssistantMessage`, detect parts with `state === 'input-streaming'` or `'input-available'` and render a labelled `StatusIndicator` instead of generic dots:

```ts
function toolStatusLabel(part: FormEditToolPart): string {
  const toolName = part.type.slice(5); // strip 'tool-'
  switch (toolName) {
    case 'listFields':   return 'Reading form structure…';
    case 'getField':     return `Reading field details…`;
    case 'addField':     return `Adding field "${(part.input as any)?.label ?? ''}…"`;
    case 'updateField':  return 'Updating field…';
    case 'removeField':  return 'Removing field…';
    case 'reorderFields': return 'Reordering fields…';
    case 'updateLayout': return 'Updating layout…';
    case 'addPage':      return `Adding page "${(part.input as any)?.title ?? ''}…"`;
    case 'removePage':   return 'Removing page…';
    case 'renamePage':   return 'Renaming page…';
    case 'navigateToPage': return 'Navigating to page…';
    default:             return 'Working…';
  }
}
```

Renders via the existing `<StatusIndicator text={...} />` component (already accepts a `text` prop).

### 2.2 Change Summary Card

**New file:** `apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx`

After each assistant message completes, collect all mutation parts with `state === 'output-available'`, map through `buildOpLabel()` (already in `useAIChat.ts`), colour-code by type, render below the text bubble:

- Green `+` for ADD_FIELD, ADD_PAGE
- Blue `~` for UPDATE_FIELD, UPDATE_LAYOUT, RENAME_PAGE, REORDER_FIELDS, REORDER_PAGES, BULK_UPDATE_FIELDS
- Red `−` for REMOVE_FIELD, REMOVE_PAGE

Rendered inside `AssistantMessage` below `<TextBubble>`, only when `isStreaming === false` and at least one mutation part exists.

### 2.3 Per-Message Undo Badge

**Files:** `useAIChat.ts`, `AIEditDrawer.tsx`

Track Y.js undo-stack depth before and after each message send. Store `undoDepthBefore` in a ref. After mutations apply (useEffect watching messages), compute `undoDepthAfter - undoDepthBefore` and store in a `Map<messageId, number>` ref.

The "Undo this" badge renders only on the **most recent** assistant message that has mutations (Y.js undo is LIFO — older-message undo would require snapshots). Clicking pops the stored number of entries from the Y.js undo stack.

```ts
// in useAIChat.ts
const undoDepthBeforeRef = useRef(0);
const messageUndoDepths = useRef(new Map<string, number>());

// before sendMessage:
undoDepthBeforeRef.current = getUndoStackDepth(); // new hook export from useYjsUndoManager

// in the mutations useEffect, after last mutation applied:
const depth = getUndoStackDepth() - undoDepthBeforeRef.current;
if (depth > 0) messageUndoDepths.current.set(lastMsg.id, depth);
```

### 2.4 Context-Aware Quick Chips

**New file:** `apps/form-app/src/hooks/useAIChips.ts`

Replaces the hardcoded `QUICK_CHIP_PROMPTS` constant. Reads from `useFormBuilderStore` and returns max 3 chips based on form state:

| Condition | Chip |
|-----------|------|
| Total fields === 0 | ✦ Generate fields from a description |
| Total fields > 0 | ✦ Analyse & suggest improvements |
| Any optional fields exist | Make all fields required |
| Pages > 1 | Reorganise pages |
| Any field has no validation | ✦ Suggest validation rules |
| Fields > 2 | ✦ Remix this form |

Priority order: generation → analysis → required → reorganise → validation → remix. Max 3 rendered. Chips with ✦ trigger a detailed system prompt; others send a short direct command.

### 2.5 Field Highlight on Add/Edit

**Files:** `apps/form-app/src/store/slices/selectionSlice.ts`, `applyAIOp.ts`, field card component

Add `aiHighlightedFieldId: string | null` and `setAIHighlightedFieldId(id: string | null): void` to `selectionSlice.ts`.

In `applyAIOp.ts`, after applying `ADD_FIELD` or `UPDATE_FIELD`:

```ts
store.setAIHighlightedFieldId(newFieldId);
setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
```

In the field card component, when `fieldId === aiHighlightedFieldId`:
- Add Tailwind classes: `ring-2 ring-primary ring-offset-2 transition-all`
- Call `ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })` in a `useEffect`

### 2.6 Page-Switch Command (`navigateToPage` tool)

**Backend — `aiFormEditTools.ts`:** New tool:

```ts
navigateToPage: tool({
  description: 'Navigate the form builder canvas to a specific page. Call this before editing fields on a page the user is not currently viewing.',
  inputSchema: z.object({
    pageId: z.string().describe('The page ID to navigate to'),
  }),
  execute: async ({ pageId }) => ({ type: 'NAVIGATE_TO_PAGE' as const, pageId }),
}),
```

**System prompt addition:** "Use navigateToPage before editing fields on a page the user isn't currently viewing."

**Frontend — `aiAgentTypes.ts`:** Add `NavigateToPageToolPart` type and add `'navigateToPage'` to `MUTATION_TOOL_NAMES`.

**`applyAIOp.ts`:** Handle `NAVIGATE_TO_PAGE` by calling `store.setSelectedPageId(pageId)`.

---

## Phase 3 — New AI Capabilities

### 3.1 Token Usage Meter

**New file:** `apps/form-app/src/components/form-builder/AITokenMeter.tsx`

Queries `aiTokenUsage(organizationId)` on drawer open; re-polls every 30 seconds using `setInterval`. Renders in the drawer footer (below the input area):

- **0–79%** — green progress bar, "X / Y tokens used · Resets {date}"
- **80–99%** — amber bar + amber warning text
- **100%** — red bar, input disabled, "Upgrade plan" link shown

No backend changes. Uses the existing `aiTokenUsage` GraphQL query which returns `{ used, limit, resetAt }`.

**New GraphQL query in `apps/form-app/src/graphql/aiChat.ts`:**

```graphql
query AITokenUsage($organizationId: ID!) {
  aiTokenUsage(organizationId: $organizationId) {
    used
    limit
    resetAt
  }
}
```

### 3.2 Validation Suggestions (`proposeValidation` tool)

**Backend — `aiFormEditTools.ts`:** New read-only tool. Execute is pure JS — no DB call, uses schema already in scope:

```ts
proposeValidation: tool({
  description: 'Propose validation rules for fields based on their label and type. Use this instead of updateField when suggesting validation — it lets the user review before applying. Do not call updateField for validation without user confirmation.',
  inputSchema: z.object({
    suggestions: z.array(z.object({
      fieldId: z.string(),
      fieldLabel: z.string(),
      fieldType: z.string(),
      validation: z.object({
        minLength: z.number().nullable().optional(),
        maxLength: z.number().nullable().optional(),
        minSelections: z.number().nullable().optional(),
        maxSelections: z.number().nullable().optional(),
      }).optional(),
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      required: z.boolean().optional(),
    })),
    rationale: z.string().describe('Brief explanation of the suggestions'),
  }),
  execute: async (args) => ({ type: 'PROPOSE_VALIDATION' as const, ...args }),
}),
```

**System prompt addition:** "When asked to suggest or review validation rules, call proposeValidation with all fields at once. Never call updateField for validation without explicit user confirmation."

**Frontend — new `ValidationSuggestionCard.tsx`:** Renders per-suggestion accept/dismiss UI. `applyAIOp` does NOT auto-apply `PROPOSE_VALIDATION`. Instead:

1. Add `pendingValidationSuggestions` array to a new `aiSlice.ts` in the Zustand store
2. `applyAIOp` sets `pendingValidationSuggestions` from the tool output
3. `ValidationSuggestionCard` reads from the store and renders accept/skip per field
4. "Accept" dispatches an `UPDATE_FIELD` Y.js op for that field; "Skip" removes from pending
5. "Accept all" iterates the full list

**`aiAgentTypes.ts`:** Add `ProposeValidationToolPart` type. `proposeValidation` is NOT in `MUTATION_TOOL_NAMES` (it never auto-applies).

### 3.3 Bulk Field Operations (`bulkUpdateFields` tool)

**Backend — `aiFormEditTools.ts`:** New tool using the same `updates` schema as `updateField`:

```ts
bulkUpdateFields: tool({
  description: 'Apply the same update to multiple fields at once. Use instead of multiple updateField calls when applying the same change to 3 or more fields.',
  inputSchema: z.object({
    fieldIds: z.array(z.string()).min(2).describe('IDs of all fields to update'),
    updates: updatesSchema, // same z.object({...}) as updateField.updates
  }),
  execute: async (args) => ({ type: 'BULK_UPDATE_FIELDS' as const, ...args }),
}),
```

Extract the `updates` schema into a shared `const updatesSchema = z.object({...})` so both `updateField` and `bulkUpdateFields` reference the same definition.

**System prompt addition:** "Use bulkUpdateFields instead of multiple updateField calls when applying the same property change to 3 or more fields."

**Frontend — `applyAIOp.ts`:** Handle `BULK_UPDATE_FIELDS` — iterate `fieldIds`, apply `UPDATE_FIELD` for each within the same Y.js batch. `ChangeSummaryCard` renders it as "~ Updated N fields (required)".

**`aiAgentTypes.ts`:** Add `BulkUpdateFieldsToolPart` and add `'bulkUpdateFields'` to `MUTATION_TOOL_NAMES`.

### 3.4 Remix Form

**No new tool.** The AI orchestrates existing tools: `listFields` → `removeField` (for fields that don't fit) → `addField` (new fields) → `updateLayout`.

**System prompt addition:**

```
When asked to 'remix', 'transform', or 'convert' the form for a different purpose:
1. Call listFields to read the full current structure across all pages.
2. Remove fields that clearly don't fit the new purpose (use removeField).
3. Add fields that belong in the new form (use addField).
4. Preserve fields that work for both purposes — update their labels if needed.
5. Call updateLayout to update the title and CTA button.
Do not remove the last field on a page before adding new ones — add first, then remove.
```

**`useAIChips.ts`:** When `totalFields > 2`, include a "✦ Remix this form" chip. Its prompt opens with: "I want to transform this form for a different purpose. Please remix it into: [user describes new purpose]". The chip sends a partial prompt that leaves the new-purpose blank — the user finishes typing before sending.

---

## Data Flow Summary

```
User message
  → DefaultChatTransport (prepareSendMessagesRequest adds currentPageId)
  → POST /api/ai/chat
      → auth + org check
      → token budget (30s cache)
      → load history from DB
      → schema from cache (10s TTL) or Y.js parse
      → pruneMessages (cross-request, Layer 1)
      → ToolLoopAgent.stream()
          → prepareStep: pruneMessages if > 50k tokens (Layer 2)
          → tools execute: return op objects (ADD_FIELD, UPDATE_FIELD, etc.)
          → stopWhen: stepCountIs(15)
      → stream to client via for-await loop
      → onFinish: saveConversationMessages + recordAITokenUsage
                  + autoGenerateTitle (fire-and-forget, with error guard)

Client stream
  → useChat (messages state updated per chunk)
  → useEffect: detect mutation tool parts with state='output-available'
      → applyAIOp → Y.js mutations
      → setAIHighlightedFieldId (ADD/UPDATE → pulse ring + scroll)
      → NAVIGATE_TO_PAGE → setSelectedPageId
      → BULK_UPDATE_FIELDS → N × UPDATE_FIELD in one Y.js batch
      → PROPOSE_VALIDATION → pendingValidationSuggestions (no auto-apply)
      → fire-and-forget: POST /api/ai/invalidate-schema
```

---

## New Files

| File | Purpose |
|------|---------|
| `apps/form-app/src/hooks/useAIChips.ts` | Context-aware chip derivation |
| `apps/form-app/src/components/form-builder/AITokenMeter.tsx` | Token quota progress bar |
| `apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx` | Per-turn mutation diff |
| `apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx` | Accept/dismiss validation UI |
---

## Modified Files

| File | Changes |
|------|---------|
| `apps/backend/src/routes/aiChat.ts` | Schema cache, token budget cache, `pruneMessages` (Layer 1), `for-await` stream bridge |
| `apps/backend/src/lib/formEditAgent.ts` | `stepCountIs(15)`, `prepareStep` hook |
| `apps/backend/src/lib/aiFormEditTools.ts` | + `navigateToPage`, `proposeValidation`, `bulkUpdateFields`; extract shared `updatesSchema` |
| `apps/backend/src/services/aiChatService.ts` | `autoGenerateTitle` inner try/catch |
| `apps/backend/src/services/aiUsageService.ts` | Budget cache; invalidate on `recordAITokenUsage` |
| `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` | Live status labels, change summary, undo badge, token meter, chips via `useAIChips` |
| `apps/form-app/src/hooks/useAIChat.ts` | Undo depth tracking, `messageUndoDepths` ref, schema invalidation call |
| `apps/form-app/src/lib/applyAIOp.ts` | + `NAVIGATE_TO_PAGE`, `BULK_UPDATE_FIELDS`, `PROPOSE_VALIDATION` (sets store), schema invalidation |
| `apps/form-app/src/lib/aiAgentTypes.ts` | New tool part types; `MUTATION_TOOL_NAMES` additions |
| `apps/form-app/src/store/slices/selectionSlice.ts` | + `aiHighlightedFieldId`, `setAIHighlightedFieldId` |
| `apps/form-app/src/store/slices/aiSlice.ts` | New — `pendingValidationSuggestions` + slice actions |
| `apps/form-app/src/graphql/aiChat.ts` | + `AI_TOKEN_USAGE` query |

---

## Error Handling

- **Schema cache miss:** Falls back to Y.js parse; if that fails, uses `{ pages: [] }` — agent still runs with empty schema context
- **Token budget cache stale:** Worst case: 30-second window where an org over-limit gets one more message through. Acceptable given the low volume
- **`pruneMessages` over-prunes:** The `before-last-3-messages` strategy always preserves the current exchange, so the agent always has the immediate context it needs
- **`proposeValidation` with unknown fieldId:** Card renders with field label from tool input; if `fieldId` no longer exists in the form (deleted since the tool ran), `applyAIOp` skips that field's UPDATE_FIELD op silently
- **`bulkUpdateFields` partial failure:** Each field's Y.js op is applied independently — if one field is missing, that op is skipped; others still apply
- **`navigateToPage` with invalid pageId:** Store's `setSelectedPageId` is a no-op if the page doesn't exist — no crash

---

## Testing

- **Phase 1 — Unit:** `aiChatService.test.ts` — add test for `autoGenerateTitle` when conversation deleted mid-flight. `aiChat.test.ts` — add test for schema cache hit/miss, budget cache invalidation.
- **Phase 2 — Unit:** `useAIChips` — snapshot tests for each form-state condition. `applyAIOp` — add cases for `NAVIGATE_TO_PAGE`, `BULK_UPDATE_FIELDS`, `PROPOSE_VALIDATION`.
- **Phase 3 — Integration (Cucumber):** New scenario: "Given a form with 5 fields, when I ask the AI to suggest validation, then I see accept/dismiss cards and accepting applies the rule." Existing `test:integration` suite covers the REST endpoint contract.
- **All phases — Manual:** Use the dev server (`pnpm dev`) to verify streaming labels, field highlight timing, token meter colour transitions, and remix workflow end-to-end before marking each phase complete.
