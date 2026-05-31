# AI SDK Full Migration Design

**Date:** 2026-05-31  
**Status:** Approved  
**Scope:** Replace custom NDJSON streaming infrastructure with the Vercel AI SDK's native patterns end-to-end — `ToolLoopAgent`, `toUIMessageStreamResponse`, `useChat`, typed tool part rendering, UIMessage DB storage.

---

## 1. Motivation

The current form builder AI chat has three structural problems:

1. **Custom NDJSON streaming** — `useAIStream.ts` (87 lines) manually buffers, splits, and parses newline-delimited JSON. The AI SDK provides this out of the box via `toUIMessageStreamResponse` + `useChat`.
2. **Tool calls are opaque** — tool invocations show as static status strings ("Reading form structure…"). The SDK's typed `tool-{toolName}` message parts expose live state (`input-streaming` → `input-available` → `output-available`) enabling rich per-tool UI.
3. **Y.js schema fetched per tool call** — each of the 11 tools calls `getFormSchemaFromYjs` independently within a single LLM turn. The schema should be read once and injected into the agent at request time.

---

## 2. Architecture Overview

```
User types
  → useChat (DefaultChatTransport)
  → POST /api/ai/chat { message: UIMessage, conversationId, orgId, currentPageId }
  → checkTokenBudget
  → loadConversationMessages (DB → UIMessage[])
  → validateUIMessages
  → getFormSchemaFromYjs (once per request)
  → createFormEditAgent(formId, schema)   ← ToolLoopAgent
  → agent.stream(convertToModelMessages(messages))
  → toUIMessageStreamResponse(onFinish: saveMessages + recordTokenUsage)
  → Readable.fromWeb(stream).pipe(res)    ← Express bridge
  → useChat parses UI message stream
  → message.parts update live (text + tool-{name} parts)
  → useEffect detects output-available mutation parts
  → applyAIOp(part.output, store)
  → Y.js store → form canvas updates
```

---

## 3. Backend Changes

### 3.1 New file: `apps/backend/src/lib/formEditAgent.ts`

Defines the `ToolLoopAgent` and exports the `InferAgentUIMessage` type.

```typescript
import { ToolLoopAgent, InferAgentUIMessage, stepCountIs } from 'ai';
import { getPrimaryModel } from './ai.js';
import { createFormEditTools } from './aiFormEditTools.js';

export function createFormEditAgent(formId: string, schema: { pages: any[] }) {
  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(8),
    tools: createFormEditTools(schema),
  });
}

// Static prototype used only for type inference
const _proto = createFormEditAgent('__type__', { pages: [] });
export type FormEditAgentUIMessage = InferAgentUIMessage<typeof _proto>;
```

### 3.2 `apps/backend/src/lib/aiFormEditTools.ts`

**Change:** `createFormEditTools(formId: string)` → `createFormEditTools(schema: { pages: any[] })`.

Remove `getFormSchemaFromYjs` calls from every tool. The schema is now passed in as a closure. Each tool reads from the in-memory `schema` parameter. `getFormSchemaFromYjs` moves to the route layer.

The `removePage` tool still validates `schema.pages.length <= 1` using the passed-in schema.

### 3.3 `apps/backend/src/services/aiChatService.ts`

**Remove:** `buildChatStream`, `saveUserMessage`, `saveAssistantMessage`.

**Add:**

```typescript
// Load full conversation as UIMessage[]
export async function loadConversationMessages(
  conversationId: string,
  userId: string
): Promise<UIMessage[]>

// Save all messages after a turn (called from onFinish)
export async function saveConversationMessages(
  conversationId: string,
  messages: UIMessage[],
  tokensUsed: number
): Promise<void>
```

`saveConversationMessages` upserts each `UIMessage` into `AIChatMessage`: stores `data` (full JSON), extracts `role` and `content` (from the text part) for queryable columns, and writes `tokensUsed` to the final assistant message.

`autoGenerateTitle` stays unchanged — still fires on `messageCount <= 1` using the user message text.

### 3.4 `apps/backend/src/routes/aiChat.ts`

**Request body changes:**

```typescript
// Old
{ conversationId, organizationId, content, currentPageId }

// New
{ message: UIMessage, conversationId, organizationId, currentPageId }
```

**Handler logic:**

```typescript
// 1. Auth + org membership checks (unchanged)
// 2. Check token budget (unchanged)
// 3. Verify conversation ownership
const conv = await getConversation(conversationId, auth.user!.id);
if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return; }

// 4. Load history + append incoming message
const previous = await loadConversationMessages(conversationId, auth.user!.id);
const allMessages = [...previous, message];
const validated = await validateUIMessages({ messages: allMessages, tools: agentTools });

// 5. Auto-title on first message (fire-and-forget)
if (previous.length === 0) autoGenerateTitle(conversationId, message.content);

// 6. Read Y.js schema once
const schema = await getFormSchemaFromYjs(conv.formId) ?? { pages: [] };
const systemPrompt = buildSystemPrompt(currentPageId, schema);

// 7. Create agent + stream
const agent = createFormEditAgent(conv.formId, schema);
const result = agent.stream(convertToModelMessages(validated), { system: systemPrompt });

// 8. Consume stream (disconnect resilience — ensures onFinish fires even if client disconnects)
result.consumeStream(); // no await

// 9. Return UI message stream — onFinish handles all DB persistence
const webResponse = result.toUIMessageStreamResponse({
  originalMessages: validated,
  onFinish: async ({ messages: finalMessages, usage }) => {
    await saveConversationMessages(conversationId, finalMessages, usage.totalTokens);
    await recordAITokenUsage(organizationId, usage.totalTokens);
  },
});

// 10. Express bridge
res.status(webResponse.status);
for (const [k, v] of webResponse.headers.entries()) res.setHeader(k, v);
const { Readable } = await import('stream');
Readable.fromWeb(webResponse.body!).pipe(res);
```

The entire manual `for await` loop, `write()` helper, and `TOOL_STATUS_MAP` are deleted.

### 3.5 `buildSystemPrompt` helper

Moved out of `aiChatService.ts` into a dedicated `buildSystemPrompt(currentPageId, schema)` function in the route file. The form schema snapshot is injected as JSON so the agent can act in a single step for simple mutations without always calling `listFields` first.

```typescript
function buildSystemPrompt(currentPageId: string | undefined, schema: { pages: any[] }): string {
  const pageContext = currentPageId
    ? `The user is currently viewing page ID: ${currentPageId}.`
    : 'The user is on the first page.';

  const schemaContext = schema.pages.length > 0
    ? `\nCurrent form structure (use this before calling listFields for simple edits):\n${JSON.stringify(schema, null, 2)}`
    : '';

  return `You are an AI assistant that helps users edit their multi-page form.
${pageContext}
- Call listFields only when the schema below is insufficient or the user asks about all fields.
- Use getField to read a field's full details before updating it.
- Make only the changes the user requests. Confirm what you did in your final text response.
- You can add/remove pages. Never call removePage when there is only one page.
${schemaContext}`;
}
```

---

## 4. Database Migration

### 4.1 `AIChatMessage` — add `data` column, drop `operations`

```prisma
model AIChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String
  content        String   // text content for queries / auto-title
  data           Json     // full UIMessage object
  tokensUsed     Int      @default(0)
  createdAt      DateTime @default(now())
  conversation   AIChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  // operations column removed — embedded in data.parts
}
```

**Migration steps:**

1. Add `data Json?` (nullable)
2. Backfill: `UPDATE "AIChatMessage" SET data = jsonb_build_object('id', id, 'role', role, 'content', content, 'parts', jsonb_build_array(jsonb_build_object('type', 'text', 'text', content)))`
3. Make `data` non-nullable
4. Drop `operations` column

### 4.2 `AIUsage` — add composite unique index

```prisma
model AIUsage {
  id             String   @id @default(cuid())
  organizationId String
  periodStart    DateTime
  periodEnd      DateTime
  tokensUsed     Int      @default(0)
  organization   Organization @relation(...)
  @@unique([organizationId, periodStart])  // NEW
}
```

This enables the single-upsert in `recordAITokenUsage`:

```typescript
await prisma.aIUsage.upsert({
  where: { organizationId_periodStart: { organizationId, periodStart: start } },
  update: { tokensUsed: { increment: tokensUsed } },
  create: { organizationId, tokensUsed, periodStart: start, periodEnd: end },
});
```

---

## 5. Frontend Changes

### 5.1 Package

Add `@ai-sdk/react` to `apps/form-app/package.json`. Delete `apps/form-app/src/hooks/useAIStream.ts`.

### 5.2 `useAIChat.ts` rewrite

**Type definition in form-app (not imported from backend):**

`FormEditAgentUIMessage` is defined locally in `apps/form-app/src/lib/aiAgentTypes.ts` by mirroring the tool output schemas without any backend dependency:

```typescript
// apps/form-app/src/lib/aiAgentTypes.ts
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
// Mirror tool schemas (input/output only — no execute functions, no DB access)
// ... tool definitions matching aiFormEditTools.ts schemas ...
const _protoAgent = new ToolLoopAgent({ model: null as any, tools: mirroredTools });
export type FormEditAgentUIMessage = InferAgentUIMessage<typeof _protoAgent>;
```

This file is the frontend's source of truth for tool part types. If tool schemas change on the backend, this file must be updated in the same PR.

```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { FormEditAgentUIMessage } from '../lib/aiAgentTypes';

const { messages, sendMessage, status, stop } = useChat<FormEditAgentUIMessage>({
  transport: new DefaultChatTransport({
    api: `${API_URL}/api/ai/chat`,
    credentials: 'include',
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        message: messages[messages.length - 1],
        conversationId,
        organizationId,
        currentPageId: store.selectedPageId ?? store.pages[0]?.id,
      },
    }),
  }),
  messages: initialMessages, // UIMessage[] — see initialMessages derivation below
  onError: (error) => {
    const isLimit = error.message.includes('token limit');
    toastError('AI Error', isLimit ? error.message : 'AI processing failed. Please try again.');
  },
});
```

**`applyAIOp` integration** — useEffect watching messages for new mutation tool outputs:

```typescript
const appliedToolCallIds = useRef(new Set<string>());

useEffect(() => {
  const last = messages[messages.length - 1];
  if (last?.role !== 'assistant') return;
  for (const part of last.parts) {
    if (
      MUTATION_TOOL_NAMES.has(part.type.replace('tool-', '')) &&
      part.state === 'output-available' &&
      !appliedToolCallIds.current.has(part.toolCallId)
    ) {
      appliedToolCallIds.current.add(part.toolCallId);
      applyAIOp(part.output, store);
    }
  }
}, [messages]);
```

**State simplification:**

| Old | New |
|-----|-----|
| `isStreaming` state | `status !== 'ready'` |
| `streamingMessage` state | last message with `parts` |
| `statusText` state | `status === 'submitted'` or `input-streaming` tool part |
| `cancel()` | `stop()` from `useChat` |
| `streamSend()` | `sendMessage({ text })` |

**`initialMessages` derivation:** The Apollo `GET_AI_CHAT_CONVERSATION` query returns `AIChatMessage[]` rows, each with a `data` JSON column containing the stored `UIMessage`. The conversion is:

```typescript
const initialMessages: FormEditAgentUIMessage[] =
  (activeConvData?.getAIChatConversation?.messages ?? []).map(
    (m: { data: unknown }) => m.data as FormEditAgentUIMessage
  );
```

The `GET_AI_CHAT_CONVERSATION` GraphQL query must be updated to include `data` in its selection set.

**`MUTATION_TOOL_NAMES` set** — explicit definition:

```typescript
const MUTATION_TOOL_NAMES = new Set([
  'addField', 'updateField', 'removeField', 'reorderFields',
  'updateLayout', 'renamePage', 'reorderPages', 'addPage', 'removePage',
]);
```

Apollo queries for `LIST_AI_CHAT_CONVERSATIONS` / `CREATE` / `DELETE` / `RENAME` stay unchanged.

### 5.3 `AIEditDrawer.tsx` — message rendering

Replace `UserBubble` / `AssistantBubble` stream state logic with `message.parts`-based rendering:

```typescript
function AssistantMessage({ message }: { message: FormEditAgentUIMessage }) {
  return (
    <div className="space-y-1.5">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return <TextBubble key={i} text={part.text} />;
          case 'tool-listFields':
            return <ListFieldsToolPart key={i} part={part} />;
          case 'tool-getField':
            return <GetFieldToolPart key={i} part={part} />;
          case 'tool-addField':
          case 'tool-updateField':
          case 'tool-removeField':
          case 'tool-reorderFields':
          case 'tool-updateLayout':
          case 'tool-renamePage':
          case 'tool-reorderPages':
          case 'tool-addPage':
          case 'tool-removePage':
            return <MutationToolPart key={i} part={part} />;
        }
      })}
    </div>
  );
}
```

### 5.4 New tool part components

**`ListFieldsToolPart`** — shows page/field count while streaming, collapses to "Scanned N pages" when done.

**`GetFieldToolPart`** — shows field ID while `input-available`, collapses to "Read field details" when done.

**`MutationToolPart`** — unified component for all 9 mutation tools:
- `input-streaming`: pulsing dot + tool name
- `input-available`: spinner + action label (e.g. "Adding field…")
- `output-available`: green chip with result label (e.g. `Added "Email Address"`)

Label mapping per tool:
```
addField      → Added "{label}"
updateField   → Updated field
removeField   → Removed field
reorderFields → Reordered fields
updateLayout  → Updated layout
renamePage    → Renamed page "{newTitle}"
reorderPages  → Reordered pages
addPage       → Added page "{title}"
removePage    → Removed page
```

**`StatusIndicator`** replacement: show when `status === 'submitted'` (request sent, no parts yet) — same three bouncing dots as today.

---

## 6. Files Changed Summary

**Deleted:**
- `apps/form-app/src/hooks/useAIStream.ts`

**New:**
- `apps/backend/src/lib/formEditAgent.ts`
- `apps/form-app/src/components/form-builder/tool-parts/ListFieldsToolPart.tsx`
- `apps/form-app/src/components/form-builder/tool-parts/GetFieldToolPart.tsx`
- `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx`

**New (frontend):**
- `apps/form-app/src/lib/aiAgentTypes.ts` — `FormEditAgentUIMessage` type definition

**Modified:**
- `apps/backend/src/lib/aiFormEditTools.ts` — accept schema arg, remove per-tool DB reads
- `apps/backend/src/services/aiChatService.ts` — replace save/build functions with UIMessage-based API
- `apps/backend/src/services/aiUsageService.ts` — single-upsert via composite unique key
- `apps/backend/src/routes/aiChat.ts` — full rewrite of handler, delete NDJSON loop
- `apps/backend/prisma/schema.prisma` — add `data`, drop `operations`, add AIUsage unique
- `apps/backend/src/graphql/schema.ts` — add `data` field to `AIChatMessage` type
- `apps/form-app/src/graphql/aiChat.ts` — add `data` to `GET_AI_CHAT_CONVERSATION` query
- `apps/form-app/src/hooks/useAIChat.ts` — replace with useChat-based implementation
- `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` — parts-based rendering

---

## 7. Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Token budget exceeded | Backend writes error before stream starts; `useChat` `onError` fires → `toastError` |
| Conversation not found | 404 before stream starts; `useChat` `status === 'error'` |
| Client disconnect mid-stream | `consumeStream()` ensures `onFinish` fires; messages saved |
| DB messages fail `validateUIMessages` | Fall back to empty history; no crash |
| Agent exceeds 8 steps | `stepCountIs(8)` stops loop; partial result streamed and saved |

---

## 8. Testing

- **`aiFormEditTools.test.ts`** — pass schema directly as arg; remove Y.js mock setup
- **`aiChatService.test.ts`** — test `saveConversationMessages` / `loadConversationMessages` with UIMessage fixtures
- **`aiChat.test.ts`** (route) — mock `agent.stream()` returning minimal UIMessage stream; assert `saveConversationMessages` called in `onFinish`
- **Frontend `useAIChat`** — mock `useChat` from `@ai-sdk/react`; assert `applyAIOp` called when mutation tool part reaches `output-available`
