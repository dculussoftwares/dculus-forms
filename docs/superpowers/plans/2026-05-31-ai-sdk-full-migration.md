# AI SDK Full Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom NDJSON streaming with Vercel AI SDK's native patterns — `ToolLoopAgent`, `toUIMessageStreamResponse`, `useChat`, typed tool part rendering, UIMessage DB storage.

**Architecture:** `ToolLoopAgent` on the backend streams via `toUIMessageStreamResponse` (Express-bridged via `Readable.fromWeb`). The frontend uses `useChat` from `@ai-sdk/react` with `DefaultChatTransport`. A `useEffect` watches `message.parts` for `output-available` mutation tool results and calls `applyAIOp` to sync the Y.js store.

**Tech Stack:** `ai@6.0.191` (backend), `@ai-sdk/react` (frontend, new), Prisma, Apollo Client, Vitest, Express.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/backend/prisma/schema.prisma` | Modify | Add `data Json` to AIChatMessage, drop `operations`, add AIUsage `@@unique` |
| `apps/backend/src/graphql/schema.ts` | Modify | Add `data: JSON` to AIChatMessage GQL type, remove `operations` |
| `apps/backend/src/lib/aiFormEditTools.ts` | Modify | Accept schema arg, remove per-tool DB reads |
| `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts` | Modify | Remove Prisma mocks, pass schema directly |
| `apps/backend/src/lib/formEditAgent.ts` | Create | ToolLoopAgent factory + type export |
| `apps/backend/src/services/aiChatService.ts` | Modify | Replace buildChatStream/save with UIMessage load/save |
| `apps/backend/src/services/__tests__/aiChatService.test.ts` | Modify | Test new load/save functions |
| `apps/backend/src/services/aiUsageService.ts` | Modify | Single upsert via composite unique key |
| `apps/backend/src/routes/aiChat.ts` | Modify | Full rewrite: agent.stream + Express bridge |
| `apps/backend/src/routes/__tests__/aiChat.test.ts` | Modify | New route tests |
| `apps/form-app/package.json` | Modify | Add `@ai-sdk/react` |
| `apps/form-app/src/lib/aiAgentTypes.ts` | Create | `FormEditAgentUIMessage` type (typed tool parts) |
| `apps/form-app/src/graphql/aiChat.ts` | Modify | Add `data` field to GET_AI_CHAT_CONVERSATION, remove `operations` |
| `apps/form-app/src/hooks/useAIChat.ts` | Modify | Rewrite with useChat |
| `apps/form-app/src/hooks/useAIStream.ts` | Delete | Replaced by useChat |
| `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx` | Create | Chip for all 9 mutation tools |
| `apps/form-app/src/components/form-builder/tool-parts/ListFieldsToolPart.tsx` | Create | Scan card for listFields |
| `apps/form-app/src/components/form-builder/tool-parts/GetFieldToolPart.tsx` | Create | Detail card for getField |
| `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` | Modify | Parts-based rendering, remove stream state |

---

## Task 1: DB Migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/src/graphql/schema.ts`

- [ ] **Step 1: Update Prisma schema**

In `apps/backend/prisma/schema.prisma`, find `model AIChatMessage` and `model AIUsage` and replace them:

```prisma
model AIChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String
  content        String   @db.Text
  data           Json
  tokensUsed     Int      @default(0)
  createdAt      DateTime @default(now())

  conversation AIChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("ai_chat_message")
}

model AIUsage {
  id             String   @id @default(cuid())
  organizationId String
  tokensUsed     Int      @default(0)
  periodStart    DateTime
  periodEnd      DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, periodStart])
  @@map("ai_usage")
}
```

- [ ] **Step 2: Create migration**

```bash
cd apps/backend && pnpm db:generate
```

Then create the migration manually so we can add the backfill SQL:

```bash
cd apps/backend && npx prisma migrate dev --name ai_sdk_uimessage_storage --create-only
```

- [ ] **Step 3: Add backfill SQL to the migration file**

Open the newly created migration file at `apps/backend/prisma/migrations/*/migration.sql`. After the `ALTER TABLE "ai_chat_message" ADD COLUMN "data" JSONB` line, add:

```sql
-- Backfill data column from existing role + content
UPDATE "ai_chat_message"
SET data = jsonb_build_object(
  'id', id,
  'role', role,
  'content', content,
  'createdAt', created_at,
  'parts', jsonb_build_array(
    jsonb_build_object('type', 'text', 'text', content)
  )
)
WHERE data IS NULL;
```

Then also ensure `ALTER TABLE "ai_chat_message" DROP COLUMN "operations"` is present (Prisma generates this from removing the field).

- [ ] **Step 4: Run migration**

```bash
cd apps/backend && npx prisma migrate dev
```

Expected: Migration applied successfully. No errors.

- [ ] **Step 5: Regenerate Prisma client**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm db:generate
```

- [ ] **Step 6: Update GraphQL schema type for AIChatMessage**

In `apps/backend/src/graphql/schema.ts`, find the `type AIChatMessage` block and replace it:

```graphql
type AIChatMessage {
  id: ID!
  conversationId: ID!
  role: String!
  content: String!
  data: JSON!
  tokensUsed: Int!
  createdAt: String!
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/prisma/ apps/backend/src/graphql/schema.ts
git commit -m "feat(db): add UIMessage data column to AIChatMessage, add AIUsage composite unique"
```

---

## Task 2: Refactor `aiFormEditTools.ts` — Accept Schema Arg

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`
- Modify: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Update the failing tests first**

Replace the entire content of `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`:

```typescript
// apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
import { describe, it, expect } from 'vitest';
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

describe('createFormEditTools', () => {
  it('returns all 11 tools', () => {
    const tools = createFormEditTools(mockSchema);
    expect(Object.keys(tools)).toEqual([
      'listFields', 'getField', 'addField', 'updateField',
      'removeField', 'reorderFields', 'updateLayout',
      'renamePage', 'reorderPages', 'addPage', 'removePage',
    ]);
  });
});

describe('listFields', () => {
  it('returns all pages with field summaries when no pageId given', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].fields).toHaveLength(2);
    expect(result.pages[0].fields[0]).toEqual({ id: 'f-1', type: 'TEXT_INPUT_FIELD', label: 'Name', required: true });
  });

  it('filters to a specific page when pageId given', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.listFields.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].id).toBe('page-2');
  });

  it('returns empty pages array for empty schema', async () => {
    const tools = createFormEditTools({ pages: [] });
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages).toHaveLength(0);
  });
});

describe('getField', () => {
  it('returns full field details including pageId', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.getField.execute!({ fieldId: 'f-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({ id: 'f-2', type: 'SELECT_FIELD', label: 'Country', pageId: 'page-1', options: ['USA', 'UK'] });
  });

  it('returns error for unknown fieldId', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.getField.execute!({ fieldId: 'unknown' }, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('error');
  });
});

describe('addField', () => {
  it('returns ADD_FIELD op with all inputs', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.addField.execute!({
      pageId: 'page-1', insertAfterFieldId: 'f-1', fieldType: 'text',
      label: 'Last Name', required: false, placeholder: null, options: null,
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: 'f-1', fieldType: 'text', label: 'Last Name', required: false, placeholder: null, options: null });
  });
});

describe('updateField', () => {
  it('returns UPDATE_FIELD op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.updateField.execute!({ fieldId: 'f-1', updates: { label: 'Full Name', required: true } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELD', fieldId: 'f-1', updates: { label: 'Full Name', required: true } });
  });

  it('returns UPDATE_FIELD op with validation object', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.updateField.execute!({ fieldId: 'f-1', updates: { validation: { minLength: 2, maxLength: 50 } } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELD', fieldId: 'f-1', updates: { validation: { minLength: 2, maxLength: 50 } } });
  });

  it('returns UPDATE_FIELD op with min/max for number field', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.updateField.execute!({ fieldId: 'f-1', updates: { min: 0, max: 100 } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELD', fieldId: 'f-1', updates: { min: 0, max: 100 } });
  });
});

describe('removeField', () => {
  it('returns REMOVE_FIELD op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.removeField.execute!({ fieldId: 'f-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REMOVE_FIELD', fieldId: 'f-2' });
  });
});

describe('reorderFields', () => {
  it('returns REORDER_FIELDS op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.reorderFields.execute!({ pageId: 'page-1', fieldIds: ['f-2', 'f-1'] }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REORDER_FIELDS', pageId: 'page-1', fieldIds: ['f-2', 'f-1'] });
  });
});

describe('updateLayout', () => {
  it('returns UPDATE_LAYOUT op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.updateLayout.execute!({ content: '<h1>Hello</h1>', customCTAButtonName: 'Submit' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_LAYOUT', content: '<h1>Hello</h1>', customCTAButtonName: 'Submit' });
  });
});

describe('renamePage', () => {
  it('returns RENAME_PAGE op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.renamePage.execute!({ pageId: 'page-1', newTitle: 'Contact Details' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'RENAME_PAGE', pageId: 'page-1', newTitle: 'Contact Details' });
  });
});

describe('reorderPages', () => {
  it('returns REORDER_PAGES op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.reorderPages.execute!({ pageIds: ['page-2', 'page-1'] }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REORDER_PAGES', pageIds: ['page-2', 'page-1'] });
  });
});

describe('addPage', () => {
  it('returns ADD_PAGE op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await (tools as any).addPage.execute!({ title: 'Step 2', insertAfterPageId: null }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'ADD_PAGE', title: 'Step 2', insertAfterPageId: null });
  });
});

describe('removePage', () => {
  it('returns REMOVE_PAGE op when multiple pages exist', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await (tools as any).removePage.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REMOVE_PAGE', pageId: 'page-2' });
  });

  it('returns error when only one page exists', async () => {
    const tools = createFormEditTools({ pages: [mockSchema.pages[0]] });
    const result = await (tools as any).removePage.execute!({ pageId: 'page-1' }, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('error');
    expect((result as any).error).toMatch(/last page/i);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit -- --reporter=verbose apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
```

Expected: Failures because `createFormEditTools` still expects `formId: string`.

- [ ] **Step 3: Rewrite `aiFormEditTools.ts`**

Replace the entire file content of `apps/backend/src/lib/aiFormEditTools.ts`:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export function createFormEditTools(schema: { pages: any[] }) {
  return {
    listFields: tool({
      description:
        'List all fields in the form with their id, type, label, and required flag. Filter to a specific page with pageId. Call this before making edits to understand the current structure.',
      inputSchema: z.object({
        pageId: z.string().optional().describe('Filter to this page; omit to list all pages'),
      }),
      execute: async ({ pageId }) => {
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
      description: 'Update one or more properties of an existing field. Only include properties you want to change. For text/textarea fields use updates.validation.minLength/maxLength. For number fields use updates.min/updates.max. For date fields use updates.minDate/updates.maxDate. For checkbox fields use updates.validation.minSelections/maxSelections.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
        updates: z.object({
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

    renamePage: tool({
      description: 'Rename a page. Get the pageId from listFields.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID from listFields'),
        newTitle: z.string().max(50).describe('New title for the page'),
      }),
      execute: async (args) => ({ type: 'RENAME_PAGE' as const, ...args }),
    }),

    reorderPages: tool({
      description: 'Reorder pages. Provide ALL page IDs in the desired new order.',
      inputSchema: z.object({
        pageIds: z.array(z.string()).describe('All page IDs in the desired order'),
      }),
      execute: async (args) => ({ type: 'REORDER_PAGES' as const, ...args }),
    }),

    addPage: tool({
      description:
        'Add a new empty page to the form. insertAfterPageId: pass a page ID to insert after that page, or null to append at the end.',
      inputSchema: z.object({
        title: z.string().max(50).describe('Title for the new page'),
        insertAfterPageId: z.string().nullable().describe('Insert after this page ID; null to append at end'),
      }),
      execute: async (args) => ({ type: 'ADD_PAGE' as const, ...args }),
    }),

    removePage: tool({
      description:
        'Remove a page and ALL its fields permanently. Cannot remove the last remaining page.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID from listFields'),
      }),
      execute: async ({ pageId }) => {
        if ((schema.pages ?? []).length <= 1) return { error: 'Cannot remove the last page' };
        return { type: 'REMOVE_PAGE' as const, pageId };
      },
    }),
  };
}

export type FormOperation =
  | { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null }
  | { type: 'UPDATE_FIELD'; fieldId: string; updates: { label?: string; required?: boolean; placeholder?: string; hint?: string; options?: string[]; validation?: { required?: boolean; minLength?: number | null; maxLength?: number | null; minSelections?: number | null; maxSelections?: number | null }; min?: number | null; max?: number | null; minDate?: string | null; maxDate?: string | null } }
  | { type: 'REMOVE_FIELD'; fieldId: string }
  | { type: 'REORDER_FIELDS'; pageId: string; fieldIds: string[] }
  | { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string }
  | { type: 'RENAME_PAGE'; pageId: string; newTitle: string }
  | { type: 'REORDER_PAGES'; pageIds: string[] }
  | { type: 'ADD_PAGE'; title: string; insertAfterPageId: string | null }
  | { type: 'REMOVE_PAGE'; pageId: string };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit -- --reporter=verbose apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "refactor(ai): createFormEditTools accepts pre-loaded schema instead of formId"
```

---

## Task 3: Create `formEditAgent.ts` (Backend)

**Files:**
- Create: `apps/backend/src/lib/formEditAgent.ts`

- [ ] **Step 1: Verify ToolLoopAgent and InferAgentUIMessage are exported**

```bash
grep -r "ToolLoopAgent\|InferAgentUIMessage" /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms/apps/backend/node_modules/ai/dist/index.d.ts | head -5
```

Expected: Both names appear in the type exports.

- [ ] **Step 2: Create `formEditAgent.ts`**

Create `apps/backend/src/lib/formEditAgent.ts`:

```typescript
import { ToolLoopAgent, InferAgentUIMessage, stepCountIs } from 'ai';
import { getPrimaryModel } from './ai.js';
import { createFormEditTools } from './aiFormEditTools.js';

export function createFormEditAgent(schema: { pages: any[] }) {
  const tools = createFormEditTools(schema);
  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(8),
    tools,
  });
}

// Type-level only — never called at runtime. Provides InferAgentUIMessage inference.
function _getProtoAgent() {
  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(8),
    tools: createFormEditTools({ pages: [] }),
  });
}

export type FormEditAgentUIMessage = InferAgentUIMessage<ReturnType<typeof _getProtoAgent>>;
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm type-check 2>&1 | grep -i "formEditAgent\|error" | head -20
```

Expected: No errors related to `formEditAgent.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/lib/formEditAgent.ts
git commit -m "feat(ai): add ToolLoopAgent factory and FormEditAgentUIMessage type"
```

---

## Task 4: Rewrite `aiChatService.ts` — UIMessage Load/Save

**Files:**
- Modify: `apps/backend/src/services/aiChatService.ts`
- Modify: `apps/backend/src/services/__tests__/aiChatService.test.ts`

- [ ] **Step 1: Write new tests**

Replace `apps/backend/src/services/__tests__/aiChatService.test.ts`:

```typescript
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
  stepCountIs: vi.fn((n: number) => ({ type: 'stepCount', count: n })),
}));

import { prisma } from '../../lib/prisma.js';
import {
  createConversation,
  listConversations,
  loadConversationMessages,
  saveConversationMessages,
  autoGenerateTitle,
} from '../aiChatService.js';

beforeEach(() => vi.clearAllMocks());

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

describe('loadConversationMessages', () => {
  it('returns UIMessage[] from data column', async () => {
    const uiMsg = { id: 'msg-1', role: 'user', content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] };
    (prisma.aIChatMessage.findMany as any).mockResolvedValue([{ data: uiMsg }]);
    const result = await loadConversationMessages('conv_1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(uiMsg);
  });

  it('returns empty array when no messages', async () => {
    (prisma.aIChatMessage.findMany as any).mockResolvedValue([]);
    const result = await loadConversationMessages('conv_1');
    expect(result).toEqual([]);
  });
});

describe('saveConversationMessages', () => {
  it('creates a DB row for each message', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({});
    (prisma.aIChatConversation.update as any).mockResolvedValue({});

    const messages = [
      { id: 'u1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      { id: 'a1', role: 'assistant', content: 'Hello!', parts: [{ type: 'text', text: 'Hello!' }] },
    ];

    await saveConversationMessages('conv_1', messages as any, 42);

    expect(prisma.aIChatMessage.create).toHaveBeenCalledTimes(2);
    // tokensUsed on last (assistant) message
    expect(prisma.aIChatMessage.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ role: 'assistant', tokensUsed: 42 }),
    });
    expect(prisma.aIChatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_1' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('sets tokensUsed=0 for user messages', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({});
    (prisma.aIChatConversation.update as any).mockResolvedValue({});

    const messages = [
      { id: 'u1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
    ];
    await saveConversationMessages('conv_1', messages as any, 100);

    expect(prisma.aIChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: 'user', tokensUsed: 0 }),
    });
  });
});

describe('autoGenerateTitle', () => {
  it('calls generateText and updates conversation title', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({ text: 'My Form Title' });
    (prisma.aIChatConversation.update as any).mockResolvedValue({});

    autoGenerateTitle('conv_1', 'Help me build a contact form');
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(prisma.aIChatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_1' },
      data: { title: 'My Form Title' },
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit -- --reporter=verbose apps/backend/src/services/__tests__/aiChatService.test.ts
```

Expected: Fails because `loadConversationMessages` and `saveConversationMessages` don't exist yet.

- [ ] **Step 3: Rewrite `aiChatService.ts`**

Replace the entire content of `apps/backend/src/services/aiChatService.ts`:

```typescript
import { generateText } from 'ai';
import type { UIMessage } from 'ai';
import { prisma } from '../lib/prisma.js';
import { getFastModel } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

export async function createConversation(
  formId: string,
  organizationId: string,
  userId: string
) {
  return prisma.aIChatConversation.create({
    data: { formId, organizationId, userId, title: 'New conversation' },
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
  const safeTitle = title.trim().slice(0, 100) || 'Untitled conversation';
  return prisma.aIChatConversation.update({ where: { id }, data: { title: safeTitle } });
}

export async function loadConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const messages = await prisma.aIChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { data: true },
  });
  return messages.map((m) => m.data as UIMessage);
}

export async function saveConversationMessages(
  conversationId: string,
  messages: UIMessage[],
  tokensUsed: number
): Promise<void> {
  const savePromises = messages.map((msg, i) => {
    const isLast = i === messages.length - 1;
    const textPart = (msg.parts as any[])?.find((p: any) => p.type === 'text');
    const textContent = textPart?.text ?? (msg as any).content ?? '';
    return prisma.aIChatMessage.create({
      data: {
        conversationId,
        role: msg.role,
        content: textContent,
        data: msg as any,
        tokensUsed: isLast && msg.role === 'assistant' ? tokensUsed : 0,
      },
    });
  });
  await Promise.all(savePromises);
  await prisma.aIChatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

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

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit -- --reporter=verbose apps/backend/src/services/__tests__/aiChatService.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/aiChatService.ts apps/backend/src/services/__tests__/aiChatService.test.ts
git commit -m "feat(ai): replace buildChatStream/saveMessage with UIMessage load/save in aiChatService"
```

---

## Task 5: Fix `aiUsageService.ts` — Single Upsert

**Files:**
- Modify: `apps/backend/src/services/aiUsageService.ts`

- [ ] **Step 1: Update `recordAITokenUsage`**

In `apps/backend/src/services/aiUsageService.ts`, replace the `recordAITokenUsage` function:

```typescript
export async function recordAITokenUsage(
  organizationId: string,
  tokensUsed: number
): Promise<void> {
  const { start, end } = currentPeriod();

  try {
    await prisma.aIUsage.upsert({
      where: { organizationId_periodStart: { organizationId, periodStart: start } },
      update: { tokensUsed: { increment: tokensUsed } },
      create: { organizationId, tokensUsed, periodStart: start, periodEnd: end },
    });
  } catch {
    logger.warn({ organizationId, tokensUsed }, 'Failed to record AI token usage');
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm type-check 2>&1 | grep "aiUsageService" | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/services/aiUsageService.ts
git commit -m "fix(ai): replace double-query upsert with single composite-key upsert in aiUsageService"
```

---

## Task 6: Rewrite `aiChat.ts` Route

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts`
- Modify: `apps/backend/src/routes/__tests__/aiChat.test.ts`

- [ ] **Step 1: Write new route tests**

Replace the entire content of `apps/backend/src/routes/__tests__/aiChat.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../services/aiChatService.js', () => ({
  getConversation: vi.fn().mockResolvedValue({ id: 'conv-1', formId: 'form-1', messageCount: 2 }),
  loadConversationMessages: vi.fn().mockResolvedValue([]),
  saveConversationMessages: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../lib/aiFormEditTools.js', () => ({
  createFormEditTools: vi.fn().mockReturnValue({}),
}));

vi.mock('../../lib/formEditAgent.js', () => ({
  createFormEditAgent: vi.fn().mockReturnValue({
    stream: vi.fn(),
  }),
}));

vi.mock('../../lib/aiFormEditTools.js', () => ({
  createFormEditTools: vi.fn().mockReturnValue({}),
}));

// Mock getFormSchemaFromYjs — exported from aiChat route module or a shared lib
// We'll mock the whole yjs module since it's internal
vi.mock('yjs', () => ({ Doc: vi.fn(), applyUpdate: vi.fn() }));

vi.mock('ai', () => ({
  validateUIMessages: vi.fn().mockImplementation(({ messages }) => Promise.resolve(messages)),
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  ToolLoopAgent: vi.fn(),
  stepCountIs: vi.fn(),
}));

import { aiChatRouter } from '../aiChat.js';
import { checkAITokenBudget } from '../../services/aiUsageService.js';
import { createFormEditAgent } from '../../lib/formEditAgent.js';
import { saveConversationMessages } from '../../services/aiChatService.js';

function makeUIMessageStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('POST /chat', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', aiChatRouter);
    vi.clearAllMocks();
    (checkAITokenBudget as any).mockResolvedValue({ allowed: true, used: 0, limit: 50000 });
  });

  it('returns 401 when not authenticated', async () => {
    const { requireAuth } = await import('../../middleware/better-auth-middleware.js');
    (requireAuth as any).mockImplementationOnce(() => { throw new Error('Unauthorized'); });

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields missing', async () => {
    const res = await request(app).post('/chat').send({ organizationId: 'org-1' });
    expect(res.status).toBe(400);
  });

  it('returns 403 when token budget exceeded', async () => {
    (checkAITokenBudget as any).mockResolvedValue({ allowed: false, used: 50000, limit: 50000 });

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/token limit/i);
  });

  it('returns 404 when conversation not found', async () => {
    const { getConversation } = await import('../../services/aiChatService.js');
    (getConversation as any).mockResolvedValue(null);

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [] },
      conversationId: 'bad-conv',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(404);
  });

  it('pipes UI message stream through to response', async () => {
    const streamData = 'data: {"type":"text","value":"hello"}\n\n';
    const mockAgent = {
      stream: vi.fn().mockReturnValue({
        consumeStream: vi.fn(),
        toUIMessageStreamResponse: vi.fn().mockReturnValue(makeUIMessageStreamResponse([streamData])),
      }),
    };
    (createFormEditAgent as any).mockReturnValue(mockAgent);

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(200);
    expect(mockAgent.stream).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit -- --reporter=verbose apps/backend/src/routes/__tests__/aiChat.test.ts
```

Expected: Failures because the route still uses old NDJSON pattern.

- [ ] **Step 3: Rewrite `aiChat.ts`**

Replace the entire content of `apps/backend/src/routes/aiChat.ts`:

```typescript
import { Readable } from 'stream';
import { Router, type Router as ExpressRouter } from 'express';
import { validateUIMessages, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import * as Y from 'yjs';
import {
  requireAuth,
  requireOrganizationMembership,
  createBetterAuthContext,
} from '../middleware/better-auth-middleware.js';
import {
  getConversation,
  loadConversationMessages,
  saveConversationMessages,
  autoGenerateTitle,
} from '../services/aiChatService.js';
import {
  checkAITokenBudget,
  recordAITokenUsage,
} from '../services/aiUsageService.js';
import { createFormEditTools } from '../lib/aiFormEditTools.js';
import { createFormEditAgent } from '../lib/formEditAgent.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const aiChatRouter: ExpressRouter = Router();

async function getFormSchemaFromYjs(formId: string): Promise<{ pages: any[] } | null> {
  const docName = formId.replace(/[^a-zA-Z0-9_-]/g, '');
  const collabDoc = await prisma.collaborativeDocument.findFirst({
    where: { documentName: docName },
    select: { state: true },
  });

  if (collabDoc?.state) {
    try {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, collabDoc.state as Uint8Array);
      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>> | undefined;
      if (!pagesArray) return { pages: [] };
      const pages = pagesArray.toArray().map((pageMap) => {
        const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>> | undefined;
        const fields = fieldsArray ? fieldsArray.toArray().map((fieldMap) => {
          const optionsRaw = fieldMap.get('options');
          const options = optionsRaw instanceof Y.Array ? optionsRaw.toArray() : (optionsRaw ?? null);
          return {
            id: fieldMap.get('id'),
            type: fieldMap.get('type'),
            label: fieldMap.get('label'),
            required: fieldMap.get('validation')?.get?.('required') ?? fieldMap.get('required') ?? false,
            placeholder: fieldMap.get('placeholder') ?? null,
            hint: fieldMap.get('hint') ?? null,
            options,
          };
        }) : [];
        return { id: pageMap.get('id'), title: pageMap.get('title'), fields };
      });
      return { pages };
    } catch {
      // fall through to Prisma fallback
    }
  }

  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { formSchema: true },
  });
  return form ? (form.formSchema as any) : null;
}

function buildSystemPrompt(currentPageId: string | undefined, schema: { pages: any[] }): string {
  const pageContext = currentPageId
    ? `The user is currently viewing page ID: ${currentPageId}. When the user says "this page" or "current page", they mean this page.`
    : 'The user is on the first page.';

  const schemaContext = schema.pages.length > 0
    ? `\nCurrent form structure (use this before calling listFields for simple edits):\n${JSON.stringify(schema, null, 2)}`
    : '';

  return `You are an AI assistant that helps users edit their multi-page form.
${pageContext}
- Call listFields only when the above schema is insufficient or the user asks about all fields.
- Use getField to read a field's full details before updating it.
- When the user mentions "page 1", "page 2" etc., match by position (first page = page 1).
- Make only the changes the user requests. Confirm what you did in your final text response.
- You can add pages with addPage and remove pages with removePage. Never call removePage when there is only one page.
${schemaContext}`;
}

aiChatRouter.post('/chat', async (req, res) => {
  const auth = await createBetterAuthContext(req);

  try {
    requireAuth(auth);
  } catch {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { message, conversationId, organizationId, currentPageId } = req.body as {
    message: UIMessage;
    conversationId: string;
    organizationId: string;
    currentPageId?: string;
  };

  if (!conversationId || !organizationId || !message?.content?.trim()) {
    res.status(400).json({ error: 'conversationId, organizationId, and message are required' });
    return;
  }

  try {
    await requireOrganizationMembership(auth, organizationId);
  } catch {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Check token budget
  const budget = await checkAITokenBudget(organizationId);
  if (!budget.allowed) {
    res.status(402).json({
      error: `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} used). Upgrade your plan to continue.`,
    });
    return;
  }

  // Verify conversation ownership
  const conv = await getConversation(conversationId, auth.user!.id);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  // Load history from DB
  const previous = await loadConversationMessages(conversationId);

  // Auto-title on first message (fire-and-forget)
  if (previous.length === 0) {
    autoGenerateTitle(conversationId, message.content);
  }

  // Build full message list with new user message
  const allMessages = [...previous, message];

  // Read Y.js schema once
  const schema = await getFormSchemaFromYjs(conv.formId) ?? { pages: [] };
  const tools = createFormEditTools(schema);

  // Validate messages (handles tool call/result shapes in history)
  let validated: UIMessage[];
  try {
    validated = await validateUIMessages({ messages: allMessages, tools }) as UIMessage[];
  } catch {
    logger.warn({ conversationId }, 'validateUIMessages failed — falling back to unvalidated messages');
    validated = allMessages;
  }

  const systemPrompt = buildSystemPrompt(currentPageId, schema);
  const agent = createFormEditAgent(schema);

  try {
    const result = agent.stream(await convertToModelMessages(validated), {
      system: systemPrompt,
    });

    // Ensure onFinish fires even if client disconnects
    result.consumeStream();

    const webResponse = result.toUIMessageStreamResponse({
      originalMessages: validated,
      onFinish: async ({ messages: finalMessages, usage }: { messages: UIMessage[]; usage: { totalTokens: number } }) => {
        const newMessages = finalMessages.slice(previous.length);
        await saveConversationMessages(conversationId, newMessages, usage.totalTokens);
        await recordAITokenUsage(organizationId, usage.totalTokens);
      },
    });

    // Bridge Web API Response → Express response
    res.status(webResponse.status);
    for (const [k, v] of webResponse.headers.entries()) {
      res.setHeader(k, v);
    }
    Readable.fromWeb(webResponse.body as any).pipe(res);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ errMsg, conversationId }, 'AI chat stream failed');
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI processing failed. Please try again.' });
    }
    res.end();
  }
});
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit -- --reporter=verbose apps/backend/src/routes/__tests__/aiChat.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Run full backend unit tests**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts apps/backend/src/routes/__tests__/aiChat.test.ts
git commit -m "feat(ai): rewrite aiChat route — ToolLoopAgent + toUIMessageStreamResponse + Express bridge"
```

---

## Task 7: Frontend Prep — Install `@ai-sdk/react` + `aiAgentTypes.ts` + GraphQL Query

**Files:**
- Modify: `apps/form-app/package.json`
- Create: `apps/form-app/src/lib/aiAgentTypes.ts`
- Modify: `apps/form-app/src/graphql/aiChat.ts`

- [ ] **Step 1: Install `@ai-sdk/react`**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms/apps/form-app && pnpm add @ai-sdk/react
```

Expected: Package added. No errors.

- [ ] **Step 2: Create `aiAgentTypes.ts`**

Create `apps/form-app/src/lib/aiAgentTypes.ts`:

```typescript
import type { UIMessage } from 'ai';

export type ToolState = 'input-streaming' | 'input-available' | 'output-available';

// Read-only tools
export interface ListFieldsToolPart {
  type: 'tool-listFields';
  toolCallId: string;
  state: ToolState;
  input?: { pageId?: string };
  output?: { pages: { id: string; fields: { id: string; type: string; label: string; required: boolean }[] }[] };
}

export interface GetFieldToolPart {
  type: 'tool-getField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string };
  output?: { id: string; type: string; label: string; required: boolean; pageId: string; placeholder?: string | null; hint?: string | null; options?: string[] | null };
}

// Mutation tools
export interface AddFieldToolPart {
  type: 'tool-addField';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null };
  output?: { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null };
}

export interface UpdateFieldToolPart {
  type: 'tool-updateField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string; updates: Record<string, unknown> };
  output?: { type: 'UPDATE_FIELD'; fieldId: string; updates: Record<string, unknown> };
}

export interface RemoveFieldToolPart {
  type: 'tool-removeField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string };
  output?: { type: 'REMOVE_FIELD'; fieldId: string };
}

export interface ReorderFieldsToolPart {
  type: 'tool-reorderFields';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string; fieldIds: string[] };
  output?: { type: 'REORDER_FIELDS'; pageId: string; fieldIds: string[] };
}

export interface UpdateLayoutToolPart {
  type: 'tool-updateLayout';
  toolCallId: string;
  state: ToolState;
  input?: { content?: string; customCTAButtonName?: string };
  output?: { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string };
}

export interface RenamePageToolPart {
  type: 'tool-renamePage';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string; newTitle: string };
  output?: { type: 'RENAME_PAGE'; pageId: string; newTitle: string };
}

export interface ReorderPagesToolPart {
  type: 'tool-reorderPages';
  toolCallId: string;
  state: ToolState;
  input?: { pageIds: string[] };
  output?: { type: 'REORDER_PAGES'; pageIds: string[] };
}

export interface AddPageToolPart {
  type: 'tool-addPage';
  toolCallId: string;
  state: ToolState;
  input?: { title: string; insertAfterPageId: string | null };
  output?: { type: 'ADD_PAGE'; title: string; insertAfterPageId: string | null };
}

export interface RemovePageToolPart {
  type: 'tool-removePage';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string };
  output?: { type: 'REMOVE_PAGE'; pageId: string };
}

export type FormEditToolPart =
  | ListFieldsToolPart
  | GetFieldToolPart
  | AddFieldToolPart
  | UpdateFieldToolPart
  | RemoveFieldToolPart
  | ReorderFieldsToolPart
  | UpdateLayoutToolPart
  | RenamePageToolPart
  | ReorderPagesToolPart
  | AddPageToolPart
  | RemovePageToolPart;

export type FormEditAgentUIMessage = Omit<UIMessage, 'parts'> & {
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'reasoning'; reasoning: string }
    | FormEditToolPart
  >;
};

export type MutationToolPart =
  | AddFieldToolPart
  | UpdateFieldToolPart
  | RemoveFieldToolPart
  | ReorderFieldsToolPart
  | UpdateLayoutToolPart
  | RenamePageToolPart
  | ReorderPagesToolPart
  | AddPageToolPart
  | RemovePageToolPart;

export const MUTATION_TOOL_NAMES = new Set([
  'addField', 'updateField', 'removeField', 'reorderFields',
  'updateLayout', 'renamePage', 'reorderPages', 'addPage', 'removePage',
]);
```

- [ ] **Step 3: Update `GET_AI_CHAT_CONVERSATION` GraphQL query**

In `apps/form-app/src/graphql/aiChat.ts`, replace the `GET_AI_CHAT_CONVERSATION` query and the `CREATE_AI_CHAT_CONVERSATION` mutation to use `data` instead of `operations`:

```typescript
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
        data
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
        data
        createdAt
      }
    }
  }
`;
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm type-check 2>&1 | grep "aiAgentTypes\|@ai-sdk/react" | head -10
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/package.json apps/form-app/src/lib/aiAgentTypes.ts apps/form-app/src/graphql/aiChat.ts
git commit -m "feat(ai-frontend): add @ai-sdk/react, FormEditAgentUIMessage type, update GQL query for data field"
```

---

## Task 8: Rewrite `useAIChat.ts` with `useChat`

**Files:**
- Modify: `apps/form-app/src/hooks/useAIChat.ts`
- Delete: `apps/form-app/src/hooks/useAIStream.ts`

- [ ] **Step 1: Rewrite `useAIChat.ts`**

Replace the entire content of `apps/form-app/src/hooks/useAIChat.ts`:

```typescript
// apps/form-app/src/hooks/useAIChat.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
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
import { applyAIOp } from '../lib/applyAIOp';
import { useYjsUndoManager } from './useYjsUndoManager';
import { MUTATION_TOOL_NAMES, type FormEditAgentUIMessage } from '../lib/aiAgentTypes';

const API_URL = import.meta.env.VITE_API_URL as string;

export function buildOpLabel(op: Record<string, unknown>): string {
  switch (op?.type) {
    case 'ADD_FIELD': return `Added "${(op.label as string) ?? 'field'}"`;
    case 'UPDATE_FIELD': return 'Updated field';
    case 'REMOVE_FIELD': return 'Removed field';
    case 'REORDER_FIELDS': return 'Reordered fields';
    case 'UPDATE_LAYOUT': return 'Updated layout';
    case 'RENAME_PAGE': return `Renamed page "${(op.newTitle as string) ?? 'page'}"`;
    case 'REORDER_PAGES': return 'Reordered pages';
    case 'ADD_PAGE': return `Added page "${(op.title as string) ?? 'page'}"`;
    case 'REMOVE_PAGE': return 'Removed page';
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
  const { canUndo, beginBatch, clearBatch, undo } = useYjsUndoManager();
  const appliedToolCallIds = useRef(new Set<string>());

  // ── Conversation management (Apollo) ─────────────────────────────────────
  const { data: conversationsData, refetch: refetchConversations } = useQuery(
    LIST_AI_CHAT_CONVERSATIONS,
    { variables: { formId, organizationId }, skip: !formId }
  );

  const { data: activeConvData } = useQuery(GET_AI_CHAT_CONVERSATION, {
    variables: { id: activeConversationId!, organizationId },
    skip: !activeConversationId,
  });

  const [createConvMutation] = useMutation(CREATE_AI_CHAT_CONVERSATION);
  const [deleteConvMutation] = useMutation(DELETE_AI_CHAT_CONVERSATION);
  const [renameConvMutation] = useMutation(RENAME_AI_CHAT_CONVERSATION);

  // ── Build initialMessages from Apollo conversation data ───────────────────
  const initialMessages: FormEditAgentUIMessage[] =
    (activeConvData?.getAIChatConversation?.messages ?? []).map(
      (m: { data: unknown }) => m.data as FormEditAgentUIMessage
    );

  // ── useChat — streaming + message state ───────────────────────────────────
  const currentPageId: string | undefined =
    (store as any).selectedPageId ?? (store.pages as any[])[0]?.id;

  const { messages, sendMessage, status, stop } = useChat<FormEditAgentUIMessage>({
    id: activeConversationId ?? '__no_conversation__',
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `${API_URL}/api/ai/chat`,
      credentials: 'include',
      prepareSendMessagesRequest: ({ messages: allMsgs }) => ({
        body: {
          message: allMsgs[allMsgs.length - 1],
          conversationId: activeConversationId,
          organizationId,
          currentPageId,
        },
      }),
    }),
    onError: (error) => {
      const msg = error.message ?? String(error);
      const isLimit = msg.includes('token limit');
      toastError('AI Error', isLimit ? msg : 'AI processing failed. Please try again.');
    },
  });

  // ── Apply mutation ops to Y.js store as tool results arrive ──────────────
  useEffect(() => {
    const last = messages[messages.length - 1] as FormEditAgentUIMessage | undefined;
    if (!last || last.role !== 'assistant') return;

    for (const part of last.parts ?? []) {
      if (
        part.type.startsWith('tool-') &&
        MUTATION_TOOL_NAMES.has(part.type.slice(5)) &&
        (part as any).state === 'output-available' &&
        !appliedToolCallIds.current.has((part as any).toolCallId)
      ) {
        appliedToolCallIds.current.add((part as any).toolCallId);
        applyAIOp((part as any).output, store);
      }
    }
  }, [messages]);

  // Clear applied tool call IDs when conversation switches
  useEffect(() => {
    appliedToolCallIds.current.clear();
  }, [activeConversationId]);

  // ── Conversation CRUD ─────────────────────────────────────────────────────
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
    },
    [organizationId, renameConvMutation, refetchConversations]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId || status !== 'ready') return;
      clearBatch();
      beginBatch();
      sendMessage({ text: content });
    },
    [activeConversationId, status, clearBatch, beginBatch, sendMessage]
  );

  const conversations = conversationsData?.listAIChatConversations ?? [];
  const activeConversation = activeConvData?.getAIChatConversation ?? null;
  const isStreaming = status !== 'ready';

  return {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    isStreaming,
    status,
    canUndo,
    undo,
    cancel: stop,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    sendMessage: handleSendMessage,
  };
}
```

- [ ] **Step 2: Delete `useAIStream.ts`**

```bash
rm /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms/apps/form-app/src/hooks/useAIStream.ts
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm type-check 2>&1 | grep -E "useAIChat|useAIStream|error TS" | head -20
```

Expected: No errors. Verify `useAIStream.ts` references are fully removed.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/hooks/useAIChat.ts
git rm apps/form-app/src/hooks/useAIStream.ts
git commit -m "feat(ai-frontend): rewrite useAIChat with useChat from @ai-sdk/react, delete useAIStream"
```

---

## Task 9: Tool Part Components

**Files:**
- Create: `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx`
- Create: `apps/form-app/src/components/form-builder/tool-parts/ListFieldsToolPart.tsx`
- Create: `apps/form-app/src/components/form-builder/tool-parts/GetFieldToolPart.tsx`

- [ ] **Step 1: Create `MutationToolPart.tsx`**

Create `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx`:

```tsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@dculus/utils';
import type { MutationToolPart, ToolState } from '../../../lib/aiAgentTypes';
import { buildOpLabel } from '../../../hooks/useAIChat';

interface Props {
  part: MutationToolPart;
}

function getActionLabel(part: MutationToolPart): string {
  switch (part.type) {
    case 'tool-addField': return `Adding field…`;
    case 'tool-updateField': return 'Updating field…';
    case 'tool-removeField': return 'Removing field…';
    case 'tool-reorderFields': return 'Reordering fields…';
    case 'tool-updateLayout': return 'Updating layout…';
    case 'tool-renamePage': return 'Renaming page…';
    case 'tool-reorderPages': return 'Reordering pages…';
    case 'tool-addPage': return 'Adding page…';
    case 'tool-removePage': return 'Removing page…';
  }
}

function getDoneLabel(part: MutationToolPart): string {
  if (!part.output) return 'Changed form';
  return buildOpLabel(part.output as Record<string, unknown>);
}

const MutationToolPart: React.FC<Props> = ({ part }) => {
  const state: ToolState = (part as any).state;

  if (state === 'input-streaming') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        {part.type.slice(5)}
      </span>
    );
  }

  if (state === 'input-available') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {getActionLabel(part)}
      </span>
    );
  }

  // output-available
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {getDoneLabel(part)}
    </span>
  );
};

export default MutationToolPart;
```

- [ ] **Step 2: Create `ListFieldsToolPart.tsx`**

Create `apps/form-app/src/components/form-builder/tool-parts/ListFieldsToolPart.tsx`:

```tsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ListFieldsToolPart } from '../../../lib/aiAgentTypes';

interface Props {
  part: ListFieldsToolPart;
}

const ListFieldsToolPart: React.FC<Props> = ({ part }) => {
  const state = (part as any).state;

  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reading form structure…
      </span>
    );
  }

  const pages = part.output?.pages ?? [];
  const fieldCount = pages.reduce((sum, p) => sum + p.fields.length, 0);

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
      Scanned {pages.length} page{pages.length !== 1 ? 's' : ''}, {fieldCount} field{fieldCount !== 1 ? 's' : ''}
    </span>
  );
};

export default ListFieldsToolPart;
```

- [ ] **Step 3: Create `GetFieldToolPart.tsx`**

Create `apps/form-app/src/components/form-builder/tool-parts/GetFieldToolPart.tsx`:

```tsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import type { GetFieldToolPart } from '../../../lib/aiAgentTypes';

interface Props {
  part: GetFieldToolPart;
}

const GetFieldToolPart: React.FC<Props> = ({ part }) => {
  const state = (part as any).state;

  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking field details…
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
      Read field details
    </span>
  );
};

export default GetFieldToolPart;
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm type-check 2>&1 | grep "tool-parts\|ToolPart" | head -10
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/components/form-builder/tool-parts/
git commit -m "feat(ai-frontend): add MutationToolPart, ListFieldsToolPart, GetFieldToolPart components"
```

---

## Task 10: Update `AIEditDrawer.tsx` — Parts-Based Rendering

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Replace `AIEditDrawer.tsx`**

Replace the entire content of `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`:

```tsx
// apps/form-app/src/components/form-builder/AIEditDrawer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Send, Plus, Trash2, ChevronDown, X, Undo2 } from 'lucide-react';
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
import { useAIChat } from '../../hooks/useAIChat';
import type { FormEditAgentUIMessage, FormEditToolPart } from '../../lib/aiAgentTypes';
import MutationToolPart from './tool-parts/MutationToolPart';
import ListFieldsToolPart from './tool-parts/ListFieldsToolPart';
import GetFieldToolPart from './tool-parts/GetFieldToolPart';

interface AIEditDrawerProps {
  formId: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

function UserBubble({ message }: { message: FormEditAgentUIMessage }) {
  const textPart = message.parts.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined;
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
        {textPart?.text ?? message.content}
      </div>
    </div>
  );
}

function TextBubble({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5 my-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-xs">{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground/50 align-text-bottom" />
      )}
    </div>
  );
}

function AssistantMessage({ message, isStreaming }: { message: FormEditAgentUIMessage; isStreaming: boolean }) {
  const toolPart = (part: { type: string }, i: number) => {
    const toolName = part.type.slice(5); // strip 'tool-'
    if (part.type === 'tool-listFields') {
      return <ListFieldsToolPart key={i} part={part as any} />;
    }
    if (part.type === 'tool-getField') {
      return <GetFieldToolPart key={i} part={part as any} />;
    }
    if (
      ['addField','updateField','removeField','reorderFields',
       'updateLayout','renamePage','reorderPages','addPage','removePage'].includes(toolName)
    ) {
      return <MutationToolPart key={i} part={part as any} />;
    }
    return null;
  };

  const textParts = message.parts.filter((p) => p.type === 'text') as { type: 'text'; text: string }[];
  const combinedText = textParts.map((p) => p.text).join('');

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        <div className="space-y-1.5">
          <TextBubble text={combinedText} isStreaming={isStreaming} />
          <div className="flex flex-wrap gap-1.5">
            {message.parts.map((part, i) =>
              part.type !== 'text' ? toolPart(part, i) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({ text }: { text?: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
        {text ? (
          <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs italic text-muted-foreground">
            {text}
          </div>
        ) : (
          <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const QUICK_CHIP_PROMPTS = {
  analyseForm: `Please analyse this form. Use listFields to read all pages and fields first, then give structured feedback on: (1) field order and logical flow, (2) missing fields for this type of form, (3) unclear or confusing labels, (4) fields that should be required but aren't. Be concise and actionable.`,
  listAllFields: `List all fields across every page of this form.`,
  makeAllRequired: `Make every field on every page required.`,
} as const;

function QuickChips({ onChipClick, disabled }: { onChipClick: (prompt: string) => void; disabled: boolean }) {
  const { t } = useTranslation('aiEditDrawer');
  const chips = [
    { key: 'analyseForm' as const, icon: true },
    { key: 'listAllFields' as const, icon: false },
    { key: 'makeAllRequired' as const, icon: false },
  ];
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {chips.map(({ key, icon }) => (
        <button
          key={key}
          onClick={() => onChipClick(QUICK_CHIP_PROMPTS[key])}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground',
            'transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
        >
          {icon && <Sparkles className="h-3 w-3" />}
          {t(`chips.${key}`)}
        </button>
      ))}
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
    status,
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

  // Determine whether to show the global status indicator
  // Show it only when streaming but no assistant message with parts has appeared yet
  const lastMsg = messages[messages.length - 1] as FormEditAgentUIMessage | undefined;
  const showStatusIndicator = isStreaming && (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.parts.length === 0);

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-semibold">{t('title')}</span>

        {canUndo && (
          <button
            onClick={undo}
            title={t('undoTitle')}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Undo2 className="h-3.5 w-3.5" />
            {t('undo')}
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
          aria-label={t('closeAriaLabel')}
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
        {(messages as FormEditAgentUIMessage[]).map((msg) =>
          msg.role === 'user'
            ? <UserBubble key={msg.id} message={msg} />
            : <AssistantMessage key={msg.id} message={msg} isStreaming={isStreaming && msg === lastMsg} />
        )}
        {showStatusIndicator && <StatusIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        {!isStreaming && activeConversationId && (
          <QuickChips onChipClick={(prompt) => sendMessage(prompt)} disabled={isStreaming} />
        )}
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
              aria-label={t('cancel')}
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
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIEditDrawer;
```

- [ ] **Step 2: Typecheck all changed files**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm type-check 2>&1 | grep -v "node_modules" | head -30
```

Expected: No TypeScript errors.

- [ ] **Step 3: Run full backend unit tests**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit
```

Expected: All tests pass.

- [ ] **Step 4: Build all packages**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-frontend): update AIEditDrawer to render message.parts with typed tool components"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] ToolLoopAgent factory → Task 3
- [x] `toUIMessageStreamResponse` + Express bridge → Task 6
- [x] `useChat` + `DefaultChatTransport` → Task 8
- [x] UIMessage DB storage → Tasks 1 + 4
- [x] `data` column + drop `operations` → Task 1
- [x] AIUsage composite unique → Tasks 1 + 5
- [x] Schema injected into system prompt once per request → Task 6
- [x] Y.js read once per request → Task 6
- [x] Typed tool part rendering → Tasks 9 + 10
- [x] `applyAIOp` via useEffect on `output-available` parts → Task 8
- [x] `consumeStream()` for disconnect resilience → Task 6
- [x] `validateUIMessages` with fallback → Task 6
- [x] `@ai-sdk/react` installed → Task 7
- [x] `FormEditAgentUIMessage` type in form-app → Task 7
- [x] `GET_AI_CHAT_CONVERSATION` query includes `data` → Task 7
- [x] `useAIStream.ts` deleted → Task 8
- [x] `autoGenerateTitle` fires on first message → Task 6 (checks `previous.length === 0`)
