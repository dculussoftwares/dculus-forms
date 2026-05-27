# AI Chat Form Builder Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken WebSocket AI chat with HTTP NDJSON streaming, fix all 8 known bugs, and give each unit one clear responsibility.

**Architecture:** A new `POST /api/ai/chat` Express route streams NDJSON to a `useAIStream` fetch hook. AI tools (`createFormEditTools`) read live form state from Prisma instead of the stale system-prompt injection. Store mutations go through one pure `applyAIOp` function. Undo uses `Y.UndoManager` (Y.js native undo, not React snapshots) since all store writes go through Y.js.

**Tech Stack:** Node.js/Express, Vercel AI SDK (`streamText`), Prisma, Y.js `UndoManager`, React/Zustand, Apollo Client (conversation CRUD only — streaming removed from GraphQL)

**Spec:** `docs/superpowers/specs/2026-05-27-ai-chat-form-builder-redesign.md`

---

## Phase 1 — Backend

### Task 1: Rewrite `aiFormEditTools.ts` as a factory

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`
- Modify: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the entire test file content:

```typescript
// apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFormEditTools } from '../aiFormEditTools.js';

const mockSchema = {
  pages: [
    {
      id: 'page-1',
      fields: [
        { id: 'f-1', type: 'TEXT_INPUT_FIELD', label: 'Name', required: true, placeholder: 'Enter name', hint: '', options: null },
        { id: 'f-2', type: 'SELECT_FIELD', label: 'Country', required: false, placeholder: '', hint: 'Pick one', options: ['USA', 'UK'] },
      ],
    },
    {
      id: 'page-2',
      fields: [
        { id: 'f-3', type: 'EMAIL_FIELD', label: 'Email', required: true, placeholder: '', hint: '', options: null },
      ],
    },
  ],
};

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    form: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma.js';

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.form.findUnique as any).mockResolvedValue({ formSchema: mockSchema });
});

describe('createFormEditTools', () => {
  it('returns all 7 tools', () => {
    const tools = createFormEditTools('form-1');
    expect(Object.keys(tools)).toEqual([
      'listFields', 'getField', 'addField', 'updateField',
      'removeField', 'reorderFields', 'updateLayout',
    ]);
  });
});

describe('listFields', () => {
  it('returns all pages with field summaries when no pageId given', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.listFields.execute({ pageId: undefined });
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].fields).toHaveLength(2);
    expect(result.pages[0].fields[0]).toEqual({
      id: 'f-1', type: 'TEXT_INPUT_FIELD', label: 'Name', required: true,
    });
  });

  it('filters to a specific page when pageId given', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.listFields.execute({ pageId: 'page-2' });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].id).toBe('page-2');
    expect(result.pages[0].fields).toHaveLength(1);
  });

  it('returns error when form not found', async () => {
    (prisma.form.findUnique as any).mockResolvedValue(null);
    const tools = createFormEditTools('bad-id');
    const result = await tools.listFields.execute({ pageId: undefined });
    expect(result).toHaveProperty('error');
  });
});

describe('getField', () => {
  it('returns full field details including pageId', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.getField.execute({ fieldId: 'f-2' });
    expect(result).toMatchObject({
      id: 'f-2',
      type: 'SELECT_FIELD',
      label: 'Country',
      required: false,
      hint: 'Pick one',
      options: ['USA', 'UK'],
      pageId: 'page-1',
    });
  });

  it('returns error for unknown fieldId', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.getField.execute({ fieldId: 'unknown' });
    expect(result).toHaveProperty('error');
  });
});

describe('addField', () => {
  it('returns ADD_FIELD op with all inputs', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.addField.execute({
      pageId: 'page-1',
      insertAfterFieldId: 'f-1',
      fieldType: 'text',
      label: 'Last Name',
      required: false,
      placeholder: null,
      options: null,
    });
    expect(result).toEqual({
      type: 'ADD_FIELD',
      pageId: 'page-1',
      insertAfterFieldId: 'f-1',
      fieldType: 'text',
      label: 'Last Name',
      required: false,
      placeholder: null,
      options: null,
    });
  });
});

describe('updateField', () => {
  it('returns UPDATE_FIELD op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.updateField.execute({
      fieldId: 'f-1',
      updates: { label: 'Full Name', required: true },
    });
    expect(result).toEqual({
      type: 'UPDATE_FIELD',
      fieldId: 'f-1',
      updates: { label: 'Full Name', required: true },
    });
  });
});

describe('removeField', () => {
  it('returns REMOVE_FIELD op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.removeField.execute({ fieldId: 'f-2' });
    expect(result).toEqual({ type: 'REMOVE_FIELD', fieldId: 'f-2' });
  });
});

describe('reorderFields', () => {
  it('returns REORDER_FIELDS op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.reorderFields.execute({
      pageId: 'page-1',
      fieldIds: ['f-2', 'f-1'],
    });
    expect(result).toEqual({
      type: 'REORDER_FIELDS',
      pageId: 'page-1',
      fieldIds: ['f-2', 'f-1'],
    });
  });
});

describe('updateLayout', () => {
  it('returns UPDATE_LAYOUT op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.updateLayout.execute({
      content: '<h1>Hello</h1>',
      customCTAButtonName: 'Submit',
    });
    expect(result).toEqual({
      type: 'UPDATE_LAYOUT',
      content: '<h1>Hello</h1>',
      customCTAButtonName: 'Submit',
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/backend && pnpm test:unit --run src/lib/__tests__/aiFormEditTools.test.ts
```

Expected: FAIL — `createFormEditTools is not a function`

- [ ] **Step 3: Rewrite `aiFormEditTools.ts`**

```typescript
// apps/backend/src/lib/aiFormEditTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export function createFormEditTools(formId: string) {
  async function getFormSchema() {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: { formSchema: true },
    });
    return form ? (form.formSchema as any) : null;
  }

  return {
    listFields: tool({
      description:
        'List all fields in the form with their id, type, label, and required flag. Filter to a specific page with pageId. Call this before making edits to understand the current structure.',
      inputSchema: z.object({
        pageId: z.string().optional().describe('Filter to this page; omit to list all pages'),
      }),
      execute: async ({ pageId }) => {
        const schema = await getFormSchema();
        if (!schema) return { error: 'Form not found' };
        const pages: any[] = schema.pages ?? [];
        const filtered = pageId ? pages.filter((p: any) => p.id === pageId) : pages;
        return {
          pages: filtered.map((p: any) => ({
            id: p.id,
            fields: (p.fields ?? []).map((f: any) => ({
              id: f.id,
              type: f.type,
              label: f.label,
              required: f.required ?? false,
            })),
          })),
        };
      },
    }),

    getField: tool({
      description:
        'Get full details of a specific field: placeholder, hint, options, validation, and which page it belongs to. Use before updating a field to see its current values.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
      }),
      execute: async ({ fieldId }) => {
        const schema = await getFormSchema();
        if (!schema) return { error: 'Form not found' };
        for (const page of (schema.pages ?? []) as any[]) {
          const field = (page.fields ?? []).find((f: any) => f.id === fieldId);
          if (field) {
            return {
              pageId: page.id,
              id: field.id,
              type: field.type,
              label: field.label,
              required: field.required ?? false,
              placeholder: field.placeholder ?? null,
              hint: field.hint ?? null,
              options: field.options ?? null,
              validation: field.validation ?? null,
            };
          }
        }
        return { error: `Field ${fieldId} not found` };
      },
    }),

    addField: tool({
      description:
        'Add a new field to a page. Use insertAfterFieldId to control position; pass null to append at the end.',
      inputSchema: z.object({
        pageId: z.string().describe('ID of the page to add the field to'),
        insertAfterFieldId: z.string().nullable().describe('Insert after this field ID; null to append'),
        fieldType: z.enum(['text', 'textarea', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'file']),
        label: z.string().describe('The question/label shown to users'),
        required: z.boolean(),
        placeholder: z.string().nullable(),
        options: z.array(z.string()).nullable().describe('For select/radio/checkbox only; null otherwise'),
      }),
      execute: async (args) => ({ type: 'ADD_FIELD' as const, ...args }),
    }),

    updateField: tool({
      description: 'Update one or more properties of an existing field. Only include properties you want to change.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
        updates: z.object({
          label: z.string().optional(),
          required: z.boolean().optional(),
          placeholder: z.string().optional(),
          hint: z.string().optional(),
          options: z.array(z.string()).optional(),
        }),
      }),
      execute: async (args) => ({ type: 'UPDATE_FIELD' as const, ...args }),
    }),

    removeField: tool({
      description: 'Remove a field from the form.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
      }),
      execute: async (args) => ({ type: 'REMOVE_FIELD' as const, ...args }),
    }),

    reorderFields: tool({
      description: 'Reorder fields on a page. Provide all field IDs for that page in the desired order.',
      inputSchema: z.object({
        pageId: z.string(),
        fieldIds: z.array(z.string()).describe('All field IDs in the new desired order'),
      }),
      execute: async (args) => ({ type: 'REORDER_FIELDS' as const, ...args }),
    }),

    updateLayout: tool({
      description: 'Update the form intro content (HTML) or the CTA button label.',
      inputSchema: z.object({
        content: z.string().optional().describe('HTML intro: <h1> title + <p> description only'),
        customCTAButtonName: z.string().optional().describe('Short CTA button label, max 4 words'),
      }),
      execute: async (args) => ({ type: 'UPDATE_LAYOUT' as const, ...args }),
    }),
  };
}

export type FormOperation = 
  | { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null }
  | { type: 'UPDATE_FIELD'; fieldId: string; updates: { label?: string; required?: boolean; placeholder?: string; hint?: string; options?: string[] } }
  | { type: 'REMOVE_FIELD'; fieldId: string }
  | { type: 'REORDER_FIELDS'; pageId: string; fieldIds: string[] }
  | { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/backend && pnpm test:unit --run src/lib/__tests__/aiFormEditTools.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "refactor(ai): rewrite aiFormEditTools as factory with live DB read tools"
```

---

### Task 2: Update `aiChatService.ts`

**Files:**
- Modify: `apps/backend/src/services/aiChatService.ts`

- [ ] **Step 1: Replace `buildStreamForConversation` with `buildChatStream`**

Keep all the CRUD functions unchanged (`createConversation`, `listConversations`, `getConversation`, `deleteConversation`, `renameConversation`, `saveUserMessage`, `saveAssistantMessage`, `autoGenerateTitle`). Replace only `buildStreamForConversation`:

```typescript
// apps/backend/src/services/aiChatService.ts
// Add this import at the top (replace the old formEditTools import):
import { createFormEditTools } from '../lib/aiFormEditTools.js';

// Replace buildStreamForConversation with:
export async function buildChatStream(
  conversationId: string,
  userId: string,
  currentPageId?: string,
) {
  const conv = await prisma.aIChatConversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conv) throw new Error('Conversation not found');

  const history = await prisma.aIChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  const systemPrompt = `You are an AI assistant that helps users edit their form.
Use listFields to understand the current form structure before making changes.
Use getField to read a field's full details before updating it.
The user is currently editing page: ${currentPageId ?? 'the first page'}.
Make only the changes the user requests. Confirm what you did in your final text response.`;

  const messages = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const tools = createFormEditTools(conv.formId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = streamText({
    model: getPrimaryModel(),
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(8),
  }) as unknown as { fullStream: AsyncIterable<any>; text: Promise<string>; usage: Promise<{ totalTokens: number }> };

  return stream;
}
```

- [ ] **Step 2: Remove the old `buildStreamForConversation` export**

Delete the entire `buildStreamForConversation` function body (lines that start the old function). The new `buildChatStream` replaces it entirely.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/backend && pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/services/aiChatService.ts
git commit -m "refactor(ai): replace buildStreamForConversation with buildChatStream (no form state param)"
```

---

### Task 3: New `POST /api/ai/chat` route

**Files:**
- Create: `apps/backend/src/routes/aiChat.ts`
- Create: `apps/backend/src/routes/__tests__/aiChat.test.ts`

- [ ] **Step 1: Write failing route tests**

```typescript
// apps/backend/src/routes/__tests__/aiChat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../services/aiChatService.js', () => ({
  saveUserMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
  getConversation: vi.fn().mockResolvedValue({ messageCount: 1, formId: 'form-1' }),
  buildChatStream: vi.fn(),
  saveAssistantMessage: vi.fn().mockResolvedValue({ id: 'msg-2' }),
  autoGenerateTitle: vi.fn(),
}));

vi.mock('../../services/aiUsageService.js', () => ({
  checkAITokenBudget: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 50000 }),
  recordAITokenUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/better-auth-middleware.js', () => ({
  requireAuth: vi.fn(),
  requireOrganizationMembership: vi.fn().mockResolvedValue({}),
  createBetterAuthContext: vi.fn().mockResolvedValue({ user: { id: 'user-1' }, isAuthenticated: true }),
}));

import { aiChatRouter } from '../aiChat.js';
import { buildChatStream, saveAssistantMessage } from '../../services/aiChatService.js';

function makeAsyncIterable(parts: object[]): AsyncIterable<object> {
  return { [Symbol.asyncIterator]: async function* () { for (const p of parts) yield p; } };
}

describe('POST /chat', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', aiChatRouter);
    vi.clearAllMocks();
  });

  it('streams text-delta chunks as NDJSON', async () => {
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'text-delta', textDelta: 'Hello ' },
        { type: 'text-delta', textDelta: 'world' },
        { type: 'finish', totalUsage: { totalTokens: 42 } },
      ]),
    });

    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Hi' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/ndjson/);
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'text', delta: 'Hello ' });
    expect(lines[1]).toEqual({ type: 'text', delta: 'world' });
    expect(lines[2]).toMatchObject({ type: 'done' });
  });

  it('streams operation chunks', async () => {
    const op = { type: 'ADD_FIELD', pageId: 'page-1', fieldType: 'text', label: 'Name', required: true, insertAfterFieldId: null, placeholder: null, options: null };
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-result', output: op },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });

    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Add a name field' });

    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'operation', op });
    expect(lines[1]).toMatchObject({ type: 'done', messageId: 'msg-2' });
  });

  it('returns error chunk when token budget exceeded', async () => {
    const { checkAITokenBudget } = await import('../../services/aiUsageService.js');
    (checkAITokenBudget as any).mockResolvedValue({ allowed: false, used: 50000, limit: 50000 });

    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Hi' });

    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0].type).toBe('error');
    expect(lines[0].error).toMatch(/token limit/i);
  });

  it('returns error chunk when stream throws', async () => {
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([]),
    });
    (buildChatStream as any).mockRejectedValue(new Error('AI unavailable'));

    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Hi' });

    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0].type).toBe('error');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/backend && pnpm test:unit --run src/routes/__tests__/aiChat.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the route**

```typescript
// apps/backend/src/routes/aiChat.ts
import { Router } from 'express';
import {
  requireAuth,
  requireOrganizationMembership,
  createBetterAuthContext,
} from '../middleware/better-auth-middleware.js';
import {
  saveUserMessage,
  getConversation,
  buildChatStream,
  saveAssistantMessage,
  autoGenerateTitle,
} from '../services/aiChatService.js';
import {
  checkAITokenBudget,
  recordAITokenUsage,
} from '../services/aiUsageService.js';
import { logger } from '../lib/logger.js';
import type { FormOperation } from '../lib/aiFormEditTools.js';

export const aiChatRouter = Router();

aiChatRouter.post('/chat', async (req, res) => {
  const auth = await createBetterAuthContext(req);

  try {
    requireAuth(auth);
  } catch {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { conversationId, organizationId, content, currentPageId } = req.body as {
    conversationId: string;
    organizationId: string;
    content: string;
    currentPageId?: string;
  };

  if (!conversationId || !organizationId || !content?.trim()) {
    res.status(400).json({ error: 'conversationId, organizationId, and content are required' });
    return;
  }

  try {
    await requireOrganizationMembership(auth, organizationId);
  } catch {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  function write(chunk: object) {
    res.write(JSON.stringify(chunk) + '\n');
  }

  try {
    const budget = await checkAITokenBudget(organizationId);
    if (!budget.allowed) {
      write({ type: 'error', error: `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} used). Upgrade your plan to continue.` });
      res.end();
      return;
    }

    await saveUserMessage(conversationId, content);

    // Auto-title on first message (fire-and-forget)
    const conv = await getConversation(conversationId, auth.user!.id);
    if (conv && conv.messageCount <= 1) {
      autoGenerateTitle(conversationId, content);
    }

    const stream = await buildChatStream(conversationId, auth.user!.id, currentPageId);

    const operations: FormOperation[] = [];
    let fullText = '';

    for await (const part of stream.fullStream) {
      if (part.type === 'text-delta') {
        const delta: string = (part as any).textDelta ?? (part as any).text ?? '';
        fullText += delta;
        write({ type: 'text', delta });
      }

      if (part.type === 'tool-result') {
        const op = (part as any).output as FormOperation | undefined;
        if (op) {
          operations.push(op);
          write({ type: 'operation', op });
        }
      }

      if (part.type === 'finish') {
        const tokensUsed: number =
          (part as any).totalUsage?.totalTokens ??
          (part as any).usage?.totalTokens ?? 0;
        const saved = await saveAssistantMessage(conversationId, fullText, operations, tokensUsed);
        await recordAITokenUsage(organizationId, tokensUsed);
        write({ type: 'done', messageId: saved.id });
        res.end();
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ errMsg, conversationId }, 'AI chat stream failed');
    write({ type: 'error', error: 'AI processing failed. Please try again.' });
    res.end();
  }
});
```

- [ ] **Step 4: Verify `createBetterAuthContext` is exported from middleware**

```bash
grep -n "createBetterAuthContext" apps/backend/src/middleware/better-auth-middleware.ts
```

Expected: line showing `export async function createBetterAuthContext`. This already exists — no changes needed.

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd apps/backend && pnpm test:unit --run src/routes/__tests__/aiChat.test.ts
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts apps/backend/src/routes/__tests__/aiChat.test.ts apps/backend/src/middleware/better-auth-middleware.ts
git commit -m "feat(ai): add POST /api/ai/chat NDJSON streaming route"
```

---

### Task 4: Register route + clean up GraphQL

**Files:**
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/graphql/schema.ts`
- Modify: `apps/backend/src/graphql/resolvers/aiChat.ts`
- Modify: `apps/backend/src/graphql/resolvers/__tests__/aiChat.test.ts`

- [ ] **Step 1: Register the route in `index.ts`**

Find the block that registers other `/api` routes (around line 199-201) and add:

```typescript
import { aiChatRouter } from './routes/aiChat.js';
// ...
app.use('/api', aiChatRouter);   // add alongside chargebeeWebhookRouter
```

- [ ] **Step 2: Remove Subscription from GraphQL schema**

In `apps/backend/src/graphql/schema.ts`, find and delete:
1. The entire `type Subscription { ... }` block (3 lines including the `aiChatStream` field)
2. The entire `type AIChatChunk { ... }` type definition
3. The `sendAIChatUserMessage` mutation line from the Mutation type

- [ ] **Step 3: Remove Subscription resolver + sendAIChatUserMessage from `aiChat.ts` resolver**

In `apps/backend/src/graphql/resolvers/aiChat.ts`:
- Remove the entire `Subscription: { aiChatStream: { ... } }` block
- Remove the `sendAIChatUserMessage` entry from `Mutation`
- Remove imports for `buildStreamForConversation`, `checkAITokenBudget`, `recordAITokenUsage`, `saveUserMessage` (these are now used by the route only)

The resolver file should now only have `Query` (listAIChatConversations, getAIChatConversation) and `Mutation` (createAIChatConversation, deleteAIChatConversation, renameAIChatConversation).

- [ ] **Step 4: Update resolver tests — remove deleted test cases**

In `apps/backend/src/graphql/resolvers/__tests__/aiChat.test.ts`, remove the `sendAIChatUserMessage` test (it no longer exists as a resolver). Keep the query and remaining mutation tests.

- [ ] **Step 5: Verify TypeScript + tests**

```bash
cd apps/backend && pnpm exec tsc --noEmit && pnpm test:unit --run src/graphql/resolvers/__tests__/aiChat.test.ts
```

Expected: No TS errors, remaining tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/index.ts apps/backend/src/graphql/schema.ts apps/backend/src/graphql/resolvers/aiChat.ts apps/backend/src/graphql/resolvers/__tests__/aiChat.test.ts
git commit -m "feat(ai): register /api/ai/chat route; remove aiChatStream subscription from GraphQL"
```

---

## Phase 2 — Frontend Core Logic

### Task 5: `applyAIOp` pure function

**Files:**
- Create: `apps/form-app/src/lib/applyAIOp.ts`
- Create: `apps/form-app/src/lib/__tests__/applyAIOp.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/form-app/src/lib/__tests__/applyAIOp.test.ts
import { describe, it, expect, vi } from 'vitest';
import { applyAIOp } from '../applyAIOp';
import { FieldType } from '@dculus/types';

function makeStore(overrides = {}) {
  return {
    pages: [
      {
        id: 'page-1',
        fields: [
          { id: 'f-1', type: FieldType.TEXT_INPUT_FIELD, label: 'Name', required: true },
          { id: 'f-2', type: FieldType.SELECT_FIELD, label: 'Country', required: false },
        ],
      },
      {
        id: 'page-2',
        fields: [
          { id: 'f-3', type: FieldType.EMAIL_FIELD, label: 'Email', required: true },
        ],
      },
    ],
    addField: vi.fn(),
    addFieldAtIndex: vi.fn(),
    updateField: vi.fn(),
    removeField: vi.fn(),
    reorderFields: vi.fn(),
    updateLayout: vi.fn(),
    ...overrides,
  };
}

describe('applyAIOp — ADD_FIELD', () => {
  it('appends to page-1 when insertAfterFieldId is null', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: null, fieldType: 'text', label: 'Last Name', required: false, placeholder: null, options: null }, store as any);
    expect(store.addField).toHaveBeenCalledWith('page-1', FieldType.TEXT_INPUT_FIELD, expect.objectContaining({ label: 'Last Name', required: false }));
  });

  it('inserts at correct index when insertAfterFieldId is provided', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: 'f-1', fieldType: 'email', label: 'Email', required: true, placeholder: null, options: null }, store as any);
    // f-1 is at index 0, so insert at index 1
    expect(store.addFieldAtIndex).toHaveBeenCalledWith('page-1', FieldType.EMAIL_FIELD, expect.objectContaining({ label: 'Email' }), 1);
  });

  it('falls back to pages[0] when pageId not found', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'nonexistent', insertAfterFieldId: null, fieldType: 'text', label: 'X', required: false, placeholder: null, options: null }, store as any);
    expect(store.addField).toHaveBeenCalledWith('page-1', FieldType.TEXT_INPUT_FIELD, expect.anything());
  });

  it('passes options for choice fields', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: null, fieldType: 'select', label: 'Size', required: false, placeholder: null, options: ['S', 'M', 'L'] }, store as any);
    expect(store.addField).toHaveBeenCalledWith('page-1', FieldType.SELECT_FIELD, expect.objectContaining({ options: ['S', 'M', 'L'] }));
  });
});

describe('applyAIOp — UPDATE_FIELD', () => {
  it('finds the page by fieldId and calls updateField', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_FIELD', fieldId: 'f-3', updates: { label: 'Work Email' } }, store as any);
    expect(store.updateField).toHaveBeenCalledWith('page-2', 'f-3', { label: 'Work Email' });
  });

  it('does nothing when fieldId not found', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_FIELD', fieldId: 'unknown', updates: { label: 'X' } }, store as any);
    expect(store.updateField).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — REMOVE_FIELD', () => {
  it('finds the page and removes the field', () => {
    const store = makeStore();
    applyAIOp({ type: 'REMOVE_FIELD', fieldId: 'f-2' }, store as any);
    expect(store.removeField).toHaveBeenCalledWith('page-1', 'f-2');
  });
});

describe('applyAIOp — REORDER_FIELDS', () => {
  it('calls reorderFields to move each field to its target index', () => {
    const store = makeStore();
    // Desired: f-2 first, then f-1
    applyAIOp({ type: 'REORDER_FIELDS', pageId: 'page-1', fieldIds: ['f-2', 'f-1'] }, store as any);
    expect(store.reorderFields).toHaveBeenCalled();
  });
});

describe('applyAIOp — UPDATE_LAYOUT', () => {
  it('passes only content and customCTAButtonName — strips type field', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_LAYOUT', content: '<h1>Hi</h1>', customCTAButtonName: 'Go' }, store as any);
    expect(store.updateLayout).toHaveBeenCalledWith({ content: '<h1>Hi</h1>', customCTAButtonName: 'Go' });
    // The type field must NOT be passed
    const callArg = (store.updateLayout as any).mock.calls[0][0];
    expect(callArg).not.toHaveProperty('type');
  });

  it('omits undefined keys', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_LAYOUT', customCTAButtonName: 'Submit' }, store as any);
    const callArg = (store.updateLayout as any).mock.calls[0][0];
    expect(callArg).toEqual({ customCTAButtonName: 'Submit' });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/form-app && pnpm exec vitest run src/lib/__tests__/applyAIOp.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `applyAIOp.ts`**

```typescript
// apps/form-app/src/lib/applyAIOp.ts
import { FieldType } from '@dculus/types';
import type { FormBuilderStore } from '../store/types/store.types';
import type { FormOperation } from '../../../backend/src/lib/aiFormEditTools';

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

const CHOICE_TYPES = new Set([FieldType.SELECT_FIELD, FieldType.RADIO_FIELD, FieldType.CHECKBOX_FIELD]);

function findPageForField(store: Pick<FormBuilderStore, 'pages'>, fieldId: string): string | null {
  for (const page of store.pages as any[]) {
    if ((page.fields ?? []).some((f: any) => f.id === fieldId)) return page.id;
  }
  return null;
}

export function applyAIOp(op: any, store: Pick<FormBuilderStore, 'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField' | 'reorderFields' | 'updateLayout'>): void {
  if (!op?.type) return;

  switch (op.type) {
    case 'ADD_FIELD': {
      const targetPageId: string = (store.pages as any[]).find((p: any) => p.id === op.pageId)?.id
        ?? (store.pages as any[])[0]?.id;
      if (!targetPageId) return;

      const fieldType = AI_TYPE_MAP[op.fieldType] ?? FieldType.TEXT_INPUT_FIELD;
      const isChoice = CHOICE_TYPES.has(fieldType);
      const fieldData = {
        label: op.label,
        required: op.required ?? false,
        placeholder: op.placeholder ?? '',
        defaultValue: '',
        prefix: '',
        hint: '',
        ...(isChoice && { options: op.options ?? ['Option 1', 'Option 2'] }),
      };

      if (op.insertAfterFieldId) {
        const page = (store.pages as any[]).find((p: any) => p.id === targetPageId);
        const idx = (page?.fields ?? []).findIndex((f: any) => f.id === op.insertAfterFieldId);
        if (idx !== -1) {
          (store.addFieldAtIndex as any)(targetPageId, fieldType, fieldData, idx + 1);
          return;
        }
      }
      (store.addField as any)(targetPageId, fieldType, fieldData);
      break;
    }

    case 'UPDATE_FIELD': {
      const pageId = findPageForField(store, op.fieldId);
      if (!pageId) return;
      (store.updateField as any)(pageId, op.fieldId, op.updates);
      break;
    }

    case 'REMOVE_FIELD': {
      const pageId = findPageForField(store, op.fieldId);
      if (!pageId) return;
      (store.removeField as any)(pageId, op.fieldId);
      break;
    }

    case 'REORDER_FIELDS': {
      const page = (store.pages as any[]).find((p: any) => p.id === op.pageId);
      if (!page) return;
      const current: string[] = (page.fields ?? []).map((f: any) => f.id);
      const desired: string[] = op.fieldIds ?? [];
      for (let i = 0; i < desired.length; i++) {
        const fromIdx = current.indexOf(desired[i]);
        if (fromIdx !== -1 && fromIdx !== i) {
          (store.reorderFields as any)(op.pageId, fromIdx, i);
          const [moved] = current.splice(fromIdx, 1);
          current.splice(i, 0, moved);
        }
      }
      break;
    }

    case 'UPDATE_LAYOUT': {
      const updates: Record<string, unknown> = {};
      if (op.content !== undefined) updates.content = op.content;
      if (op.customCTAButtonName !== undefined) updates.customCTAButtonName = op.customCTAButtonName;
      (store.updateLayout as any)(updates);
      break;
    }
  }
}
```

> **Note on import:** The `FormOperation` type import from the backend is for reference only. In practice, use `any` or copy the type locally to avoid cross-app import issues. If the monorepo shares types via `@dculus/types`, move `FormOperation` there in a follow-up. For now, `op: any` is fine in `applyAIOp.ts` and the test.

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/form-app && pnpm exec vitest run src/lib/__tests__/applyAIOp.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/lib/applyAIOp.ts apps/form-app/src/lib/__tests__/applyAIOp.test.ts
git commit -m "feat(ai): add applyAIOp pure function with correct positioning and multi-page support"
```

---

### Task 6: `useAIStream` hook

**Files:**
- Create: `apps/form-app/src/hooks/useAIStream.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/form-app/src/hooks/useAIStream.ts
import { useState, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL as string;

export interface AIStreamCallbacks {
  onTextDelta: (delta: string) => void;
  onOperation: (op: unknown) => void;
  onDone: (messageId: string) => void;
  onError: (error: string) => void;
}

export function useAIStream(organizationId: string, callbacks: AIStreamCallbacks) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const sendMessage = useCallback(
    async (conversationId: string, content: string, currentPageId?: string) => {
      if (isStreaming) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      try {
        const response = await fetch(`${API_URL}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ conversationId, organizationId, content, currentPageId }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => ({}));
          callbacksRef.current.onError((body as any).error ?? 'Request failed');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as { type: string; delta?: string; op?: unknown; messageId?: string; error?: string };
              if (chunk.type === 'text') callbacksRef.current.onTextDelta(chunk.delta ?? '');
              if (chunk.type === 'operation') callbacksRef.current.onOperation(chunk.op);
              if (chunk.type === 'done') callbacksRef.current.onDone(chunk.messageId ?? '');
              if (chunk.type === 'error') callbacksRef.current.onError(chunk.error ?? 'Unknown error');
            } catch {
              // malformed line — skip
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          callbacksRef.current.onError('Stream failed. Please try again.');
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, organizationId]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isStreaming, sendMessage, cancel };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/form-app && pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/hooks/useAIStream.ts
git commit -m "feat(ai): add useAIStream hook — fetch-based NDJSON reader replacing WS subscription"
```

---

### Task 7: `useYjsUndoManager` hook

**Files:**
- Create: `apps/form-app/src/hooks/useYjsUndoManager.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/form-app/src/hooks/useYjsUndoManager.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { useFormBuilderStore } from '../store/useFormBuilderStore';

export function useYjsUndoManager() {
  const ydoc = useFormBuilderStore((state) => (state as any).ydoc as Y.Doc | null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    if (!ydoc) {
      undoManagerRef.current = null;
      setCanUndo(false);
      return;
    }

    const formSchemaMap = ydoc.getMap('formSchema');
    const manager = new Y.UndoManager(formSchemaMap, {
      captureTimeout: 60_000, // group all changes within 60 s into one undo step
    });

    manager.on('stack-item-added', () => setCanUndo(manager.undoStack.length > 0));
    manager.on('stack-item-popped', () => setCanUndo(manager.undoStack.length > 0));

    undoManagerRef.current = manager;

    return () => {
      manager.destroy();
      undoManagerRef.current = null;
      setCanUndo(false);
    };
  }, [ydoc]);

  // Call before first AI op in a session — breaks the current capture group
  // so AI changes land in their own undo step separate from the user's prior edits.
  const beginBatch = useCallback(() => {
    undoManagerRef.current?.stopCapturing();
  }, []);

  // Call before the next user message to clear the undo state for the new session.
  const clearBatch = useCallback(() => {
    undoManagerRef.current?.clear();
    setCanUndo(false);
  }, []);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
    setCanUndo((undoManagerRef.current?.undoStack.length ?? 0) > 0);
  }, []);

  return { canUndo, beginBatch, clearBatch, undo };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/form-app && pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/hooks/useYjsUndoManager.ts
git commit -m "feat(ai): add useYjsUndoManager hook — Y.js-native undo for AI operations"
```

---

## Phase 3 — Frontend Wire-up

### Task 8: Update `useAIChat.ts`

**Files:**
- Modify: `apps/form-app/src/hooks/useAIChat.ts`

- [ ] **Step 1: Rewrite `useAIChat.ts`**

Replace the entire file:

```typescript
// apps/form-app/src/hooks/useAIChat.ts
import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toastError } from '@dculus/ui';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import {
  LIST_AI_CHAT_CONVERSATIONS,
  GET_AI_CHAT_CONVERSATION,
  CREATE_AI_CHAT_CONVERSATION,
  DELETE_AI_CHAT_CONVERSATION,
  RENAME_AI_CHAT_CONVERSATION,
} from '../graphql/aiChat';
import { useAIStream } from './useAIStream';
import { useYjsUndoManager } from './useYjsUndoManager';
import { applyAIOp } from '../lib/applyAIOp';

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  operations?: object[] | null;
  createdAt: string;
  isStreaming?: boolean;
  streamingText?: string;
  streamingOps?: { type: string; label: string }[];
}

export function buildOpLabel(op: Record<string, unknown>): string {
  switch (op?.type) {
    case 'ADD_FIELD': return `Added "${(op.label as string) ?? 'field'}"`;
    case 'UPDATE_FIELD': return 'Updated field';
    case 'REMOVE_FIELD': return 'Removed field';
    case 'REORDER_FIELDS': return 'Reordered fields';
    case 'UPDATE_LAYOUT': return 'Updated layout';
    default: return 'Changed form';
  }
}

export function useAIChat({
  formId,
  organizationId,
}: {
  formId: string;
  organizationId: string;
}) {
  const store = useFormBuilderStore();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<AIChatMessage | null>(null);

  const { canUndo, beginBatch, clearBatch, undo } = useYjsUndoManager();

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

  const [createConvMutation] = useMutation(CREATE_AI_CHAT_CONVERSATION);
  const [deleteConvMutation] = useMutation(DELETE_AI_CHAT_CONVERSATION);
  const [renameConvMutation] = useMutation(RENAME_AI_CHAT_CONVERSATION);

  const { isStreaming: streamActive, sendMessage: streamSend, cancel } = useAIStream(
    organizationId,
    {
      onTextDelta: (delta) => {
        setStreamingMessage((prev) =>
          prev ? { ...prev, streamingText: (prev.streamingText ?? '') + delta } : null
        );
      },
      onOperation: (op) => {
        beginBatch();
        applyAIOp(op, store);
        const label = buildOpLabel(op as Record<string, unknown>);
        setStreamingMessage((prev) =>
          prev
            ? { ...prev, streamingOps: [...(prev.streamingOps ?? []), { type: (op as any).type, label }] }
            : null
        );
      },
      onDone: (_messageId) => {
        setIsStreaming(false);
        setStreamingMessage(null);
        refetchActiveConversation();
        refetchConversations();
      },
      onError: (error) => {
        setIsStreaming(false);
        setStreamingMessage(null);
        const isLimit = error.includes('token limit');
        toastError('AI Error', isLimit ? error : 'AI processing failed. Please try again.');
      },
    }
  );

  const createConversation = useCallback(async () => {
    const { data } = await createConvMutation({ variables: { formId, organizationId } });
    const conv = data?.createAIChatConversation;
    if (conv) {
      setActiveConversationId(conv.id);
      refetchConversations();
    }
    return conv ?? null;
  }, [formId, organizationId, createConvMutation, refetchConversations]);

  const selectConversation = useCallback((id: string) => {
    setIsStreaming(false);
    setStreamingMessage(null);
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
    async (content: string) => {
      if (!activeConversationId || streamActive) return;
      clearBatch();
      const currentPageId: string | undefined = (store.pages as any[])[0]?.id;

      setStreamingMessage({
        id: 'streaming',
        role: 'assistant',
        content: '',
        streamingText: '',
        streamingOps: [],
        isStreaming: true,
        createdAt: new Date().toISOString(),
      });
      setIsStreaming(true);

      await streamSend(activeConversationId, content, currentPageId);
    },
    [activeConversationId, streamActive, clearBatch, store.pages, streamSend]
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
    canUndo,
    undo,
    cancel,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/form-app && pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/hooks/useAIChat.ts
git commit -m "refactor(ai): rewire useAIChat to use useAIStream + useYjsUndoManager; remove WS subscription"
```

---

### Task 9: Update `AIEditDrawer.tsx`

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Rewrite `AIEditDrawer.tsx`**

Replace the entire file:

```typescript
// apps/form-app/src/components/form-builder/AIEditDrawer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, Plus, Trash2, ChevronDown, X, Undo2 } from 'lucide-react';
import { cn } from '@dculus/utils';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useAIChat, type AIChatMessage, buildOpLabel } from '../../hooks/useAIChat';

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
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {label}
    </span>
  );
}

function AssistantBubble({ message }: { message: AIChatMessage }) {
  const displayText = message.isStreaming ? message.streamingText : message.content;
  const ops = message.isStreaming ? message.streamingOps : undefined;
  const savedOps = !message.isStreaming && message.operations
    ? (message.operations as Record<string, unknown>[])
    : null;

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] items-start gap-2">
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
              {ops.map((op, i) => <OperationChip key={i} label={op.label} />)}
            </div>
          )}
          {savedOps && savedOps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedOps.map((op, i) => <OperationChip key={i} label={buildOpLabel(op)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
            <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: `${i * 150}ms` }} />
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

  const {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isStreaming,
    canUndo,
    undo,
    cancel,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
  } = useAIChat({ formId, organizationId });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    if (conversations.length === 0) {
      createConversation();
    } else if (!activeConversationId && conversations.length > 0) {
      selectConversation(conversations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, conversations.length]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !activeConversationId) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isStreaming, activeConversationId, sendMessage]);

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

        {canUndo && (
          <button
            onClick={undo}
            title="Undo AI changes"
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 max-w-[140px] gap-1 px-2 text-xs">
              <span className="truncate">{activeConversation?.title ?? t('newChat')}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="gap-2 text-xs" onClick={() => createConversation()}>
              <Plus className="h-3.5 w-3.5" />
              {t('newChat')}
            </DropdownMenuItem>
            {conversations.length > 0 && <DropdownMenuSeparator />}
            {conversations.map((conv: { id: string; title: string }) => (
              <DropdownMenuItem
                key={conv.id}
                className={cn('group text-xs', conv.id === activeConversationId && 'bg-accent')}
                onClick={() => selectConversation(conv.id)}
              >
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  className="ml-2 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={onClose}
          aria-label="Close AI assistant"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !isStreaming && (
          <p className="px-4 pt-8 text-center text-xs text-muted-foreground">{t('emptyState')}</p>
        )}
        {messages.map((msg) =>
          msg.role === 'user'
            ? <UserBubble key={msg.id} message={msg} />
            : <AssistantBubble key={msg.id} message={msg} />
        )}
        {isStreaming && !messages.some((m) => m.isStreaming) && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className={cn(
          'flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm',
          'transition-all duration-150 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20'
        )}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('inputPlaceholder')}
            disabled={isStreaming || !activeConversationId}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground',
              'max-h-28 overflow-y-auto py-1 leading-5',
              'disabled:opacity-50'
            )}
            style={{ minHeight: '24px' }}
          />
          {isStreaming ? (
            <button
              onClick={cancel}
              aria-label="Cancel"
              className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !activeConversationId}
              aria-label={t('send')}
              className={cn(
                'mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                'bg-primary text-primary-foreground',
                'transition-colors hover:bg-primary/90',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIEditDrawer;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/form-app && pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai): add undo button to AIEditDrawer; remove getFormState; add cancel during stream"
```

---

### Task 10: Clean up GraphQL ops + final verification

**Files:**
- Modify: `apps/form-app/src/graphql/aiChat.ts`

- [ ] **Step 1: Remove WS subscription + sendUserMessage from GraphQL ops**

Replace the file contents — keep only the 5 conversation CRUD operations:

```typescript
// apps/form-app/src/graphql/aiChat.ts
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
```

- [ ] **Step 2: Full type-check across all packages**

```bash
pnpm type-check
```

Expected: No errors

- [ ] **Step 3: Run all backend unit tests**

```bash
pnpm test:unit
```

Expected: All passing (new route tests + tool tests + existing tests)

- [ ] **Step 4: Build check**

```bash
pnpm build
```

Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/graphql/aiChat.ts
git commit -m "chore(ai): remove AI_CHAT_STREAM subscription and SEND_AI_CHAT_USER_MESSAGE from frontend GraphQL"
```

---

## Verification Checklist

After all phases complete, manually verify in the browser:

- [ ] Open form builder → press `Ctrl+K` / `Cmd+K` → AI drawer opens
- [ ] Type "add an email field" → text streams in, green chip appears, field appears in form
- [ ] Type "make the email field required" → field updates correctly
- [ ] After AI responds → "Undo" button is visible in header
- [ ] Click Undo → all AI changes revert
- [ ] Type a second message → Undo button disappears (cleared for new batch)
- [ ] Type "add a select field for country with options: USA, UK, Canada" → options appear on the field
- [ ] On a multi-page form: AI correctly targets the right page
- [ ] Open browser network tab → verify `/api/ai/chat` POST streams as NDJSON (no WS connection for AI)
- [ ] Cancel mid-stream by clicking X → stream stops
