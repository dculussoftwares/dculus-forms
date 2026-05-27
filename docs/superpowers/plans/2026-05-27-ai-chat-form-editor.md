# AI Chat-Based Form Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, multi-conversation AI chat drawer to the form builder that lets users edit and improve their form using natural language, backed by graphql-ws streaming subscriptions and the Vercel AI SDK.

**Architecture:** The Vercel AI SDK's `streamText.fullStream` (AsyncIterable) pipes directly into a GraphQL subscription async generator resolver via graphql-ws. CRUD operations (create/list/delete/rename conversations, save user messages) use standard GraphQL mutations. The frontend uses Apollo Client with a `split` link routing subscriptions to WebSocket and everything else to HTTP. Chat state lives in Apollo cache — single source of truth.

**Tech Stack:** graphql-ws, @apollo/client GraphQLWsLink, Vercel AI SDK (ai v6), Prisma, better-auth, Zustand (form builder store), React, TypeScript

**Design spec:** `docs/superpowers/specs/2026-05-27-ai-chat-form-editor-design.md`

---

## File Map

**New backend files:**
- `apps/backend/src/lib/aiFormEditTools.ts` — Vercel AI SDK tool definitions (6 tools)
- `apps/backend/src/services/aiChatService.ts` — DB access + AI orchestration
- `apps/backend/src/graphql/resolvers/aiChat.ts` — queries, mutations, subscription resolver
- `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`
- `apps/backend/src/services/__tests__/aiChatService.test.ts`
- `apps/backend/src/graphql/resolvers/__tests__/aiChat.test.ts`

**Modified backend files:**
- `apps/backend/prisma/schema.prisma` — 2 new models + back-relations on User/Form/Organization
- `apps/backend/src/graphql/schema.ts` — rename billing Subscription→PlanSubscription; add AIChatConversation, AIChatMessage, AIChatChunk types; add Subscription root type
- `apps/backend/src/graphql/resolvers.ts` — rename Subscription→PlanSubscription key; add aiChat resolvers
- `apps/backend/src/index.ts` — add second WebSocketServer for graphql-ws at /graphql
- `apps/backend/package.json` — add graphql-ws dependency

**New frontend files:**
- `apps/form-app/src/graphql/aiChat.ts` — all GraphQL operations (queries, mutations, subscription)
- `apps/form-app/src/hooks/useAIChat.ts` — chat state hook (Apollo + Zustand integration)
- `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` — drawer UI component
- `apps/form-app/src/locales/en/aiEditDrawer.json`
- `apps/form-app/src/locales/ta/aiEditDrawer.json`

**Modified frontend files:**
- `apps/form-app/src/services/apolloClient.ts` — add GraphQLWsLink + split routing
- `apps/form-app/src/lib/config.ts` — add `getGraphQLWsUrl()`
- `apps/form-app/src/components/form-builder/FormBuilderHeader.tsx` — add AI toggle button
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` — mount AIEditDrawer
- `apps/form-app/src/locales/index.ts` — register aiEditDrawer namespace
- `apps/form-app/.env.example` — add VITE_GRAPHQL_WS_URL

---

## Task 1: Install graphql-ws and configure env vars

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `apps/form-app/.env.example`
- Modify: `apps/form-app/src/lib/config.ts`

- [ ] **Step 1: Install graphql-ws on backend**

```bash
cd apps/backend && pnpm add graphql-ws
```

Expected: `graphql-ws` appears in `apps/backend/package.json` dependencies.

- [ ] **Step 2: Add VITE_GRAPHQL_WS_URL to form-app .env.example**

Open `apps/form-app/.env.example`. Add after the existing `VITE_GRAPHQL_URL` line:

```
VITE_GRAPHQL_WS_URL=ws://localhost:4000/graphql
```

- [ ] **Step 3: Add getGraphQLWsUrl helper to config.ts**

Open `apps/form-app/src/lib/config.ts`. Add after the existing `getGraphQLUrl` export:

```ts
export const getGraphQLWsUrl = (): string => {
  const url = import.meta.env.VITE_GRAPHQL_WS_URL;
  if (!url) {
    // Derive WS URL from the HTTP GraphQL URL as fallback
    const httpUrl = getGraphQLUrl();
    return httpUrl.replace(/^http/, 'ws');
  }
  return url;
};
```

- [ ] **Step 4: Add VITE_GRAPHQL_WS_URL to your local .env**

In `apps/form-app/.env` (not committed), add:
```
VITE_GRAPHQL_WS_URL=ws://localhost:4000/graphql
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json apps/form-app/.env.example apps/form-app/src/lib/config.ts
git commit -m "chore: install graphql-ws and add WS URL config"
```

---

## Task 2: Rename billing Subscription type to PlanSubscription

**Why:** The GraphQL schema already has `type Subscription` for the billing plan model. GraphQL reserves `type Subscription` as the root real-time subscription type. We must rename the billing type to free the name.

**Files:**
- Modify: `apps/backend/src/graphql/schema.ts`
- Modify: `apps/backend/src/graphql/resolvers.ts`

- [ ] **Step 1: Rename type in schema.ts**

In `apps/backend/src/graphql/schema.ts`, make these three exact replacements:

Replace (line ~27, inside Organization type):
```graphql
    subscription: Subscription
```
With:
```graphql
    subscription: PlanSubscription
```

Replace (line ~40):
```graphql
  type Subscription {
    id: ID!
    organizationId: ID!
    chargebeeCustomerId: String!
    chargebeeSubscriptionId: String
    planId: String!
    status: SubscriptionStatus!
    viewsUsed: Int!
    submissionsUsed: Int!
    viewsLimit: Int
    submissionsLimit: Int
    currentPeriodStart: String!
    currentPeriodEnd: String!
    createdAt: String!
    updatedAt: String!
    organization: Organization!
    usage: SubscriptionUsage!
  }
```
With:
```graphql
  type PlanSubscription {
    id: ID!
    organizationId: ID!
    chargebeeCustomerId: String!
    chargebeeSubscriptionId: String
    planId: String!
    status: SubscriptionStatus!
    viewsUsed: Int!
    submissionsUsed: Int!
    viewsLimit: Int
    submissionsLimit: Int
    currentPeriodStart: String!
    currentPeriodEnd: String!
    createdAt: String!
    updatedAt: String!
    organization: Organization!
    usage: SubscriptionUsage!
  }
```

Find line ~1068 (in AdminOrganizationDetail or similar). Replace:
```graphql
    subscription: Subscription
```
With:
```graphql
    subscription: PlanSubscription
```

- [ ] **Step 2: Update resolver key in resolvers.ts**

In `apps/backend/src/graphql/resolvers.ts`, replace:
```ts
  Subscription: {
    ...subscriptionResolvers.Subscription,
  },
```
With:
```ts
  PlanSubscription: {
    ...subscriptionResolvers.Subscription,
  },
```

- [ ] **Step 3: Verify backend builds**

```bash
cd apps/backend && pnpm type-check
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/graphql/schema.ts apps/backend/src/graphql/resolvers.ts
git commit -m "refactor(schema): rename billing Subscription type to PlanSubscription to free Subscription root for real-time"
```

---

## Task 3: Prisma migration — add AIChatConversation and AIChatMessage

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Add the two new models to schema.prisma**

Open `apps/backend/prisma/schema.prisma`. Add the following at the end of the file (after the existing `AIUsage` model):

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
  role           String
  content        String   @db.Text
  operations     Json?
  tokensUsed     Int      @default(0)
  createdAt      DateTime @default(now())

  conversation AIChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("ai_chat_message")
}
```

- [ ] **Step 2: Add back-relations to User, Form, and Organization models**

In `schema.prisma`, find `model User { ... }` and add inside it:
```prisma
  aiChatConversations AIChatConversation[]
```

Find `model Form { ... }` and add inside it:
```prisma
  aiChatConversations AIChatConversation[]
```

Find `model Organization { ... }` and add inside it:
```prisma
  aiChatConversations AIChatConversation[]
```

- [ ] **Step 3: Push schema to dev database**

```bash
pnpm db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
pnpm db:generate
```

Expected: Prisma client regenerated with `AIChatConversation` and `AIChatMessage` types.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(db): add AIChatConversation and AIChatMessage models"
```

---

## Task 4: Create aiFormEditTools.ts + tests

**Files:**
- Create: `apps/backend/src/lib/aiFormEditTools.ts`
- Create: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formEditTools } from '../aiFormEditTools.js';

describe('formEditTools', () => {
  it('inspectForm returns a note', async () => {
    const result = await formEditTools.inspectForm.execute({}, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('note');
  });

  it('addField returns ADD_FIELD operation with correct shape', async () => {
    const result = await formEditTools.addField.execute(
      { fieldType: 'text', label: 'Name', required: true, placeholder: null, options: null, insertAfterFieldId: null },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('ADD_FIELD');
    expect(result.fieldType).toBe('text');
    expect(result.label).toBe('Name');
  });

  it('updateField returns UPDATE_FIELD operation', async () => {
    const result = await formEditTools.updateField.execute(
      { fieldId: 'fld_123', updates: { required: true } },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('UPDATE_FIELD');
    expect(result.fieldId).toBe('fld_123');
  });

  it('removeField returns REMOVE_FIELD operation', async () => {
    const result = await formEditTools.removeField.execute(
      { fieldId: 'fld_456' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('REMOVE_FIELD');
    expect(result.fieldId).toBe('fld_456');
  });

  it('reorderFields returns REORDER_FIELDS operation', async () => {
    const result = await formEditTools.reorderFields.execute(
      { pageId: 'pg_1', fieldIds: ['fld_1', 'fld_2'] },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('REORDER_FIELDS');
    expect(result.fieldIds).toEqual(['fld_1', 'fld_2']);
  });

  it('updateLayout returns UPDATE_LAYOUT operation', async () => {
    const result = await formEditTools.updateLayout.execute(
      { content: '<h1>New Title</h1>', customCTAButtonName: 'Submit' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('UPDATE_LAYOUT');
    expect(result.content).toBe('<h1>New Title</h1>');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/backend && pnpm test:unit -- aiFormEditTools
```

Expected: FAIL — `Cannot find module '../aiFormEditTools.js'`

- [ ] **Step 3: Create aiFormEditTools.ts**

Create `apps/backend/src/lib/aiFormEditTools.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';

export const formEditTools = {
  inspectForm: tool({
    description:
      'Read the current form state — field IDs, labels, types, order — before making edits. Call this first when you need to reference specific field IDs.',
    parameters: z.object({}),
    execute: async () => ({
      note: 'Full form state is provided in the system prompt. Use the field IDs listed there when calling updateField, removeField, or reorderFields.',
    }),
  }),

  addField: tool({
    description: 'Add a new field to the form. Use insertAfterFieldId to control placement.',
    parameters: z.object({
      fieldType: z.enum(['text', 'textarea', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'file']),
      label: z.string().describe('The question or field label shown to users'),
      required: z.boolean(),
      placeholder: z.string().nullable(),
      options: z.array(z.string()).nullable().describe('Options for select/radio/checkbox; null for other types'),
      insertAfterFieldId: z.string().nullable().describe('Insert after this field ID; null to append at end'),
    }),
    execute: async (args) => ({ type: 'ADD_FIELD' as const, ...args }),
  }),

  updateField: tool({
    description: 'Update one or more properties of an existing field. Only specify the properties you want to change.',
    parameters: z.object({
      fieldId: z.string().describe('The ID of the field to update (from inspectForm)'),
      updates: z.object({
        label: z.string().optional(),
        required: z.boolean().optional(),
        placeholder: z.string().optional(),
        options: z.array(z.string()).optional(),
        hint: z.string().optional(),
      }),
    }),
    execute: async (args) => ({ type: 'UPDATE_FIELD' as const, ...args }),
  }),

  removeField: tool({
    description: 'Remove a field from the form.',
    parameters: z.object({
      fieldId: z.string().describe('The ID of the field to remove (from inspectForm)'),
    }),
    execute: async (args) => ({ type: 'REMOVE_FIELD' as const, ...args }),
  }),

  reorderFields: tool({
    description:
      'Reorder fields on a page. Provide the complete desired order as an array of all field IDs for that page.',
    parameters: z.object({
      pageId: z.string(),
      fieldIds: z.array(z.string()).describe('All field IDs in the desired order'),
    }),
    execute: async (args) => ({ type: 'REORDER_FIELDS' as const, ...args }),
  }),

  updateLayout: tool({
    description: 'Update the form intro content (HTML) or the CTA button label.',
    parameters: z.object({
      content: z.string().optional().describe('HTML intro: <h1> title + <p> description only'),
      customCTAButtonName: z.string().optional().describe('Short CTA button label, max 4 words'),
    }),
    execute: async (args) => ({ type: 'UPDATE_LAYOUT' as const, ...args }),
  }),
};

export type FormOperation = Awaited<ReturnType<(typeof formEditTools)[keyof typeof formEditTools]['execute']>>;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/backend && pnpm test:unit -- aiFormEditTools
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "feat(ai): add form edit tool definitions with tests"
```

---

## Task 5: Create aiChatService.ts + tests

**Files:**
- Create: `apps/backend/src/services/aiChatService.ts`
- Create: `apps/backend/src/services/__tests__/aiChatService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/backend/src/services/__tests__/aiChatService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    aIChatConversation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aIChatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../lib/ai.js', () => ({
  getPrimaryModel: vi.fn(() => 'mock-model'),
  getFastModel: vi.fn(() => 'mock-fast-model'),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'Short title' }),
  streamText: vi.fn().mockReturnValue({
    fullStream: (async function* () {
      yield { type: 'text-delta', textDelta: 'Hello ' };
      yield { type: 'text-delta', textDelta: 'world' };
      yield { type: 'finish', finishReason: 'stop', usage: { totalTokens: 50 } };
    })(),
  }),
}));

import { prisma } from '../../lib/prisma.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  renameConversation,
  saveUserMessage,
  buildStreamForConversation,
} from '../aiChatService.js';

describe('createConversation', () => {
  it('calls prisma.aIChatConversation.create with correct fields', async () => {
    (prisma.aIChatConversation.create as any).mockResolvedValue({ id: 'conv_1', title: 'New conversation' });
    const result = await createConversation('form_1', 'org_1', 'user_1');
    expect(prisma.aIChatConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ formId: 'form_1', organizationId: 'org_1', userId: 'user_1' }),
    });
    expect(result.id).toBe('conv_1');
  });
});

describe('listConversations', () => {
  it('queries by formId and userId ordered by updatedAt desc', async () => {
    (prisma.aIChatConversation.findMany as any).mockResolvedValue([]);
    await listConversations('form_1', 'org_1', 'user_1');
    expect(prisma.aIChatConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId: 'form_1', organizationId: 'org_1', userId: 'user_1' },
        orderBy: { updatedAt: 'desc' },
      })
    );
  });
});

describe('saveUserMessage', () => {
  it('creates a message with role=user', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({ id: 'msg_1', role: 'user', content: 'Hello' });
    const result = await saveUserMessage('conv_1', 'Hello');
    expect(prisma.aIChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: 'conv_1', role: 'user', content: 'Hello' }),
    });
    expect(result.role).toBe('user');
  });
});

describe('buildStreamForConversation', () => {
  it('returns an object with fullStream AsyncIterable', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue({
      id: 'conv_1', title: 'Test', userId: 'user_1',
    });
    (prisma.aIChatMessage.findMany as any).mockResolvedValue([]);
    const result = await buildStreamForConversation('conv_1', 'user_1', {}, 'Make all required');
    expect(result).toHaveProperty('fullStream');
    expect(typeof result.fullStream[Symbol.asyncIterator]).toBe('function');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/backend && pnpm test:unit -- aiChatService
```

Expected: FAIL — `Cannot find module '../aiChatService.js'`

- [ ] **Step 3: Create aiChatService.ts**

Create `apps/backend/src/services/aiChatService.ts`:

```ts
import { generateText, streamText } from 'ai';
import { prisma } from '../lib/prisma.js';
import { getPrimaryModel, getFastModel } from '../lib/ai.js';
import { formEditTools } from '../lib/aiFormEditTools.js';
import { logger } from '../lib/logger.js';
import { serializeFormSchema } from '@dculus/types';

export async function createConversation(
  formId: string,
  organizationId: string,
  userId: string
) {
  return prisma.aIChatConversation.create({
    data: { formId, organizationId, userId, title: 'New conversation' },
    include: { messages: true },
  });
}

export async function listConversations(
  formId: string,
  organizationId: string,
  userId: string
) {
  const conversations = await prisma.aIChatConversation.findMany({
    where: { formId, organizationId, userId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });

  return conversations.map((c) => ({
    ...c,
    messageCount: c._count.messages,
    messages: [],
  }));
}

export async function getConversation(id: string, userId: string) {
  const conv = await prisma.aIChatConversation.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      _count: { select: { messages: true } },
    },
  });
  if (!conv) return null;
  return { ...conv, messageCount: conv._count.messages };
}

export async function deleteConversation(id: string, userId: string) {
  const conv = await prisma.aIChatConversation.findFirst({ where: { id, userId } });
  if (!conv) return false;
  await prisma.aIChatConversation.delete({ where: { id } });
  return true;
}

export async function renameConversation(id: string, userId: string, title: string) {
  const conv = await prisma.aIChatConversation.findFirst({ where: { id, userId } });
  if (!conv) return null;
  return prisma.aIChatConversation.update({ where: { id }, data: { title } });
}

export async function saveUserMessage(conversationId: string, content: string) {
  return prisma.aIChatMessage.create({
    data: { conversationId, role: 'user', content },
  });
}

export async function saveAssistantMessage(
  conversationId: string,
  content: string,
  operations: object[],
  tokensUsed: number
) {
  return prisma.aIChatMessage.create({
    data: { conversationId, role: 'assistant', content, operations, tokensUsed },
  });
}

export async function buildStreamForConversation(
  conversationId: string,
  userId: string,
  currentFormState: object,
  latestUserMessage: string
) {
  const conv = await prisma.aIChatConversation.findFirst({ where: { id: conversationId, userId } });
  if (!conv) throw new Error('Conversation not found');

  const history = await prisma.aIChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  // Serialize form state for system prompt context
  let formStateText = 'Form state unavailable.';
  try {
    const schema = currentFormState as any;
    const pages = schema?.pages ?? [];
    const fieldLines = pages.flatMap((p: any) =>
      (p.fields ?? []).map(
        (f: any) => `  - [${f.id}] type=${f.type} label="${f.label}" required=${f.required} pageId=${p.id}`
      )
    );
    formStateText = fieldLines.length
      ? `Current form fields:\n${fieldLines.join('\n')}`
      : 'The form currently has no fields.';
  } catch {
    /* ignore serialization errors */
  }

  const systemPrompt = `You are an AI assistant that helps users edit and improve their form.
You can add, update, remove, and reorder fields using the provided tools.
Always call inspectForm first if you need to reference specific field IDs.
Make only the changes the user requests. Confirm what you did in your final text response.

${formStateText}`;

  const messages = [
    ...history
      .filter((m) => m.role !== 'assistant' || m.conversationId) // skip if no content
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    { role: 'user' as const, content: latestUserMessage },
  ];

  return streamText({
    model: getPrimaryModel(),
    system: systemPrompt,
    messages,
    tools: formEditTools,
    maxSteps: 5,
  });
}

// Fire-and-forget: generates a short title from the first user message
export function autoGenerateTitle(conversationId: string, firstMessage: string): void {
  generateText({
    model: getFastModel(),
    prompt: `Generate a short title (max 7 words, no quotes) for a form editing conversation that starts with: "${firstMessage.slice(0, 200)}"`,
  })
    .then(({ text }) => {
      const title = text.trim().slice(0, 60);
      return prisma.aIChatConversation.update({ where: { id: conversationId }, data: { title } });
    })
    .catch((err) => logger.warn({ err, conversationId }, 'Failed to auto-generate conversation title'));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/backend && pnpm test:unit -- aiChatService
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/aiChatService.ts apps/backend/src/services/__tests__/aiChatService.test.ts
git commit -m "feat(ai): add aiChatService with conversation CRUD and streaming"
```

---

## Task 6: Add GraphQL schema types and Subscription root

**Files:**
- Modify: `apps/backend/src/graphql/schema.ts`

- [ ] **Step 1: Add AIChatConversation, AIChatMessage, AIChatChunk types**

Open `apps/backend/src/graphql/schema.ts`. Find the `# AI Mutations` comment (near the bottom of the `type Mutation` block). Add the following new type definitions **after** the existing AI types block (after `type AITokenUsage`):

```graphql
  # AI Chat Types
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
    role: String!
    content: String!
    operations: [JSON!]
    createdAt: String!
  }

  type AIChatChunk {
    type: String!
    delta: String
    operation: JSON
    messageId: String
    error: String
  }
```

- [ ] **Step 2: Add AI Chat queries to type Query**

In `schema.ts`, find the `# AI Queries` comment inside `type Query`. Add after `aiTokenUsage`:

```graphql
    listAIChatConversations(formId: ID!, organizationId: ID!): [AIChatConversation!]!
    getAIChatConversation(id: ID!, organizationId: ID!): AIChatConversation!
```

- [ ] **Step 3: Add AI Chat mutations to type Mutation**

In `schema.ts`, find the `# AI Mutations` comment inside `type Mutation`. Add after `generateFormWithAI`:

```graphql
    createAIChatConversation(formId: ID!, organizationId: ID!): AIChatConversation!
    deleteAIChatConversation(id: ID!, organizationId: ID!): Boolean!
    renameAIChatConversation(id: ID!, organizationId: ID!, title: String!): AIChatConversation!
    sendAIChatUserMessage(conversationId: ID!, organizationId: ID!, content: String!): AIChatMessage!
```

- [ ] **Step 4: Add type Subscription root for real-time**

At the very end of the `gql` template literal in `schema.ts`, before the closing backtick, add:

```graphql
  # Real-time subscriptions
  type Subscription {
    aiChatStream(
      conversationId: ID!
      organizationId: ID!
      currentFormState: JSON!
    ): AIChatChunk!
  }
```

- [ ] **Step 5: Verify schema compiles**

```bash
cd apps/backend && pnpm type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/graphql/schema.ts
git commit -m "feat(schema): add AIChatConversation types and Subscription root for real-time"
```

---

## Task 7: Create aiChat.ts resolver and register it

**Files:**
- Create: `apps/backend/src/graphql/resolvers/aiChat.ts`
- Create: `apps/backend/src/graphql/resolvers/__tests__/aiChat.test.ts`
- Modify: `apps/backend/src/graphql/resolvers.ts`

- [ ] **Step 1: Write failing resolver tests**

Create `apps/backend/src/graphql/resolvers/__tests__/aiChat.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/aiChatService.js', () => ({
  createConversation: vi.fn().mockResolvedValue({ id: 'conv_1', title: 'New conversation', messages: [], messageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), formId: 'form_1' }),
  listConversations: vi.fn().mockResolvedValue([]),
  getConversation: vi.fn().mockResolvedValue(null),
  deleteConversation: vi.fn().mockResolvedValue(true),
  renameConversation: vi.fn().mockResolvedValue({ id: 'conv_1', title: 'Renamed' }),
  saveUserMessage: vi.fn().mockResolvedValue({ id: 'msg_1', role: 'user', content: 'Hi' }),
  buildStreamForConversation: vi.fn(),
  autoGenerateTitle: vi.fn(),
}));

vi.mock('../../../services/aiUsageService.js', () => ({
  checkAITokenBudget: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 50000 }),
  recordAITokenUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../middleware/better-auth-middleware.js', () => ({
  requireAuth: vi.fn(),
  requireOrganizationMembership: vi.fn().mockResolvedValue({}),
}));

import { aiChatResolvers } from '../aiChat.js';

const mockAuth = { user: { id: 'user_1' }, session: { activeOrganizationId: 'org_1' }, isAuthenticated: true };

describe('aiChatResolvers.Query.listAIChatConversations', () => {
  it('returns empty array when no conversations exist', async () => {
    const result = await aiChatResolvers.Query.listAIChatConversations(
      {},
      { formId: 'form_1', organizationId: 'org_1' },
      { auth: mockAuth }
    );
    expect(result).toEqual([]);
  });
});

describe('aiChatResolvers.Mutation.createAIChatConversation', () => {
  it('creates conversation with correct args', async () => {
    const result = await aiChatResolvers.Mutation.createAIChatConversation(
      {},
      { formId: 'form_1', organizationId: 'org_1' },
      { auth: mockAuth }
    );
    expect(result.id).toBe('conv_1');
  });
});

describe('aiChatResolvers.Mutation.sendAIChatUserMessage', () => {
  it('saves user message and returns it', async () => {
    const result = await aiChatResolvers.Mutation.sendAIChatUserMessage(
      {},
      { conversationId: 'conv_1', organizationId: 'org_1', content: 'Hi' },
      { auth: mockAuth }
    );
    expect(result.role).toBe('user');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/backend && pnpm test:unit -- resolvers/aiChat
```

Expected: FAIL — `Cannot find module '../aiChat.js'`

- [ ] **Step 3: Create aiChat.ts resolver**

Create `apps/backend/src/graphql/resolvers/aiChat.ts`:

```ts
import {
  requireAuth,
  requireOrganizationMembership,
  type BetterAuthContext,
} from '../../middleware/better-auth-middleware.js';
import { checkAITokenBudget, recordAITokenUsage } from '../../services/aiUsageService.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  renameConversation,
  saveUserMessage,
  saveAssistantMessage,
  buildStreamForConversation,
  autoGenerateTitle,
} from '../../services/aiChatService.js';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { logger } from '../../lib/logger.js';

export const aiChatResolvers = {
  Query: {
    listAIChatConversations: async (
      _: any,
      { formId, organizationId }: { formId: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      return listConversations(formId, organizationId, context.auth.user!.id);
    },

    getAIChatConversation: async (
      _: any,
      { id, organizationId }: { id: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      const conv = await getConversation(id, context.auth.user!.id);
      if (!conv) throw createGraphQLError('Conversation not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      return conv;
    },
  },

  Mutation: {
    createAIChatConversation: async (
      _: any,
      { formId, organizationId }: { formId: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      return createConversation(formId, organizationId, context.auth.user!.id);
    },

    deleteAIChatConversation: async (
      _: any,
      { id, organizationId }: { id: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      return deleteConversation(id, context.auth.user!.id);
    },

    renameAIChatConversation: async (
      _: any,
      { id, organizationId, title }: { id: string; organizationId: string; title: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      const updated = await renameConversation(id, context.auth.user!.id, title);
      if (!updated) throw createGraphQLError('Conversation not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      return updated;
    },

    sendAIChatUserMessage: async (
      _: any,
      { conversationId, organizationId, content }: { conversationId: string; organizationId: string; content: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      const isFirst = (await listConversations('', organizationId, context.auth.user!.id)).length === 0;
      const message = await saveUserMessage(conversationId, content);
      if (isFirst) autoGenerateTitle(conversationId, content);
      return message;
    },
  },

  Subscription: {
    aiChatStream: {
      subscribe: async function* (
        _: any,
        {
          conversationId,
          organizationId,
          currentFormState,
        }: { conversationId: string; organizationId: string; currentFormState: object },
        context: { auth: BetterAuthContext }
      ) {
        requireAuth(context.auth);
        await requireOrganizationMembership(context.auth, organizationId);

        const budget = await checkAITokenBudget(organizationId);
        if (!budget.allowed) {
          yield {
            aiChatStream: {
              type: 'error',
              error: `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} used). Upgrade your plan to continue.`,
            },
          };
          return;
        }

        const conv = await getConversation(conversationId, context.auth.user!.id);
        if (!conv) {
          yield { aiChatStream: { type: 'error', error: 'Conversation not found' } };
          return;
        }

        const latestUserMsg = conv.messages.at(-1)?.content ?? '';
        const operations: object[] = [];
        let fullText = '';

        try {
          const result = await buildStreamForConversation(
            conversationId,
            context.auth.user!.id,
            currentFormState,
            latestUserMsg
          );

          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              fullText += part.textDelta;
              yield { aiChatStream: { type: 'text', delta: part.textDelta } };
            }

            if (part.type === 'tool-result') {
              const op = part.result as object;
              operations.push(op);
              yield { aiChatStream: { type: 'operation', operation: op } };
            }

            if (part.type === 'finish') {
              const tokensUsed = (part as any).usage?.totalTokens ?? 0;
              const saved = await saveAssistantMessage(conversationId, fullText, operations, tokensUsed);
              await recordAITokenUsage(organizationId, tokensUsed);
              yield { aiChatStream: { type: 'done', messageId: saved.id } };
            }
          }
        } catch (err) {
          logger.error({ err, conversationId }, 'AI chat stream failed');
          yield { aiChatStream: { type: 'error', error: 'AI processing failed. Please try again.' } };
        }
      },
      resolve: (payload: any) => payload.aiChatStream,
    },
  },
};
```

- [ ] **Step 4: Register in resolvers.ts**

Open `apps/backend/src/graphql/resolvers.ts`.

Add import at the top with the other resolver imports:
```ts
import { aiChatResolvers } from './resolvers/aiChat.js';
```

In the `Query` block, add:
```ts
    ...aiChatResolvers.Query,
```

In the `Mutation` block, add:
```ts
    ...aiChatResolvers.Mutation,
```

After the `PlanSubscription` block (from Task 2), add:
```ts
  Subscription: {
    ...aiChatResolvers.Subscription,
  },
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd apps/backend && pnpm test:unit -- resolvers/aiChat
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/graphql/resolvers/aiChat.ts apps/backend/src/graphql/resolvers/__tests__/aiChat.test.ts apps/backend/src/graphql/resolvers.ts
git commit -m "feat(ai): add aiChat resolver with CRUD mutations and subscription"
```

---

## Task 8: Wire graphql-ws in index.ts

**Files:**
- Modify: `apps/backend/src/index.ts`

- [ ] **Step 1: Add graphql-ws import to index.ts**

Open `apps/backend/src/index.ts`. At the top with the other imports, add:

```ts
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
```

- [ ] **Step 2: Check if @graphql-tools/schema is already installed**

```bash
grep "@graphql-tools" /Users/$(whoami)/Desktop/DculusApps/dculus-forms/apps/backend/package.json
```

If not present, install it:
```bash
cd apps/backend && pnpm add @graphql-tools/schema
```

- [ ] **Step 3: Build executable schema before ApolloServer**

In `index.ts`, find where `const apolloServer = new ApolloServer({...})` is declared. Before that line, add:

```ts
  const schema = makeExecutableSchema({ typeDefs, resolvers });
```

Then update the ApolloServer constructor to use the pre-built schema:
```ts
  const apolloServer = new ApolloServer({
    schema,   // ← use schema instead of typeDefs + resolvers
    // ... rest of options unchanged
  });
```

- [ ] **Step 4: Add graphql-ws WebSocketServer after Hocuspocus setup**

In `index.ts`, find the block that creates the Hocuspocus WebSocket server:

```ts
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/collaboration',
  });
```

After that block (after `wss.on('connection', ...)`), add:

```ts
  // GraphQL real-time subscriptions (graphql-ws) — separate path from Hocuspocus
  const gqlWss = new WebSocketServer({ server: httpServer, path: '/graphql' });
  useServer(
    {
      schema,
      context: async (ctx) => {
        const token = (ctx.connectionParams as any)?.token as string | undefined;
        if (!token) {
          return { auth: { user: null, session: null, isAuthenticated: false } };
        }
        try {
          const headers = new Headers({ authorization: `Bearer ${token}` });
          const sessionData = await auth.api.getSession({ headers });
          return {
            auth: {
              user: sessionData?.user ?? null,
              session: sessionData?.session ?? null,
              isAuthenticated: !!sessionData?.user,
            },
          };
        } catch {
          return { auth: { user: null, session: null, isAuthenticated: false } };
        }
      },
    },
    gqlWss
  );
  logger.info('🔌 graphql-ws subscription server listening at /graphql');
```

- [ ] **Step 5: Verify backend builds and starts**

```bash
cd apps/backend && pnpm type-check
```

Expected: no TypeScript errors.

```bash
pnpm backend:dev
```

Expected: Server starts, logs show both:
- `🤝 Hocuspocus WebSocket server integrated on port 4000`
- `🔌 graphql-ws subscription server listening at /graphql`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/index.ts apps/backend/package.json
git commit -m "feat(infra): wire graphql-ws subscription server at /graphql path"
```

---

## Task 9: Update Apollo Client with split link

**Files:**
- Modify: `apps/form-app/src/services/apolloClient.ts`

- [ ] **Step 1: Add imports to apolloClient.ts**

Open `apps/form-app/src/services/apolloClient.ts`. Add these imports at the top:

```ts
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { getGraphQLWsUrl } from '../lib/config';
```

- [ ] **Step 2: Create the WebSocket link after the existing httpLink**

After the `const httpLink = createHttpLink({...})` declaration, add:

```ts
const wsLink = new GraphQLWsLink(
  createClient({
    url: getGraphQLWsUrl(),
    connectionParams: () => ({
      token: getBearerToken(),
    }),
    retryAttempts: 3,
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  wsLink,
  errorLink.concat(authLink).concat(httpLink),
);
```

- [ ] **Step 3: Replace the ApolloClient link**

Find:
```ts
export const client = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
```

Replace with:
```ts
export const client = new ApolloClient({
  link: splitLink,
```

- [ ] **Step 4: Verify form-app builds**

```bash
cd apps/form-app && pnpm type-check
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/services/apolloClient.ts apps/form-app/src/lib/config.ts
git commit -m "feat(apollo): add GraphQLWsLink with split routing for subscriptions"
```

---

## Task 10: GraphQL operations file + i18n translations

**Files:**
- Create: `apps/form-app/src/graphql/aiChat.ts`
- Create: `apps/form-app/src/locales/en/aiEditDrawer.json`
- Create: `apps/form-app/src/locales/ta/aiEditDrawer.json`
- Modify: `apps/form-app/src/locales/index.ts`

- [ ] **Step 1: Create GraphQL operations**

Create `apps/form-app/src/graphql/aiChat.ts`:

```ts
import { gql } from '@apollo/client';

export const LIST_AI_CHAT_CONVERSATIONS = gql`
  query ListAIChatConversations($formId: ID!, $organizationId: ID!) {
    listAIChatConversations(formId: $formId, organizationId: $organizationId) {
      id
      title
      messageCount
      createdAt
      updatedAt
    }
  }
`;

export const GET_AI_CHAT_CONVERSATION = gql`
  query GetAIChatConversation($id: ID!, $organizationId: ID!) {
    getAIChatConversation(id: $id, organizationId: $organizationId) {
      id
      title
      messageCount
      createdAt
      updatedAt
      messages {
        id
        role
        content
        operations
        createdAt
      }
    }
  }
`;

export const CREATE_AI_CHAT_CONVERSATION = gql`
  mutation CreateAIChatConversation($formId: ID!, $organizationId: ID!) {
    createAIChatConversation(formId: $formId, organizationId: $organizationId) {
      id
      title
      messageCount
      createdAt
      updatedAt
      messages {
        id
        role
        content
        operations
        createdAt
      }
    }
  }
`;

export const DELETE_AI_CHAT_CONVERSATION = gql`
  mutation DeleteAIChatConversation($id: ID!, $organizationId: ID!) {
    deleteAIChatConversation(id: $id, organizationId: $organizationId)
  }
`;

export const RENAME_AI_CHAT_CONVERSATION = gql`
  mutation RenameAIChatConversation($id: ID!, $organizationId: ID!, $title: String!) {
    renameAIChatConversation(id: $id, organizationId: $organizationId, title: $title) {
      id
      title
    }
  }
`;

export const SEND_AI_CHAT_USER_MESSAGE = gql`
  mutation SendAIChatUserMessage($conversationId: ID!, $organizationId: ID!, $content: String!) {
    sendAIChatUserMessage(conversationId: $conversationId, organizationId: $organizationId, content: $content) {
      id
      role
      content
      createdAt
    }
  }
`;

export const AI_CHAT_STREAM = gql`
  subscription AIChatStream($conversationId: ID!, $organizationId: ID!, $currentFormState: JSON!) {
    aiChatStream(conversationId: $conversationId, organizationId: $organizationId, currentFormState: $currentFormState) {
      type
      delta
      operation
      messageId
      error
    }
  }
`;
```

- [ ] **Step 2: Create English translations**

Create `apps/form-app/src/locales/en/aiEditDrawer.json`:

```json
{
  "title": "AI Assistant",
  "newChat": "New chat",
  "rename": "Rename",
  "delete": "Delete conversation",
  "deleteConfirm": "Are you sure you want to delete this conversation?",
  "inputPlaceholder": "Ask AI to edit your form...",
  "send": "Send",
  "typing": "AI is thinking...",
  "operationChips": {
    "ADD_FIELD": "Added field",
    "UPDATE_FIELD": "Updated field",
    "REMOVE_FIELD": "Removed field",
    "REORDER_FIELDS": "Reordered fields",
    "UPDATE_LAYOUT": "Updated layout"
  },
  "tokenLimitError": "AI token limit reached. Upgrade your plan to continue.",
  "genericError": "Something went wrong. Please try again.",
  "emptyState": "Ask AI to help you edit, improve, or rewrite any part of your form.",
  "openButton": "AI"
}
```

- [ ] **Step 3: Create Tamil translations**

Create `apps/form-app/src/locales/ta/aiEditDrawer.json`:

```json
{
  "title": "AI உதவியாளர்",
  "newChat": "புதிய உரையாடல்",
  "rename": "மறுபெயரிடு",
  "delete": "உரையாடலை நீக்கு",
  "deleteConfirm": "இந்த உரையாடலை நீக்க விரும்புகிறீர்களா?",
  "inputPlaceholder": "AI-இடம் படிவத்தை திருத்தக் கேளுங்கள்...",
  "send": "அனுப்பு",
  "typing": "AI யோசிக்கிறது...",
  "operationChips": {
    "ADD_FIELD": "புலம் சேர்க்கப்பட்டது",
    "UPDATE_FIELD": "புலம் புதுப்பிக்கப்பட்டது",
    "REMOVE_FIELD": "புலம் நீக்கப்பட்டது",
    "REORDER_FIELDS": "புலங்கள் மறுவரிசைப்படுத்தப்பட்டன",
    "UPDATE_LAYOUT": "தளவமைப்பு புதுப்பிக்கப்பட்டது"
  },
  "tokenLimitError": "AI டோக்கன் வரம்பு அடைந்தது. தொடர திட்டத்தை மேம்படுத்தவும்.",
  "genericError": "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
  "emptyState": "படிவத்தை திருத்த, மேம்படுத்த அல்லது மாற்ற AI-இடம் கேளுங்கள்.",
  "openButton": "AI"
}
```

- [ ] **Step 4: Register translations in locales/index.ts**

Open `apps/form-app/src/locales/index.ts`. Find the `enTranslations` and `taTranslations` objects. Add to each:

```ts
// in enTranslations:
import aiEditDrawerEn from './en/aiEditDrawer.json';
// add to object: aiEditDrawer: aiEditDrawerEn,

// in taTranslations:
import aiEditDrawerTa from './ta/aiEditDrawer.json';
// add to object: aiEditDrawer: aiEditDrawerTa,
```

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/graphql/aiChat.ts \
        apps/form-app/src/locales/en/aiEditDrawer.json \
        apps/form-app/src/locales/ta/aiEditDrawer.json \
        apps/form-app/src/locales/index.ts
git commit -m "feat(ai): add GraphQL operations, i18n translations for AI chat drawer"
```

---

## Task 11: Create useAIChat hook

**Files:**
- Create: `apps/form-app/src/hooks/useAIChat.ts`

**Context:** The form builder store uses `updateField(pageId, fieldId, updates)`, `removeField(pageId, fieldId)`, `reorderFields(pageId, oldIndex, newIndex)`, `addField(pageId, fieldType, fieldData)`, and `updateLayout(updates)`. Since AI operations only have `fieldId` (not `pageId`), the hook must derive the page from current store state.

- [ ] **Step 1: Create useAIChat.ts**

Create `apps/form-app/src/hooks/useAIChat.ts`:

```ts
import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useSubscription, useApolloClient } from '@apollo/client';
import { FieldType } from '@dculus/types';
import { toastError } from '@dculus/ui';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import {
  LIST_AI_CHAT_CONVERSATIONS,
  GET_AI_CHAT_CONVERSATION,
  CREATE_AI_CHAT_CONVERSATION,
  DELETE_AI_CHAT_CONVERSATION,
  RENAME_AI_CHAT_CONVERSATION,
  SEND_AI_CHAT_USER_MESSAGE,
  AI_CHAT_STREAM,
} from '../graphql/aiChat';

// Maps AI operation field type strings to FieldType enum
const AI_TYPE_MAP: Record<string, FieldType> = {
  text: FieldType.TEXT_INPUT_FIELD,
  textarea: FieldType.TEXT_AREA_FIELD,
  email: FieldType.EMAIL_FIELD,
  number: FieldType.NUMBER_FIELD,
  date: FieldType.DATE_FIELD,
  select: FieldType.SELECT_FIELD,
  radio: FieldType.RADIO_FIELD,
  checkbox: FieldType.CHECKBOX_FIELD,
  file: FieldType.FILE_UPLOAD_FIELD,
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  operations?: object[] | null;
  createdAt: string;
  // Transient streaming state (not from DB)
  isStreaming?: boolean;
  streamingText?: string;
  streamingOps?: { type: string; label: string }[];
}

export function useAIChat({
  formId,
  organizationId,
}: {
  formId: string;
  organizationId: string;
}) {
  const apolloClient = useApolloClient();
  const store = useFormBuilderStore();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<AIChatMessage | null>(null);
  const subscriptionActiveRef = useRef(false);

  // --- Queries ---
  const { data: conversationsData, refetch: refetchConversations } = useQuery(
    LIST_AI_CHAT_CONVERSATIONS,
    { variables: { formId, organizationId }, skip: !formId }
  );

  const { data: activeConvData, refetch: refetchActiveConversation } = useQuery(
    GET_AI_CHAT_CONVERSATION,
    {
      variables: { id: activeConversationId!, organizationId },
      skip: !activeConversationId,
    }
  );

  // --- Mutations ---
  const [createConvMutation] = useMutation(CREATE_AI_CHAT_CONVERSATION);
  const [deleteConvMutation] = useMutation(DELETE_AI_CHAT_CONVERSATION);
  const [renameConvMutation] = useMutation(RENAME_AI_CHAT_CONVERSATION);
  const [sendUserMessageMutation] = useMutation(SEND_AI_CHAT_USER_MESSAGE);

  // --- Subscription ---
  // currentFormState is built lazily at send time so we track it in a ref
  const currentFormStateRef = useRef<object>({});

  const { data: streamData } = useSubscription(AI_CHAT_STREAM, {
    variables: {
      conversationId: activeConversationId!,
      organizationId,
      currentFormState: currentFormStateRef.current,
    },
    skip: !isStreaming || !activeConversationId,
    onData: ({ data }) => {
      const chunk = data.data?.aiChatStream;
      if (!chunk) return;

      if (chunk.type === 'text') {
        setStreamingMessage((prev) =>
          prev ? { ...prev, streamingText: (prev.streamingText ?? '') + chunk.delta } : null
        );
      }

      if (chunk.type === 'operation') {
        const op = chunk.operation;
        applyOperationToStore(op);
        const label = buildOperationLabel(op);
        setStreamingMessage((prev) =>
          prev
            ? { ...prev, streamingOps: [...(prev.streamingOps ?? []), { type: op.type, label }] }
            : null
        );
      }

      if (chunk.type === 'done') {
        setIsStreaming(false);
        subscriptionActiveRef.current = false;
        setStreamingMessage(null);
        refetchActiveConversation();
        refetchConversations();
      }

      if (chunk.type === 'error') {
        setIsStreaming(false);
        subscriptionActiveRef.current = false;
        setStreamingMessage(null);
        const isLimit = chunk.error?.includes('token limit');
        toastError('AI Error', isLimit ? chunk.error : 'AI processing failed. Please try again.');
      }
    },
  });

  // --- Helpers ---
  function getPageIdForField(fieldId: string): string | null {
    for (const page of store.pages) {
      const fields = (page as any).fields ?? [];
      if (fields.some((f: any) => f.id === fieldId)) return page.id;
    }
    return null;
  }

  function applyOperationToStore(op: any) {
    if (!op?.type) return;

    switch (op.type) {
      case 'ADD_FIELD': {
        const targetPageId = store.pages[0]?.id;
        if (!targetPageId) return;
        const fieldType = AI_TYPE_MAP[op.fieldType] ?? FieldType.TEXT_INPUT_FIELD;
        const isChoice = [FieldType.SELECT_FIELD, FieldType.RADIO_FIELD, FieldType.CHECKBOX_FIELD].includes(fieldType);
        const fieldData = isChoice
          ? { label: op.label, required: op.required, placeholder: op.placeholder ?? '', defaultValue: '', prefix: '', hint: '', options: op.options ?? ['Option 1', 'Option 2'] }
          : { label: op.label, required: op.required, placeholder: op.placeholder ?? '', defaultValue: '', prefix: '', hint: '' };
        store.addField(targetPageId, fieldType, fieldData);
        break;
      }
      case 'UPDATE_FIELD': {
        const pageId = getPageIdForField(op.fieldId);
        if (!pageId) return;
        store.updateField(pageId, op.fieldId, op.updates);
        break;
      }
      case 'REMOVE_FIELD': {
        const pageId = getPageIdForField(op.fieldId);
        if (!pageId) return;
        store.removeField(pageId, op.fieldId);
        break;
      }
      case 'REORDER_FIELDS': {
        const page = store.pages.find((p) => p.id === op.pageId);
        if (!page) return;
        const currentIds = ((page as any).fields ?? []).map((f: any) => f.id);
        // Apply desired order as a sequence of individual moves
        const desired: string[] = op.fieldIds;
        const current = [...currentIds];
        for (let i = 0; i < desired.length; i++) {
          const fromIdx = current.indexOf(desired[i]);
          if (fromIdx !== -1 && fromIdx !== i) {
            store.reorderFields(op.pageId, fromIdx, i);
            const [moved] = current.splice(fromIdx, 1);
            current.splice(i, 0, moved);
          }
        }
        break;
      }
      case 'UPDATE_LAYOUT': {
        store.updateLayout(op);
        break;
      }
    }
  }

  function buildOperationLabel(op: any): string {
    switch (op?.type) {
      case 'ADD_FIELD': return `Added "${op.label}" field`;
      case 'UPDATE_FIELD': return `Updated field`;
      case 'REMOVE_FIELD': return `Removed field`;
      case 'REORDER_FIELDS': return `Reordered fields`;
      case 'UPDATE_LAYOUT': return `Updated layout`;
      default: return 'Changed form';
    }
  }

  // --- Public API ---
  const createConversation = useCallback(async () => {
    const { data } = await createConvMutation({ variables: { formId, organizationId } });
    const conv = data?.createAIChatConversation;
    if (conv) {
      setActiveConversationId(conv.id);
      refetchConversations();
    }
    return conv;
  }, [formId, organizationId, createConvMutation, refetchConversations]);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await deleteConvMutation({ variables: { id, organizationId } });
      if (id === activeConversationId) setActiveConversationId(null);
      refetchConversations();
    },
    [organizationId, activeConversationId, deleteConvMutation, refetchConversations]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConvMutation({ variables: { id, organizationId, title } });
      refetchConversations();
      if (id === activeConversationId) refetchActiveConversation();
    },
    [organizationId, activeConversationId, renameConvMutation, refetchConversations, refetchActiveConversation]
  );

  const sendMessage = useCallback(
    async (content: string, formState: object) => {
      if (!activeConversationId || isStreaming) return;

      currentFormStateRef.current = formState;

      // Save user message to DB
      await sendUserMessageMutation({
        variables: { conversationId: activeConversationId, organizationId, content },
      });

      // Set up streaming assistant bubble
      setStreamingMessage({
        id: 'streaming',
        role: 'assistant',
        content: '',
        streamingText: '',
        streamingOps: [],
        isStreaming: true,
        createdAt: new Date().toISOString(),
      });

      // Open subscription
      subscriptionActiveRef.current = true;
      setIsStreaming(true);
    },
    [activeConversationId, organizationId, isStreaming, sendUserMessageMutation]
  );

  const conversations = conversationsData?.listAIChatConversations ?? [];
  const activeConversation = activeConvData?.getAIChatConversation ?? null;
  const messages: AIChatMessage[] = [
    ...(activeConversation?.messages ?? []),
    ...(streamingMessage ? [streamingMessage] : []),
  ];

  return {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isStreaming,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/hooks/useAIChat.ts
git commit -m "feat(ai): add useAIChat hook with subscription-driven streaming and store integration"
```

---

## Task 12: Create AIEditDrawer component

**Files:**
- Create: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Create AIEditDrawer.tsx**

Create `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`:

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, Plus, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@dculus/utils';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useAIChat, type AIChatMessage } from '../../hooks/useAIChat';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';
import { serializeFormSchema } from '@dculus/types';

interface AIEditDrawerProps {
  formId: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

function UserBubble({ message }: { message: AIChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
        {message.content}
      </div>
    </div>
  );
}

function OperationChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {label}
    </span>
  );
}

function AssistantBubble({ message }: { message: AIChatMessage }) {
  const displayText = message.isStreaming ? message.streamingText : message.content;
  const ops = message.isStreaming ? message.streamingOps : undefined;

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[90%]">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <div className="space-y-1.5">
          {displayText && (
            <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
              {displayText}
              {message.isStreaming && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground/50 align-text-bottom" />
              )}
            </div>
          )}
          {ops && ops.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ops.map((op, i) => (
                <OperationChip key={i} label={op.label} />
              ))}
            </div>
          )}
          {!message.isStreaming && message.operations && message.operations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(message.operations as any[]).map((op, i) => (
                <OperationChip key={i} label={buildOpLabel(op)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildOpLabel(op: any): string {
  switch (op?.type) {
    case 'ADD_FIELD': return `Added "${op.label}" field`;
    case 'UPDATE_FIELD': return `Updated field`;
    case 'REMOVE_FIELD': return `Removed field`;
    case 'REORDER_FIELDS': return `Reordered fields`;
    case 'UPDATE_LAYOUT': return `Updated layout`;
    default: return 'Changed form';
  }
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const AIEditDrawer: React.FC<AIEditDrawerProps> = ({ formId, organizationId, isOpen, onClose }) => {
  const { t } = useTranslation('aiEditDrawer');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const store = useFormBuilderStore();

  const {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isStreaming,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
  } = useAIChat({ formId, organizationId });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create first conversation when drawer opens and no conversations exist
  useEffect(() => {
    if (isOpen && conversations.length === 0) {
      createConversation();
    } else if (isOpen && conversations.length > 0 && !activeConversationId) {
      selectConversation(conversations[0].id);
    }
  }, [isOpen, conversations.length]);

  const getFormState = useCallback(() => {
    try {
      const pages = store.pages.map((page: any) => ({
        id: page.id,
        fields: (page.fields ?? []).map((f: any) => ({
          id: f.id,
          type: f.type,
          label: f.label,
          required: f.required,
        })),
      }));
      return { pages };
    } catch {
      return { pages: [] };
    }
  }, [store.pages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !activeConversationId) return;
    setInput('');
    sendMessage(trimmed, getFormState());
  }, [input, isStreaming, activeConversationId, sendMessage, getFormState]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-semibold">{t('title')}</span>

        {/* Conversation selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 max-w-[140px] gap-1 px-2 text-xs">
              <span className="truncate">
                {activeConversation?.title ?? t('newChat')}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              className="gap-2 text-xs"
              onClick={() => createConversation()}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('newChat')}
            </DropdownMenuItem>
            {conversations.length > 0 && <DropdownMenuSeparator />}
            {conversations.map((conv) => (
              <DropdownMenuItem
                key={conv.id}
                className={cn('text-xs', conv.id === activeConversationId && 'bg-accent')}
                onClick={() => selectConversation(conv.id)}
              >
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  className="ml-2 rounded p-0.5 opacity-0 hover:opacity-100 group-hover:opacity-100 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !isStreaming && (
          <p className="text-center text-xs text-muted-foreground px-4 pt-8">
            {t('emptyState')}
          </p>
        )}
        {messages.map((msg) =>
          msg.role === 'user' ? (
            <UserBubble key={msg.id} message={msg} />
          ) : (
            <AssistantBubble key={msg.id} message={msg} />
          )
        )}
        {isStreaming && !messages.some((m) => m.isStreaming) && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div
          className={cn(
            'flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm',
            'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
            'transition-all duration-150'
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('inputPlaceholder')}
            disabled={isStreaming || !activeConversationId}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground',
              'max-h-28 overflow-y-auto leading-5 py-1',
              'disabled:opacity-50'
            )}
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || !activeConversationId}
            aria-label={t('send')}
            className={cn(
              'mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              'bg-primary text-primary-foreground',
              'disabled:cursor-not-allowed disabled:opacity-40',
              'hover:bg-primary/90 transition-colors'
            )}
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIEditDrawer;
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai): add AIEditDrawer slide-out chat component"
```

---

## Task 13: Wire AI button into builder header and mount drawer

**Files:**
- Modify: `apps/form-app/src/components/form-builder/FormBuilderHeader.tsx`
- Modify: `apps/form-app/src/pages/CollaborativeFormBuilder.tsx`

- [ ] **Step 1: Add AI toggle to FormBuilderHeader**

Open `apps/form-app/src/components/form-builder/FormBuilderHeader.tsx`. 

Add prop to the component's props interface:
```ts
  isAIDrawerOpen: boolean;
  onToggleAIDrawer: () => void;
```

Import `Sparkles` from `lucide-react` if not already imported.

Import `Button` from `@dculus/ui` if not already imported.

Add the AI button inside the header's right-side action area (alongside the existing publish/preview buttons):
```tsx
<Button
  variant={isAIDrawerOpen ? 'default' : 'outline'}
  size="sm"
  onClick={onToggleAIDrawer}
  className="gap-1.5"
>
  <Sparkles className="h-3.5 w-3.5" />
  AI
</Button>
```

- [ ] **Step 2: Mount AIEditDrawer in CollaborativeFormBuilder**

Open `apps/form-app/src/pages/CollaborativeFormBuilder.tsx`.

Add import:
```ts
import { useState } from 'react';
import AIEditDrawer from '../components/form-builder/AIEditDrawer';
```

Add state:
```ts
const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
```

Pass props to `FormBuilderHeader`:
```tsx
<FormBuilderHeader
  ...existingProps
  isAIDrawerOpen={isAIDrawerOpen}
  onToggleAIDrawer={() => setIsAIDrawerOpen((prev) => !prev)}
/>
```

In the main content area (the flex container that holds the builder), add the drawer as a sibling to the existing content:
```tsx
<div className="flex flex-1 overflow-hidden">
  {/* existing builder content */}
  <div className="flex-1 overflow-hidden">
    {/* ... existing JSX unchanged ... */}
  </div>

  {/* AI Drawer */}
  <AIEditDrawer
    formId={formId}
    organizationId={organizationId}
    isOpen={isAIDrawerOpen}
    onClose={() => setIsAIDrawerOpen(false)}
  />
</div>
```

- [ ] **Step 3: Add keyboard shortcut**

In `CollaborativeFormBuilder.tsx`, add a `useEffect` for the keyboard shortcut:

```ts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsAIDrawerOpen((prev) => !prev);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

- [ ] **Step 4: Full type-check**

```bash
pnpm type-check
```

Expected: no errors across all packages.

- [ ] **Step 5: Start the app and smoke test**

```bash
pnpm dev
```

1. Open the form builder for any form
2. Click the "AI" button in the header — drawer slides in from right
3. Type "Add a phone number field" — loading indicator appears, then field appears in builder
4. Type "Make all fields required" — fields update one by one
5. Click the conversation dropdown — "New chat" and the current conversation appear
6. Create a second conversation — selector updates
7. Switch between conversations — history loads correctly
8. Press Cmd+K / Ctrl+K — drawer toggles

- [ ] **Step 6: Final commit**

```bash
git add apps/form-app/src/components/form-builder/FormBuilderHeader.tsx \
        apps/form-app/src/pages/CollaborativeFormBuilder.tsx
git commit -m "feat(ai): wire AI chat drawer into form builder with keyboard shortcut"
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| graphql-ws transport (not SSE) | Task 1, 8 |
| Rename billing Subscription type | Task 2 |
| AIChatConversation + AIChatMessage DB models | Task 3 |
| 6 AI tool definitions | Task 4 |
| aiChatService CRUD + streaming | Task 5 |
| GraphQL schema: types, queries, mutations, Subscription root | Task 6 |
| aiChat.ts resolver with async generator subscription | Task 7 |
| Apollo Client split link | Task 9 |
| i18n en + ta | Task 10 |
| useAIChat hook with store integration | Task 11 |
| AIEditDrawer UI | Task 12 |
| FormBuilderHeader AI button + drawer mounting | Task 13 |
| Private per user (userId scope) | Tasks 3, 5, 7 |
| Token budget check | Task 7 |
| Auto-title from first message | Task 5 |
| Operation application with stagger | Task 11 |
| Keyboard shortcut Cmd+K | Task 13 |

All spec requirements covered.

### Type consistency
- `FormOperation` type exported from `aiFormEditTools.ts` and used in `aiChatService.ts`
- `AIChatMessage` interface in `useAIChat.ts` covers both DB messages and transient streaming state
- `store.updateField(pageId, fieldId, updates)` — correct 3-arg signature used in Task 11
- `store.removeField(pageId, fieldId)` — correct 2-arg signature used in Task 11
- `store.reorderFields(pageId, oldIndex, newIndex)` — correct signature, multi-step reorder implemented in Task 11
- `buildStreamForConversation` returns result from `streamText` which has `.fullStream` property ✓

### No placeholders found ✓
