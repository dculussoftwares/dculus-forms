# AI Chat-Based Form Editor — Design Spec

**Date**: 2026-05-27  
**Status**: Approved for implementation  
**Feature**: Persistent, multi-conversation AI chat panel in the form builder for editing and improving existing forms using natural language.

---

## 1. Overview

Users can open a slide-out AI chat drawer in the form builder and type natural-language instructions to edit their form in real time:

> "Make all fields required"  
> "Add a phone number field after email"  
> "Rewrite these labels to be more professional"  
> "Remove duplicates and reorder by importance"

The AI understands the current form state, executes **tool calls** (addField, updateField, removeField, reorderFields, updateLayout), and streams each change into the builder instantly. Conversations are persisted per-user in the database, supporting multiple named sessions per form.

---

## 2. Reference Implementations

These open-source projects use the same infra combination we're adopting:

| Project | Pattern | Relevance |
|---|---|---|
| **[Linear](https://linear.app)** | Apollo Server + graphql-ws subscriptions for real-time issue/project sync | Production proof of Apollo 4 + graphql-ws at scale |
| **[graphql-yoga](https://github.com/dotansimha/graphql-yoga)** (The Guild) | Async generator subscriptions + Vercel AI SDK streaming examples in the repo | Exact pattern: `streamText fullStream` → async generator → subscription |
| **[Pothos GraphQL](https://pothos-graphql.dev)** | Schema-first with subscription builders | Shows how to type async generator subscriptions cleanly |
| **[Redwood JS](https://redwoodjs.com)** | Apollo Client + graphql-ws split link in full-stack apps | Shows the `split` link pattern for HTTP vs WS routing in production |

The graphql-yoga team has explicitly demonstrated piping Vercel AI SDK `fullStream` into a GraphQL subscription using async generators — which is the exact backend pattern used here.

---

## 3. Transport Decision: graphql-ws

**Chosen: graphql-ws over SSE.**

### Why not SSE

The Vercel AI SDK's `useChat` hook is SSE-only and manages its own internal message state. For persistent DB-backed conversations (load history, continue sessions), this creates dual state: `useChat` internal state + Apollo cache. Every conversation load, reload, and tab switch requires state reconciliation between two sources of truth.

### Why graphql-ws

| SOLID Principle | How graphql-ws satisfies it |
|---|---|
| **DIP** | Frontend depends on GraphQL schema (abstraction), not URL strings |
| **OCP** | New real-time features = new `Subscription` field. No new routes, no new infrastructure |
| **SRP** | Single transport owns all real-time concerns |
| **ISP** | Clients subscribe to exactly the fields they need |

Additional:
- **Single data client**: Apollo handles all data — queries, mutations, subscriptions — consistent patterns everywhere
- **Async generator = SDK AsyncIterable**: `streamText.fullStream` maps directly to GraphQL async generators. No PubSub, no Redis, no fan-out
- **Future-proof**: graphql-ws unlocks `formResponseCreated`, `pluginDeliveryUpdated`, live analytics — zero new infra cost
- **Clean cancellation**: Unsubscribing tears down the async generator and the upstream AI call
- **Hocuspocus isolation**: Hocuspocus stays at `/collaboration`, graphql-ws goes at `/graphql` — clean path separation on the same `httpServer`

### How the AI SDK maps to graphql-ws

```
Vercel AI SDK          graphql-ws subscription
─────────────          ──────────────────────────
streamText()           subscribe: async function*
fullStream             for await (const part of result.fullStream)
AsyncIterable<Part>    yield { aiChatStream: chunk }
part.type = text-delta → { type: 'text', delta }
part.type = tool-result → { type: 'operation', operation }
part.type = finish      → { type: 'done', messageId }
```

No adapter layer. Direct pipe. One loop.

---

## 4. Data Model

Two new Prisma tables. Conversations are **private per user** (`userId`). Form state is **not stored** — sent fresh with every message to always reflect live edits made outside chat.

```prisma
model AIChatConversation {
  id             String   @id @default(cuid())
  formId         String
  organizationId String
  userId         String
  title          String   @default("New conversation")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  form         Form         @relation(fields: [formId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages     AIChatMessage[]

  @@index([formId, userId])
  @@map("ai_chat_conversation")
}

model AIChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // "user" | "assistant"
  content        String   @db.Text
  operations     Json?    // stored on assistant messages — replay-able
  tokensUsed     Int      @default(0)
  createdAt      DateTime @default(now())

  conversation AIChatConversation @relation(
    fields: [conversationId], references: [id], onDelete: Cascade
  )

  @@index([conversationId])
  @@map("ai_chat_message")
}
```

Back-relations added to `Form`, `Organization`, and `User` models.

---

## 5. GraphQL Schema

Added to the existing schema, following the established naming conventions.

### New types

```graphql
type AIChatConversation {
  id: ID!
  formId: ID!
  title: String!
  messageCount: Int!
  createdAt: String!
  updatedAt: String!
  messages: [AIChatMessage!]!
}

type AIChatMessage {
  id: ID!
  conversationId: ID!
  role: String!           # "user" | "assistant"
  content: String!
  operations: [JSON!]     # null for user messages; list of form operations for assistant
  createdAt: String!
}

type AIChatChunk {
  type: String!           # "text" | "operation" | "done" | "error"
  delta: String           # text-delta content (type = "text")
  operation: JSON         # form operation to apply (type = "operation")
  messageId: String       # persisted message ID (type = "done")
  error: String           # error message (type = "error")
}
```

### Queries

```graphql
listAIChatConversations(formId: ID!, organizationId: ID!): [AIChatConversation!]!
getAIChatConversation(id: ID!, organizationId: ID!): AIChatConversation!
```

### Mutations

```graphql
createAIChatConversation(formId: ID!, organizationId: ID!): AIChatConversation!
deleteAIChatConversation(id: ID!, organizationId: ID!): Boolean!
renameAIChatConversation(id: ID!, organizationId: ID!, title: String!): AIChatConversation!
sendAIChatUserMessage(
  conversationId: ID!
  organizationId: ID!
  content: String!
): AIChatMessage!
```

### Subscription (new `type Subscription`)

```graphql
type Subscription {
  aiChatStream(
    conversationId: ID!
    organizationId: ID!
    currentFormState: JSON!
  ): AIChatChunk!
}
```

**Flow**: Client calls `sendAIChatUserMessage` (saves user message, returns immediately), then opens `aiChatStream` subscription which runs the AI and streams `AIChatChunk` events.

---

## 6. Backend Architecture

### New files

```
apps/backend/src/
  graphql/resolvers/aiChat.ts          # queries, mutations, subscription resolver
  services/aiChatService.ts            # DB access + AI orchestration
  lib/aiFormEditTools.ts               # Vercel AI SDK tool definitions
```

### `lib/aiFormEditTools.ts` — tool definitions

Six tools the AI can call. Each returns a typed operation object that the frontend applies to the Zustand store.

```ts
import { tool } from 'ai';
import { z } from 'zod';

export const formEditTools = {
  inspectForm: tool({
    description: 'Read the current form state to understand field IDs, labels, and structure before making changes',
    parameters: z.object({}),
    execute: async () => ({ note: 'Form state provided in system prompt' }),
  }),

  addField: tool({
    description: 'Add a new field to the form',
    parameters: z.object({
      fieldType: z.enum(['text','textarea','email','number','date','select','radio','checkbox','file']),
      label: z.string(),
      required: z.boolean(),
      placeholder: z.string().nullable(),
      options: z.array(z.string()).nullable(),
      insertAfterFieldId: z.string().nullable(),
    }),
    execute: async (args) => ({ type: 'ADD_FIELD', ...args }),
  }),

  updateField: tool({
    description: 'Update properties of an existing field',
    parameters: z.object({
      fieldId: z.string(),
      updates: z.object({
        label: z.string().optional(),
        required: z.boolean().optional(),
        placeholder: z.string().optional(),
        options: z.array(z.string()).optional(),
      }),
    }),
    execute: async (args) => ({ type: 'UPDATE_FIELD', ...args }),
  }),

  removeField: tool({
    description: 'Remove a field from the form',
    parameters: z.object({ fieldId: z.string() }),
    execute: async (args) => ({ type: 'REMOVE_FIELD', ...args }),
  }),

  reorderFields: tool({
    description: 'Reorder fields on a page',
    parameters: z.object({
      pageId: z.string(),
      fieldIds: z.array(z.string()),
    }),
    execute: async (args) => ({ type: 'REORDER_FIELDS', ...args }),
  }),

  updateLayout: tool({
    description: 'Update the form intro content or CTA button label',
    parameters: z.object({
      content: z.string().optional(),
      customCTAButtonName: z.string().optional(),
    }),
    execute: async (args) => ({ type: 'UPDATE_LAYOUT', ...args }),
  }),
};
```

### `services/aiChatService.ts` — core logic

```
createConversation(formId, organizationId, userId) → AIChatConversation
listConversations(formId, organizationId, userId) → AIChatConversation[]
getConversation(id, userId) → AIChatConversation with messages
deleteConversation(id, userId) → void
renameConversation(id, userId, title) → AIChatConversation

saveUserMessage(conversationId, content) → AIChatMessage

streamAssistantResponse(conversationId, organizationId, currentFormState):
  1. Load conversation + full message history from DB
  2. checkAITokenBudget(organizationId)
  3. Build system prompt with serialized currentFormState
  4. Call streamText({
       model: getPrimaryModel(),
       system: systemPrompt,
       messages: dbHistory,
       tools: formEditTools,
       maxSteps: 5,
     })
  5. Return fullStream AsyncIterable  ← subscription resolver iterates this
  6. onFinish: save assistant message + operations, recordAITokenUsage

autoGenerateTitle(conversationId, firstMessage):
  Uses getFastModel() to create ≤8-word title
  Updates conversation.title in background (non-blocking)
```

### `graphql/resolvers/aiChat.ts` — subscription resolver

```ts
Subscription: {
  aiChatStream: {
    subscribe: async function* (_, { conversationId, organizationId, currentFormState }, context) {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);

      const budget = await checkAITokenBudget(organizationId);
      if (!budget.allowed) {
        yield { aiChatStream: { type: 'error', error: 'AI token limit reached' } };
        return;
      }

      const operations: JSON[] = [];

      try {
        const { fullStream, usage } = await streamAssistantResponse(
          conversationId, organizationId, currentFormState
        );

        for await (const part of fullStream) {
          if (part.type === 'text-delta')
            yield { aiChatStream: { type: 'text', delta: part.textDelta } };

          if (part.type === 'tool-result') {
            const op = part.result;
            operations.push(op);
            yield { aiChatStream: { type: 'operation', operation: op } };
          }

          if (part.type === 'finish') {
            const saved = await saveAssistantMessage(conversationId, fullText, operations, usage.totalTokens);
            await recordAITokenUsage(organizationId, usage.totalTokens);
            yield { aiChatStream: { type: 'done', messageId: saved.id } };
          }
        }
      } catch (err) {
        yield { aiChatStream: { type: 'error', error: 'AI processing failed' } };
      }
    },
    resolve: (payload) => payload.aiChatStream,
  }
}
```

---

## 7. Transport Setup: graphql-ws in `index.ts`

Minimal change — 8 lines alongside the existing Hocuspocus setup:

```ts
import { useServer } from 'graphql-ws/lib/use/ws';

// Existing — untouched
const collabWss = new WebSocketServer({ server: httpServer, path: '/collaboration' });
collabWss.on('connection', (ws, req) => hocuspocusServer.handleConnection(ws, req));

// New — graphql-ws at /graphql path
const gqlWss = new WebSocketServer({ server: httpServer, path: '/graphql' });
useServer({
  schema,
  context: async (ctx) => {
    const token = ctx.connectionParams?.token as string | undefined;
    if (!token) return { auth: { user: null, session: null, isAuthenticated: false } };
    // Reuse better-auth via synthetic headers
    const headers = new Headers({ authorization: `Bearer ${token}` });
    const sessionData = await auth.api.getSession({ headers });
    return {
      auth: {
        user: sessionData?.user ?? null,
        session: sessionData?.session ?? null,
        isAuthenticated: !!sessionData?.user,
      }
    };
  },
}, gqlWss);
```

Two `WebSocketServer` instances, same `httpServer`, different paths. Hocuspocus is completely unaffected.

---

## 8. Apollo Client Update

Add `GraphQLWsLink` with `split` routing. Subscriptions go to WS; all queries and mutations stay on the existing HTTP link chain:

```ts
// apolloClient.ts additions
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';

const wsLink = new GraphQLWsLink(
  createClient({
    url: getGraphQLWsUrl(),          // ws://localhost:4000/graphql
    connectionParams: () => ({
      token: getBearerToken(),       // existing sessionStorage token
    }),
  })
);

const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  errorLink.concat(authLink).concat(httpLink),  // existing chain unchanged
);

export const client = new ApolloClient({
  link: splitLink,   // replaces the old errorLink.concat(...)
  cache: new InMemoryCache(),
  credentials: 'include',
  // ... rest unchanged
});
```

---

## 9. Frontend Architecture

### Component tree

```
CollaborativeFormBuilder
  └── AIEditDrawer (slide-out, 380px, right side)
        ├── DrawerHeader
        │     ├── "AI Assistant" + Sparkles icon
        │     ├── ConversationSelector (dropdown)
        │     │     ├── [list of past conversations with title + timestamp]
        │     │     └── "+ New chat" at top
        │     └── KebabMenu → Rename / Delete
        ├── MessagesList (flex-col, scrollable, newest at bottom)
        │     ├── UserBubble (right-aligned, bg-muted)
        │     └── AssistantBubble (left-aligned)
        │           ├── StreamingText (char-by-char)
        │           └── OperationChips (after each tool-result)
        │                 e.g. "+ Added phone field"  "✎ Made email required"
        ├── TypingIndicator (3-dot animation while subscription active)
        └── ChatInputBar
              ├── Textarea (Enter=send, Shift+Enter=newline)
              └── SendButton (Loader2 while streaming)
```

Toggle: **"AI" button** in `FormBuilderHeader.tsx`. Keyboard: `Cmd+K` / `Ctrl+K`.

### `useAIChat.ts` hook

```ts
// Manages all chat state and Apollo interactions
const {
  conversations,          // list for the selector
  activeConversation,     // currently selected conversation
  messages,               // messages in active conversation
  isStreaming,            // subscription in flight
  streamingText,          // accumulating text delta
  createConversation,
  selectConversation,
  deleteConversation,
  renameConversation,
  sendMessage,            // saves user message + opens subscription
} = useAIChat({ formId, organizationId });
```

### Streaming flow in `sendMessage`

```
1. sendAIChatUserMessage mutation    → saves user msg to DB, returns it
2. addMessage(userMsg) to local state
3. Open aiChatStream subscription with { conversationId, currentFormState }
4. On chunk.type === 'text'      → append delta to streamingText state
5. On chunk.type === 'operation' → apply to Zustand store (200ms stagger)
                                   show OperationChip in AssistantBubble
6. On chunk.type === 'done'      → finalise: move streamingText → permanent message
                                   stop subscription
                                   refetch getAIChatConversation (updates Apollo cache)
7. On chunk.type === 'error'     → toastError, stop subscription
```

### Operation application

```ts
async function applyOperationsStaggered(operations: FormOperation[], store) {
  for (const op of operations) {
    switch (op.type) {
      case 'ADD_FIELD':    store.addField(op.pageId ?? firstPageId, mapType(op.fieldType), buildFieldData(op)); break;
      case 'UPDATE_FIELD': store.updateFieldData(op.fieldId, op.updates); break;
      case 'REMOVE_FIELD': store.removeField(op.fieldId); break;
      case 'REORDER_FIELDS': store.reorderFields(op.pageId, op.fieldIds); break;
      case 'UPDATE_LAYOUT':  store.updateLayout(op); break;
    }
    await delay(200);  // visible stagger
  }
}
```

---

## 10. Infrastructure Delta

| | Needed | Notes |
|---|---|---|
| **New packages** | `graphql-ws` (backend) | Frontend: `graphql-ws` already pulled in via `@apollo/client` peer deps |
| **New env var** | `VITE_GRAPHQL_WS_URL` | `ws://localhost:4000/graphql` in dev |
| **DB migration** | 1 Prisma migration | 2 new tables: `ai_chat_conversation`, `ai_chat_message` |
| **index.ts** | +8 lines | Second `WebSocketServer` at `/graphql` |
| **apolloClient.ts** | +15 lines | `GraphQLWsLink` + `split` |
| **New backend files** | 3 files | `aiChat.ts` resolver, `aiChatService.ts`, `aiFormEditTools.ts` |
| **New frontend files** | 2 files | `AIEditDrawer.tsx`, `useAIChat.ts` hook |

No new servers. No Redis. No PubSub. No deployment changes.

---

## 11. Token Tracking

Reuses the existing `checkAITokenBudget` / `recordAITokenUsage` / `AIUsage` table exactly as-is. Token counting happens in the subscription resolver's `finish` handler after the full stream completes.

---

## 12. Key Flows

### First message in a new conversation
1. User clicks "AI" button → drawer opens → `createAIChatConversation` mutation
2. User types → `sendAIChatUserMessage` saves to DB
3. Subscription `aiChatStream` opens → AI streams
4. Operations apply to builder with stagger
5. `done` event → message saved → `autoGenerateTitle` runs in background

### Returning to a past conversation
1. Drawer opens → `listAIChatConversations` loads selector
2. User picks conversation → `getAIChatConversation` loads full history into Apollo cache
3. All past messages display immediately
4. User continues — new message appends to history

### Multi-step AI edit (maxSteps: 5)
```
User: "Make all fields required and sort alphabetically"
AI step 1: inspectForm() → sees 6 fields, their IDs and labels
AI step 2: updateField(x6) → 6 UPDATE_FIELD operations streamed
AI step 3: reorderFields() → 1 REORDER_FIELDS operation streamed
Text: "Done — made all 6 fields required and sorted them A–Z."
```
All handled by the single async generator loop. No polling.

---

## 13. VITE_GRAPHQL_WS_URL

Add to each frontend app's `.env.example`:
```
VITE_GRAPHQL_WS_URL=ws://localhost:4000/graphql
```
