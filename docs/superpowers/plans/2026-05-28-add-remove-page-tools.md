# Add / Remove Page Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `addPage` and `removePage` AI tools so the chat assistant can create and delete form pages, closing the gap where it could only rename and reorder them.

**Architecture:** Two new tools follow the existing operation-object pattern — tool `execute()` returns a plain object (`ADD_PAGE` | `REMOVE_PAGE`), the frontend `applyAIOp` applies it to Y.js via the Zustand store. A new `addPageAtPosition` store method handles positional insertion.

**Tech Stack:** TypeScript, Vercel AI SDK (`tool`, `z`), Y.js, Zustand, Vitest (backend), Jest (frontend)

---

## File Map

| File | Change |
|---|---|
| `apps/backend/src/lib/aiFormEditTools.ts` | Add `addPage` + `removePage` tools; extend `FormOperation` union |
| `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts` | Add tests for both new tools |
| `apps/backend/src/routes/aiChat.ts` | Add entries to `TOOL_STATUS_MAP` + `MUTATION_OP_TYPES` |
| `apps/backend/src/routes/__tests__/aiChat.test.ts` | Add tests for new op streaming + status chunks |
| `apps/backend/src/services/aiChatService.ts` | Add one sentence to system prompt |
| `apps/form-app/src/store/types/store.types.ts` | Add `addPageAtPosition` to `PagesSlice` interface |
| `apps/form-app/src/store/slices/pagesSlice.ts` | Implement `addPageAtPosition` |
| `apps/form-app/src/lib/applyAIOp.ts` | Handle `ADD_PAGE` + `REMOVE_PAGE`; extend `Pick<>` type |
| `apps/form-app/src/lib/__tests__/applyAIOp.test.ts` | Add tests for both new cases |
| `apps/form-app/src/hooks/useAIChat.ts` | Add `ADD_PAGE` + `REMOVE_PAGE` to `buildOpLabel` |

---

## Task 1: Backend tools — `addPage` + `removePage`

**Files:**
- Modify: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`

- [ ] **Step 1: Add failing tests for `addPage` and `removePage`**

Open `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`. Add these test blocks at the end of the file (after the existing `reorderPages` describe block):

```typescript
describe('addPage', () => {
  it('returns ADD_PAGE op with title and null insertAfterPageId', async () => {
    const tools = createFormEditTools('form-1');
    const result = await (tools as any).addPage.execute!(
      { title: 'Step 2', insertAfterPageId: null },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'ADD_PAGE', title: 'Step 2', insertAfterPageId: null });
  });

  it('returns ADD_PAGE op with a specific insertAfterPageId', async () => {
    const tools = createFormEditTools('form-1');
    const result = await (tools as any).addPage.execute!(
      { title: 'Middle Page', insertAfterPageId: 'page-1' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'ADD_PAGE', title: 'Middle Page', insertAfterPageId: 'page-1' });
  });
});

describe('removePage', () => {
  it('returns REMOVE_PAGE op when multiple pages exist', async () => {
    const tools = createFormEditTools('form-1');
    const result = await (tools as any).removePage.execute!(
      { pageId: 'page-2' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'REMOVE_PAGE', pageId: 'page-2' });
  });

  it('returns error when only one page exists', async () => {
    (prisma.form.findUnique as any).mockResolvedValue({
      formSchema: { pages: [mockSchema.pages[0]] },
    });
    const tools = createFormEditTools('form-1');
    const result = await (tools as any).removePage.execute!(
      { pageId: 'page-1' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toHaveProperty('error');
    expect((result as any).error).toMatch(/last page/i);
  });

  it('returns error when form not found', async () => {
    (prisma.form.findUnique as any).mockResolvedValue(null);
    const tools = createFormEditTools('bad-id');
    const result = await (tools as any).removePage.execute!(
      { pageId: 'page-1' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toHaveProperty('error');
  });
});
```

Also update the tool-count test from 9 to 11:

```typescript
// Change this line:
expect(Object.keys(tools)).toEqual([
  'listFields', 'getField', 'addField', 'updateField',
  'removeField', 'reorderFields', 'updateLayout',
  'renamePage', 'reorderPages',
]);
// To:
expect(Object.keys(tools)).toEqual([
  'listFields', 'getField', 'addField', 'updateField',
  'removeField', 'reorderFields', 'updateLayout',
  'renamePage', 'reorderPages', 'addPage', 'removePage',
]);
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -A 3 "addPage\|removePage\|11 tools"
```

Expected: failures for `addPage`, `removePage`, and the tool-count test.

- [ ] **Step 3: Implement the two tools in `aiFormEditTools.ts`**

In `apps/backend/src/lib/aiFormEditTools.ts`, add the two tools inside the `return { ... }` object of `createFormEditTools`, after `reorderPages`:

```typescript
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
        const schema = await getFormSchema();
        if (!schema) return { error: 'Form not found' };
        if ((schema.pages ?? []).length <= 1) return { error: 'Cannot remove the last page' };
        return { type: 'REMOVE_PAGE' as const, pageId };
      },
    }),
```

Also extend the `FormOperation` union at the bottom of the file:

```typescript
// Add these two members to the existing union:
  | { type: 'ADD_PAGE'; title: string; insertAfterPageId: string | null }
  | { type: 'REMOVE_PAGE'; pageId: string }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -E "addPage|removePage|PASS|FAIL" | head -20
```

Expected: all `addPage` and `removePage` tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "feat(ai): add addPage and removePage tools to aiFormEditTools"
```

---

## Task 2: Backend route + system prompt

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts`
- Modify: `apps/backend/src/routes/__tests__/aiChat.test.ts`
- Modify: `apps/backend/src/services/aiChatService.ts`

- [ ] **Step 1: Add failing tests for the route changes**

Open `apps/backend/src/routes/__tests__/aiChat.test.ts`. Add these tests inside the `describe('POST /chat', ...)` block:

```typescript
  it('emits status chunk for addPage tool call', async () => {
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-call', toolName: 'addPage' },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });
    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Add a page' });
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'status', text: 'Adding page...' });
  });

  it('emits status chunk for removePage tool call', async () => {
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-call', toolName: 'removePage' },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });
    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Remove page 2' });
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'status', text: 'Removing page...' });
  });

  it('streams ADD_PAGE operation chunk', async () => {
    const op = { type: 'ADD_PAGE', title: 'Step 2', insertAfterPageId: null };
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-result', output: op },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });
    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Add a page' });
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'operation', op });
  });

  it('streams REMOVE_PAGE operation chunk', async () => {
    const op = { type: 'REMOVE_PAGE', pageId: 'page-2' };
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-result', output: op },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });
    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Remove page 2' });
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'operation', op });
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -E "addPage|removePage|ADD_PAGE|REMOVE_PAGE|FAIL" | head -20
```

Expected: 4 new failures.

- [ ] **Step 3: Update `TOOL_STATUS_MAP` in `apps/backend/src/routes/aiChat.ts`**

Find `TOOL_STATUS_MAP` (around line 91) and add two entries after `reorderPages`:

```typescript
      addPage: 'Adding page...',
      removePage: 'Removing page...',
```

- [ ] **Step 4: Update `MUTATION_OP_TYPES` in the same file**

Find `MUTATION_OP_TYPES` (around line 118) and add the two new types:

```typescript
// Change from:
const MUTATION_OP_TYPES = new Set(['ADD_FIELD', 'UPDATE_FIELD', 'REMOVE_FIELD', 'REORDER_FIELDS', 'UPDATE_LAYOUT', 'RENAME_PAGE', 'REORDER_PAGES']);
// To:
const MUTATION_OP_TYPES = new Set(['ADD_FIELD', 'UPDATE_FIELD', 'REMOVE_FIELD', 'REORDER_FIELDS', 'UPDATE_LAYOUT', 'RENAME_PAGE', 'REORDER_PAGES', 'ADD_PAGE', 'REMOVE_PAGE']);
```

- [ ] **Step 5: Update system prompt in `apps/backend/src/services/aiChatService.ts`**

Find the `systemPrompt` string (around line 26). After the bullet about `renamePage`/`reorderPages`, add:

```typescript
- You can add pages with addPage (insertAfterPageId: null appends at end) and remove pages with removePage. Never call removePage when there is only one page.
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
pnpm test:unit --reporter=verbose 2>&1 | grep -E "addPage|removePage|ADD_PAGE|REMOVE_PAGE|PASS|FAIL" | head -20
```

Expected: all 4 new tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts apps/backend/src/routes/__tests__/aiChat.test.ts apps/backend/src/services/aiChatService.ts
git commit -m "feat(ai): wire addPage/removePage into route status map and op streaming"
```

---

## Task 3: Frontend store — `addPageAtPosition`

**Files:**
- Modify: `apps/form-app/src/store/types/store.types.ts`
- Modify: `apps/form-app/src/store/slices/pagesSlice.ts`

_Note: pagesSlice uses Y.js directly and has no isolated unit tests; correctness is validated through the applyAIOp integration tests in Task 4 and manual testing._

- [ ] **Step 1: Add `addPageAtPosition` to the `PagesSlice` interface**

Open `apps/form-app/src/store/types/store.types.ts`. Find the `PagesSlice` interface. After `addEmptyPage`:

```typescript
  addEmptyPage: () => string | undefined;
  addPageAtPosition: (title: string, insertAfterPageId: string | null) => string | undefined;
```

- [ ] **Step 2: Implement `addPageAtPosition` in `pagesSlice.ts`**

Open `apps/form-app/src/store/slices/pagesSlice.ts`. After the closing brace of `addEmptyPage` (around line 70), add the new method:

```typescript
    addPageAtPosition: (title: string, insertAfterPageId: string | null): string | undefined => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) return;

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = getOrCreatePagesArray(formSchemaMap);

      const newPageId = `page-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const pageMap = new Y.Map();
      const fieldsArray = new Y.Array();

      pageMap.set('id', newPageId);
      pageMap.set('title', title);
      pageMap.set('fields', fieldsArray);

      if (insertAfterPageId) {
        const pages = pagesArray.toArray();
        const idx = pages.findIndex((p: Y.Map<any>) => p.get('id') === insertAfterPageId);
        if (idx !== -1) {
          pagesArray.insert(idx + 1, [pageMap]);
        } else {
          pagesArray.push([pageMap]);
        }
      } else {
        pagesArray.push([pageMap]);
      }

      pagesArray.toArray().forEach((pMap: Y.Map<any>, index: number) => {
        pMap.set('order', index);
      });

      return newPageId;
    },
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check 2>&1 | grep -E "pagesSlice|store.types|error" | head -20
```

Expected: no errors related to `addPageAtPosition`.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/store/types/store.types.ts apps/form-app/src/store/slices/pagesSlice.ts
git commit -m "feat(ai): add addPageAtPosition store method to pagesSlice"
```

---

## Task 4: Frontend `applyAIOp` + `buildOpLabel`

**Files:**
- Modify: `apps/form-app/src/lib/__tests__/applyAIOp.test.ts`
- Modify: `apps/form-app/src/lib/applyAIOp.ts`
- Modify: `apps/form-app/src/hooks/useAIChat.ts`

- [ ] **Step 1: Add `addPageAtPosition` and `removePage` to `makeStore` in the test file**

Open `apps/form-app/src/lib/__tests__/applyAIOp.test.ts`. Update `makeStore` to include the two new store methods:

```typescript
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
    addField: jest.fn(),
    addFieldAtIndex: jest.fn(),
    updateField: jest.fn(),
    removeField: jest.fn(),
    reorderFields: jest.fn(),
    updateLayout: jest.fn(),
    updatePageTitle: jest.fn(),
    reorderPages: jest.fn(),
    addPageAtPosition: jest.fn(),
    removePage: jest.fn(),
    ...overrides,
  };
}
```

Then add failing tests at the end of the file:

```typescript
describe('applyAIOp — ADD_PAGE', () => {
  it('calls addPageAtPosition with title and null insertAfterPageId', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_PAGE', title: 'Step 2', insertAfterPageId: null }, store as any);
    expect(store.addPageAtPosition).toHaveBeenCalledWith('Step 2', null);
  });

  it('calls addPageAtPosition with insertAfterPageId when provided', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_PAGE', title: 'Middle', insertAfterPageId: 'page-1' }, store as any);
    expect(store.addPageAtPosition).toHaveBeenCalledWith('Middle', 'page-1');
  });
});

describe('applyAIOp — REMOVE_PAGE', () => {
  it('calls removePage when multiple pages exist', () => {
    const store = makeStore();
    applyAIOp({ type: 'REMOVE_PAGE', pageId: 'page-2' }, store as any);
    expect(store.removePage).toHaveBeenCalledWith('page-2');
  });

  it('does nothing when only one page exists', () => {
    const store = makeStore({
      pages: [{ id: 'page-1', fields: [] }],
    });
    applyAIOp({ type: 'REMOVE_PAGE', pageId: 'page-1' }, store as any);
    expect(store.removePage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/form-app && npx jest --testPathPattern="applyAIOp" --verbose 2>&1 | grep -E "ADD_PAGE|REMOVE_PAGE|FAIL|PASS"
```

Expected: 4 new failures.

- [ ] **Step 3: Add the two new cases to `applyAIOp.ts`**

Open `apps/form-app/src/lib/applyAIOp.ts`. Update the `Pick<>` type to include the new store methods:

```typescript
export function applyAIOp(
  op: any,
  store: Pick<
    FormBuilderState,
    'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField' |
    'reorderFields' | 'updateLayout' | 'updatePageTitle' | 'reorderPages' |
    'addPageAtPosition' | 'removePage'
  >
): void {
```

Then add the two new cases inside the `switch` block, after `REORDER_PAGES`:

```typescript
    case 'ADD_PAGE': {
      store.addPageAtPosition(op.title, op.insertAfterPageId);
      break;
    }

    case 'REMOVE_PAGE': {
      if ((store.pages as any[]).length <= 1) return;
      store.removePage(op.pageId);
      break;
    }
```

- [ ] **Step 4: Update `buildOpLabel` in `apps/form-app/src/hooks/useAIChat.ts`**

Find `buildOpLabel` (around line 28). Add two cases before the `default`:

```typescript
    case 'ADD_PAGE': return `Added page "${(op.title as string) ?? 'page'}"`;
    case 'REMOVE_PAGE': return 'Removed page';
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd apps/form-app && npx jest --testPathPattern="applyAIOp" --verbose 2>&1 | tail -20
```

Expected: all tests pass, including the 4 new ones.

- [ ] **Step 6: Full type-check**

```bash
pnpm type-check 2>&1 | grep -i error | head -20
```

Expected: no errors.

- [ ] **Step 7: Run full unit test suite**

```bash
pnpm test:unit 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/form-app/src/lib/applyAIOp.ts apps/form-app/src/lib/__tests__/applyAIOp.test.ts apps/form-app/src/hooks/useAIChat.ts
git commit -m "feat(ai): handle ADD_PAGE and REMOVE_PAGE in applyAIOp; update buildOpLabel"
```

---

## Verification

- [ ] **Manual smoke test**

Start the dev stack: `pnpm dev`

Open the form builder on a multi-page form, open the AI drawer, and send:
1. `"Add a page called 'Review' after the first page"` — a new page should appear between page 1 and page 2
2. `"Remove the last page"` — that page and all its fields should disappear
3. `"Remove this page"` on a single-page form — AI should explain it cannot
4. Click Undo — the last operation should be reversed

Confirm operation chips appear in the drawer for both operations.
