# AI Chat Form Builder — Redesign Spec

**Date:** 2026-05-27  
**Status:** Approved for implementation

---

## Problem Statement

The current AI chat implementation has eight concrete failure points:

1. `ADD_FIELD` always appends to `pages[0]` — ignores `insertAfterFieldId` and multi-page forms
2. `inspectForm` tool is a no-op — returns a static note instead of live form data
3. `UPDATE_LAYOUT` passes the full op object (including `type`) to `store.updateLayout()` — type mismatch
4. `buildOpLabel` duplicated between `useAIChat.ts` and `AIEditDrawer.tsx`
5. WebSocket subscription race condition — subscription may start before the DB write from `sendAIChatUserMessage` completes
6. `currentFormState` sent as a JSON scalar on every subscription — form state is stale and expensive
7. No undo — AI mistakes require prompting the AI to revert
8. No multi-page awareness — AI has no concept of which page the user is editing

---

## Design Goals

- One clear responsibility per unit (hook, function, route)
- AI reads live form state via tool calls — no form state in request body or system prompt
- HTTP NDJSON streaming replaces WebSocket subscription entirely
- Apply-immediately with per-response undo snapshot
- All store mutations from AI go through a single testable function

---

## Responsibility Map

### Backend

| Unit | Owns |
|---|---|
| `POST /api/ai/chat` | Auth, save user message, build stream, pipe NDJSON, save assistant message + tokens |
| `aiChatService.buildChatStream()` | Fetch conversation history from DB, build system prompt, call `streamText` with tools |
| `createFormEditTools(formId)` | Factory — returns 7 tools, all closed over `formId` for live DB reads |

### Frontend

| Unit | Owns |
|---|---|
| `useAIChat` | Conversation CRUD (GraphQL). Wires `useAIStream` + `useUndoStack`. Exposes clean API. |
| `useAIStream` | `fetch()` POST + NDJSON reader. Calls `onTextDelta`, `onOperation`, `onDone`, `onError`. |
| `applyAIOp()` | Pure function. All store mutations triggered by AI. Handles position, multi-page, options. |
| `useUndoStack` | Snapshot Zustand state before first op in a batch. `undo()` restores snapshot. |
| `AIEditDrawer` | Pure UI — renders messages, undo button, streaming chips. No business logic. |

---

## Stream Protocol (NDJSON)

The `POST /api/ai/chat` endpoint streams newline-delimited JSON chunks:

```
{"type":"text","delta":"I'll add a name field for you."}
{"type":"operation","op":{"type":"ADD_FIELD","pageId":"p1","insertAfterFieldId":null,"fieldType":"text","label":"Full Name","required":true,"placeholder":"Enter your name","options":null}}
{"type":"done","messageId":"msg_abc123"}
```

Error chunk: `{"type":"error","error":"AI processing failed. Please try again."}`

---

## Backend Changes

### 1. New REST route: `apps/backend/src/routes/aiChat.ts`

```
POST /api/ai/chat
Content-Type: application/json
Body: { conversationId, organizationId, content, currentPageId? }

Response: application/x-ndjson (streamed)
```

**Flow:**
1. `requireAuth` + `requireOrganizationMembership`
2. `checkAITokenBudget` — if over limit, write error chunk and return
3. `saveUserMessage(conversationId, content)` — save to DB
4. If first message (messageCount ≤ 1): fire-and-forget `autoGenerateTitle`
5. Set `Content-Type: application/x-ndjson`, `Cache-Control: no-cache`
6. `buildChatStream(conversationId, userId, currentPageId)` → `stream`
7. Iterate `stream.fullStream`:
   - `text-delta` → write `{"type":"text","delta":"..."}\n`
   - `tool-result` → if `output` is an op object, write `{"type":"operation","op":{...}}\n`; accumulate ops array
   - `finish` → save assistant message + record token usage → write `{"type":"done","messageId":"..."}\n` → `res.end()`
8. `catch` → write `{"type":"error","error":"..."}\n` → `res.end()`

Register in `apps/backend/src/index.ts` **before** Apollo middleware.

### 2. Rewritten tools: `apps/backend/src/lib/aiFormEditTools.ts`

Replace static tool exports with a factory `createFormEditTools(formId: string)`:

| Tool | Description | DB access |
|---|---|---|
| `listFields(pageId?)` | Returns all pages + field summaries (id, type, label, required). Filtered to pageId if provided. | `Form.formSchema` via Prisma |
| `getField(fieldId)` | Returns full field details: placeholder, hint, options, validation, pageId. | `Form.formSchema` via Prisma |
| `addField(pageId, insertAfterFieldId, fieldType, label, required, placeholder, options)` | Returns `ADD_FIELD` op — no DB write, frontend applies it | none |
| `updateField(fieldId, updates)` | Returns `UPDATE_FIELD` op | none |
| `removeField(fieldId)` | Returns `REMOVE_FIELD` op | none |
| `reorderFields(pageId, fieldIds)` | Returns `REORDER_FIELDS` op | none |
| `updateLayout(content?, customCTAButtonName?)` | Returns `UPDATE_LAYOUT` op | none |

`inspectForm` tool is removed.

`listFields` and `getField` read from `Form.formSchema` (the Prisma `Json` field) — this is the persisted form state. During active editing, Hocuspocus syncs Y.js state to this field; the AI works with a version that may be up to one autosave interval behind, which is acceptable.

### 3. Updated service: `apps/backend/src/services/aiChatService.ts`

Remove `buildStreamForConversation`. Add:

```typescript
buildChatStream(conversationId: string, userId: string, currentPageId?: string): Promise<StreamResult>
```

**System prompt** (short — no form state baked in):
```
You are an AI assistant that helps users edit their form.
Use listFields to understand the form structure before making changes.
Use getField to read a field's full details before updating it.
The user is currently editing page: {currentPageId ?? 'first page'}.
Make only the changes the user requests. Confirm what you did in your final text response.
```

`stopWhen: stepCountIs(8)` (up from 5 to allow listFields + getField calls before edits).

### 4. GraphQL changes: `apps/backend/src/graphql/`

**Removed from schema:**
- `Subscription.aiChatStream`
- `Mutation.sendAIChatUserMessage`
- `type AIChatChunk`

**Removed from resolver:**
- `aiChatResolvers.Subscription`
- `aiChatResolvers.Mutation.sendAIChatUserMessage`

**Unchanged:** `listAIChatConversations`, `getAIChatConversation`, `createAIChatConversation`, `deleteAIChatConversation`, `renameAIChatConversation`

---

## Frontend Changes

### 1. New hook: `apps/form-app/src/hooks/useAIStream.ts`

```typescript
interface UseAIStreamCallbacks {
  onTextDelta: (delta: string) => void;
  onOperation: (op: FormOperation) => void;
  onDone: (messageId: string) => void;
  onError: (error: string) => void;
}

function useAIStream(organizationId: string, callbacks: UseAIStreamCallbacks): {
  isStreaming: boolean;
  sendMessage: (conversationId: string, content: string, currentPageId?: string) => Promise<void>;
  cancel: () => void;
}
```

**Implementation:**
- `fetch(VITE_API_URL + '/api/ai/chat', { method: 'POST', credentials: 'include', body: JSON.stringify({...}) })`
- Read `response.body` as `ReadableStream` via `getReader()`
- Decode with `TextDecoder`, split on `\n`, parse each line as JSON
- Route each chunk to the appropriate callback
- `AbortController` ref for `cancel()`

### 2. New pure function: `apps/form-app/src/lib/applyAIOp.ts`

```typescript
function applyAIOp(op: FormOperation, store: FormBuilderStore): void
```

Handles all op types correctly:

| Op | Correct behavior |
|---|---|
| `ADD_FIELD` | Find `op.pageId` (falls back to `pages[0]`). Find index of `insertAfterFieldId` (or append). Call `store.addField` with full fieldData including `options`. |
| `UPDATE_FIELD` | Find page containing `op.fieldId`. Call `store.updateField(pageId, fieldId, op.updates)` — `op.updates` only, no `type` field leaked in. |
| `REMOVE_FIELD` | Find page containing `op.fieldId`. Call `store.removeField(pageId, fieldId)`. |
| `REORDER_FIELDS` | Find page by `op.pageId`. Walk `op.fieldIds`, swap using `store.reorderFields`. |
| `UPDATE_LAYOUT` | Call `store.updateLayout({ content: op.content, customCTAButtonName: op.customCTAButtonName })` — explicitly pick only valid keys. |

### 3. New hook: `apps/form-app/src/hooks/useUndoStack.ts`

```typescript
interface UndoSnapshot {
  pages: unknown;   // deep-cloned store pages at snapshot time
  layout: unknown;  // deep-cloned store layout at snapshot time
}

function useUndoStack(): {
  canUndo: boolean;
  beginBatch: () => void;  // takes snapshot once per batch (idempotent after first call)
  clearBatch: () => void;  // call before next user message
  undo: () => void;        // restores snapshot via store.setPages / store.setLayout, clears canUndo
}
```

The hook calls `useFormBuilderStore()` internally to read and restore state. `beginBatch` is idempotent — only snapshots on the first call per batch. `clearBatch` resets the snapshot ref so the next AI response starts a fresh batch.

### 4. Updated hook: `apps/form-app/src/hooks/useAIChat.ts`

Remove:
- `useSubscription(AI_CHAT_STREAM, ...)`
- `currentFormStateRef`
- `applyOperationToStore` (moves to `applyAIOp`)
- `buildOperationLabel` (deduped — one copy in `AIEditDrawer`)
- `sendUserMessageMutation`

Wire in:
```typescript
const undoStack = useUndoStack();

const stream = useAIStream(organizationId, {
  onTextDelta: (delta) => setStreamingMessage(prev => ...),
  onOperation: (op) => {
    undoStack.beginBatch(store);
    applyAIOp(op, store);
    setStreamingMessage(prev => add chip...);
  },
  onDone: (messageId) => {
    setIsStreaming(false);
    setStreamingMessage(null);
    refetchActiveConversation();
    refetchConversations();
  },
  onError: (error) => {
    setIsStreaming(false);
    setStreamingMessage(null);
    toastError('AI Error', error);
  },
});

const sendMessage = useCallback(async (content: string) => {
  if (!activeConversationId || stream.isStreaming) return;
  undoStack.clearBatch();
  setStreamingMessage({ id: 'streaming', role: 'assistant', content: '', streamingText: '', streamingOps: [], isStreaming: true, createdAt: new Date().toISOString() });
  setIsStreaming(true);
  const currentPageId = store.pages[0]?.id; // TODO: use selectedPageId from store when available
  await stream.sendMessage(activeConversationId, content, currentPageId);
}, [...]);
```

Export `undoStack.canUndo` and `undoStack.undo` so the drawer can show the undo button.

### 5. Updated component: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- Add undo button in header (visible when `canUndo`): `↩ Undo AI changes`
- Remove `getFormState()` callback (no longer sent to backend)
- Pass `currentPageId` to `sendMessage` (from `store.pages[0]?.id` or selected page)
- Remove duplicated `buildOpLabel` — keep one copy here, remove from `useAIChat.ts`
- `AssistantBubble` unchanged in structure

### 6. Updated GraphQL ops: `apps/form-app/src/graphql/aiChat.ts`

Remove:
- `SEND_AI_CHAT_USER_MESSAGE`
- `AI_CHAT_STREAM`

Keep: `LIST_AI_CHAT_CONVERSATIONS`, `GET_AI_CHAT_CONVERSATION`, `CREATE_AI_CHAT_CONVERSATION`, `DELETE_AI_CHAT_CONVERSATION`, `RENAME_AI_CHAT_CONVERSATION`

---

## Data Flow (end to end)

```
User types → handleSend()
  → undoStack.clearBatch()
  → setStreamingMessage (optimistic bubble)
  → setIsStreaming(true)
  → stream.sendMessage(conversationId, content, currentPageId)
      → fetch POST /api/ai/chat
          → auth check
          → saveUserMessage() → DB
          → buildChatStream() → streamText with tools
              → AI calls listFields() → reads Form.formSchema from Prisma
              → AI calls getField() → reads Form.formSchema from Prisma
              → AI calls addField() → returns ADD_FIELD op
          → streams NDJSON chunks
      → reader loop:
          "text" → onTextDelta → update streaming bubble
          "operation" → beginBatch (snapshot) → applyAIOp(op, store) → add chip to bubble
          "done" → onDone → refetch conversation from GraphQL → finalize
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Token budget exceeded | Server writes `{"type":"error","error":"...token limit..."}`, frontend shows `toastError` |
| Network / fetch error | `catch` in `useAIStream`, calls `onError('Stream failed. Please try again.')` |
| `AbortError` (user cancels) | Silently ignored — no toast |
| Auth failure | Server returns non-2xx; frontend reads `{ error }` from response body, calls `onError` |
| Malformed NDJSON line | Silently skipped in reader loop |
| AI tool error | AI SDK catches internally; AI responds with text-only; `done` fires normally |

---

## Testing

### Backend
- `routes/aiChat.test.ts` — integration test: mock `aiChatService`, verify NDJSON chunks in response body
- `lib/aiFormEditTools.test.ts` — unit test: mock Prisma, verify `listFields` returns correct structure for multi-page form; `getField` returns full details
- Existing `aiChat.test.ts` resolver tests — remove `Subscription` tests, remove `sendAIChatUserMessage` test

### Frontend
- `lib/applyAIOp.test.ts` — unit test: each op type against a mock store; verify `ADD_FIELD` position, `UPDATE_LAYOUT` key stripping, `REORDER_FIELDS` ordering
- `hooks/useUndoStack.test.ts` — snapshot taken once per batch, `undo` restores, `clearBatch` resets
- `hooks/useAIStream.test.ts` — mock `fetch`, verify NDJSON parsing and callback routing

---

## Files Changed

### New
- `apps/backend/src/routes/aiChat.ts`
- `apps/form-app/src/hooks/useAIStream.ts`
- `apps/form-app/src/hooks/useUndoStack.ts`
- `apps/form-app/src/lib/applyAIOp.ts`

### Modified
- `apps/backend/src/lib/aiFormEditTools.ts` — rewrite as factory
- `apps/backend/src/services/aiChatService.ts` — remove WS stream, add `buildChatStream`
- `apps/backend/src/graphql/resolvers/aiChat.ts` — remove Subscription + sendAIChatUserMessage
- `apps/backend/src/graphql/schema.ts` — remove Subscription, AIChatChunk, sendAIChatUserMessage
- `apps/backend/src/index.ts` — register `/api/ai/chat` route
- `apps/form-app/src/hooks/useAIChat.ts` — remove subscription + WS logic, wire useAIStream + useUndoStack
- `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` — add undo button, remove getFormState
- `apps/form-app/src/graphql/aiChat.ts` — remove SEND_AI_CHAT_USER_MESSAGE + AI_CHAT_STREAM

### Deleted (nothing)
No files deleted — only content removed from existing files.

---

## Out of Scope

- Changing the conversation CRUD (stays GraphQL, unchanged)
- Replacing Apollo Client for non-AI queries
- `generateFormWithAI` one-shot feature (separate, untouched)
- Multi-page page-picker in the drawer (defer — currentPageId defaults to pages[0] for now)
