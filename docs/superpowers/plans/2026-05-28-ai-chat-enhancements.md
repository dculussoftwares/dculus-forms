# AI Chat Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tool-call status messages, field validation editing, page rename/reorder tools, and quick-action chips to the AI chat form builder.

**Architecture:** Backend route emits `status` NDJSON chunks on `tool-call` events; two new backend tools (`renamePage`, `reorderPages`) + extended `updateField` validation schema; frontend `useAIStream` + `useAIChat` wire status state; `AIEditDrawer` replaces `TypingIndicator` with `StatusIndicator` and adds a `QuickChips` strip above the textarea.

**Tech Stack:** Node.js/Express, Vercel AI SDK (`streamText`), Y.js, React/Zustand, Jest (form-app), Vitest (backend)

**Spec:** `docs/superpowers/specs/2026-05-28-ai-chat-enhancements-design.md`

---

## Task 1: Emit status chunks on tool-call events (Feature 1 — Backend)

**Files:**
- Modify: `apps/backend/src/routes/aiChat.ts`

- [ ] **Step 1: Add `tool-call` handler inside the `for await` loop**

Open `apps/backend/src/routes/aiChat.ts`. Inside the `for await (const part of stream.fullStream)` loop, add this block **before** the existing `text-delta` handler:

```typescript
const TOOL_STATUS_MAP: Record<string, string> = {
  listFields: 'Reading form structure...',
  getField: 'Checking field details...',
  addField: 'Adding field...',
  updateField: 'Updating field...',
  removeField: 'Removing field...',
  reorderFields: 'Reordering fields...',
  updateLayout: 'Updating layout...',
  renamePage: 'Renaming page...',
  reorderPages: 'Reordering pages...',
};

if (part.type === 'tool-call') {
  const toolName = (part as any).toolName as string;
  write({ type: 'status', text: TOOL_STATUS_MAP[toolName] ?? 'Working...' });
}
```

Also update `MUTATION_OP_TYPES` to include the two new page operations:
```typescript
const MUTATION_OP_TYPES = new Set(['ADD_FIELD', 'UPDATE_FIELD', 'REMOVE_FIELD', 'REORDER_FIELDS', 'UPDATE_LAYOUT', 'RENAME_PAGE', 'REORDER_PAGES']);
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/backend && pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/routes/aiChat.ts
git commit -m "feat(ai): emit status chunks on tool-call events; add RENAME_PAGE/REORDER_PAGES to op types"
```

---

## Task 2: Wire status to frontend — useAIStream + useAIChat + StatusIndicator (Feature 1 — Frontend)

**Files:**
- Modify: `apps/form-app/src/hooks/useAIStream.ts`
- Modify: `apps/form-app/src/hooks/useAIChat.ts`
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Add `onStatus` to `useAIStream`**

In `apps/form-app/src/hooks/useAIStream.ts`:

1. Add `onStatus: (text: string) => void;` to the `AIStreamCallbacks` interface.
2. In the NDJSON chunk router, add after the `error` handler:
```typescript
if (chunk.type === 'status') callbacksRef.current.onStatus(chunk.text ?? '');
```

The chunk type should be extended too. Change:
```typescript
const chunk = JSON.parse(line) as { type: string; delta?: string; op?: unknown; messageId?: string; error?: string };
```
To:
```typescript
const chunk = JSON.parse(line) as { type: string; delta?: string; op?: unknown; messageId?: string; error?: string; text?: string };
```

- [ ] **Step 2: Add `statusText` state to `useAIChat`**

In `apps/form-app/src/hooks/useAIChat.ts`:

1. Add state after the existing `streamingMessage` state:
```typescript
const [statusText, setStatusText] = useState('');
```

2. In the `useAIStream` callbacks object, add `onStatus`:
```typescript
onStatus: (text) => setStatusText(text),
```

3. In `onDone` callback, add `setStatusText('');` before `setIsStreaming(false)`.

4. In `onError` callback, add `setStatusText('');` before `setIsStreaming(false)`.

5. In the `cancelStream` `useCallback`, add `setStatusText('');` after `cancel()`.

6. Add `statusText` to the return object:
```typescript
return {
  // ...existing fields...
  statusText,
};
```

- [ ] **Step 3: Replace `TypingIndicator` with `StatusIndicator` in `AIEditDrawer.tsx`**

In `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`:

1. Remove the `TypingIndicator` function entirely.

2. Add `StatusIndicator` in its place:
```tsx
function StatusIndicator({ text }: { text: string }) {
  if (text) {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-3 w-3 animate-pulse text-primary" />
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs italic text-muted-foreground">
            {text}
          </div>
        </div>
      </div>
    );
  }
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
```

3. Destructure `statusText` from `useAIChat`:
```typescript
const {
  // ...existing destructuring...
  statusText,
} = useAIChat({ formId, organizationId });
```

4. Replace the existing line `{isStreaming && !messages.some((m) => m.isStreaming) && <TypingIndicator />}` with:
```tsx
{isStreaming && !messages.some((m) => m.isStreaming) && <StatusIndicator text={statusText} />}
```

- [ ] **Step 4: TypeScript check**

```bash
cd apps/form-app && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/hooks/useAIStream.ts apps/form-app/src/hooks/useAIChat.ts apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai): show tool-call status text in drawer; replace typing dots with StatusIndicator"
```

---

## Task 3: Field validation editing — extend updateField tool (Feature 2)

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`
- Modify: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Write failing tests for the extended updateField schema**

In `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`, add inside the existing `describe('updateField')` block:

```typescript
it('returns UPDATE_FIELD op with validation object', async () => {
  const tools = createFormEditTools('form-1');
  const result = await tools.updateField.execute!(
    {
      fieldId: 'f-1',
      updates: { validation: { minLength: 2, maxLength: 50 } },
    },
    { messages: [], toolCallId: 'test' }
  );
  expect(result).toEqual({
    type: 'UPDATE_FIELD',
    fieldId: 'f-1',
    updates: { validation: { minLength: 2, maxLength: 50 } },
  });
});

it('returns UPDATE_FIELD op with min/max for number field', async () => {
  const tools = createFormEditTools('form-1');
  const result = await tools.updateField.execute!(
    {
      fieldId: 'f-1',
      updates: { min: 0, max: 100 },
    },
    { messages: [], toolCallId: 'test' }
  );
  expect(result).toEqual({
    type: 'UPDATE_FIELD',
    fieldId: 'f-1',
    updates: { min: 0, max: 100 },
  });
});

it('returns UPDATE_FIELD op with minDate/maxDate for date field', async () => {
  const tools = createFormEditTools('form-1');
  const result = await tools.updateField.execute!(
    {
      fieldId: 'f-1',
      updates: { minDate: '2024-01-01', maxDate: '2025-12-31' },
    },
    { messages: [], toolCallId: 'test' }
  );
  expect(result).toEqual({
    type: 'UPDATE_FIELD',
    fieldId: 'f-1',
    updates: { minDate: '2024-01-01', maxDate: '2025-12-31' },
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/backend && pnpm test:unit --run src/lib/__tests__/aiFormEditTools.test.ts
```

Expected: FAIL — Zod validation error (unknown fields not in schema)

- [ ] **Step 3: Extend `updateField` Zod schema in `aiFormEditTools.ts`**

In `apps/backend/src/lib/aiFormEditTools.ts`, find the `updateField` tool's `inputSchema` and replace the `updates` object schema:

```typescript
updates: z.object({
  label: z.string().optional(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
  options: z.array(z.string()).optional(),
  // Validation rules — stored in the Y.js validation Y.Map
  validation: z.object({
    required: z.boolean().optional(),
    minLength: z.number().nullable().optional(),     // text / textarea
    maxLength: z.number().nullable().optional(),     // text / textarea
    minSelections: z.number().nullable().optional(), // checkbox
    maxSelections: z.number().nullable().optional(), // checkbox
  }).optional().describe('For text/textarea use minLength/maxLength. For checkbox use minSelections/maxSelections.'),
  // Number field — field-level properties (not in validation Y.Map)
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  // Date field — field-level properties (ISO date string e.g. "2024-01-31")
  minDate: z.string().nullable().optional(),
  maxDate: z.string().nullable().optional(),
}),
```

Also update the `updateField` tool description:
```
'Update one or more properties of an existing field. Only include properties you want to change. For text/textarea fields use updates.validation.minLength/maxLength. For number fields use updates.min/updates.max. For date fields use updates.minDate/updates.maxDate. For checkbox fields use updates.validation.minSelections/maxSelections.'
```

Also update the `FormOperation` type at the bottom of the file to reflect the richer updates shape:
```typescript
| { type: 'UPDATE_FIELD'; fieldId: string; updates: { label?: string; required?: boolean; placeholder?: string; hint?: string; options?: string[]; validation?: { required?: boolean; minLength?: number | null; maxLength?: number | null; minSelections?: number | null; maxSelections?: number | null }; min?: number | null; max?: number | null; minDate?: string | null; maxDate?: string | null } }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/backend && pnpm test:unit --run src/lib/__tests__/aiFormEditTools.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: TypeScript check**

```bash
cd apps/backend && pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "feat(ai): extend updateField tool with validation, min/max, minDate/maxDate"
```

---

## Task 4: Page rename + reorder tools (Feature 3 — Backend)

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`
- Modify: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Write failing tests**

In `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`, add new describe blocks after the existing ones:

```typescript
describe('renamePage', () => {
  it('returns RENAME_PAGE op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.renamePage.execute!(
      { pageId: 'page-1', newTitle: 'Contact Details' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'RENAME_PAGE', pageId: 'page-1', newTitle: 'Contact Details' });
  });
});

describe('reorderPages', () => {
  it('returns REORDER_PAGES op with page IDs in desired order', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.reorderPages.execute!(
      { pageIds: ['page-2', 'page-1'] },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'REORDER_PAGES', pageIds: ['page-2', 'page-1'] });
  });
});

it('returns all 9 tools', () => {
  const tools = createFormEditTools('form-1');
  expect(Object.keys(tools)).toEqual([
    'listFields', 'getField', 'addField', 'updateField',
    'removeField', 'reorderFields', 'updateLayout',
    'renamePage', 'reorderPages',
  ]);
});
```

Also update the existing `'returns all 7 tools'` test — change to `'returns all 9 tools'` and update the expected array to include `'renamePage'` and `'reorderPages'`.

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/backend && pnpm test:unit --run src/lib/__tests__/aiFormEditTools.test.ts
```

Expected: FAIL — `tools.renamePage` is undefined

- [ ] **Step 3: Add `renamePage` and `reorderPages` tools to `aiFormEditTools.ts`**

In `apps/backend/src/lib/aiFormEditTools.ts`, add these two tools to the returned object (after `updateLayout`):

```typescript
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
```

Also add two new variants to the `FormOperation` union type:
```typescript
| { type: 'RENAME_PAGE'; pageId: string; newTitle: string }
| { type: 'REORDER_PAGES'; pageIds: string[] }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/backend && pnpm test:unit --run src/lib/__tests__/aiFormEditTools.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: TypeScript check**

```bash
cd apps/backend && pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "feat(ai): add renamePage and reorderPages tools"
```

---

## Task 5: applyAIOp page operations + buildOpLabel (Feature 3 — Frontend)

**Files:**
- Modify: `apps/form-app/src/lib/applyAIOp.ts`
- Modify: `apps/form-app/src/lib/__tests__/applyAIOp.test.ts`
- Modify: `apps/form-app/src/hooks/useAIChat.ts`

- [ ] **Step 1: Write failing tests**

In `apps/form-app/src/lib/__tests__/applyAIOp.test.ts`, add a new `makeStore` with `updatePageTitle` and `reorderPages`, then add test blocks:

Update the `makeStore` function to include page management:
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
    ...overrides,
  };
}
```

Add test blocks after the existing `UPDATE_LAYOUT` tests:

```typescript
describe('applyAIOp — RENAME_PAGE', () => {
  it('calls updatePageTitle with correct args', () => {
    const store = makeStore();
    applyAIOp({ type: 'RENAME_PAGE', pageId: 'page-1', newTitle: 'Basic Info' }, store as any);
    expect(store.updatePageTitle).toHaveBeenCalledWith('page-1', 'Basic Info');
  });

  it('does nothing when pageId not found', () => {
    const store = makeStore();
    applyAIOp({ type: 'RENAME_PAGE', pageId: 'unknown', newTitle: 'X' }, store as any);
    expect(store.updatePageTitle).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — REORDER_PAGES', () => {
  it('calls reorderPages to move page to target index', () => {
    const store = makeStore();
    // Desired: page-2 first, then page-1
    applyAIOp({ type: 'REORDER_PAGES', pageIds: ['page-2', 'page-1'] }, store as any);
    expect(store.reorderPages).toHaveBeenCalledWith(1, 0);
  });

  it('does nothing when order is already correct', () => {
    const store = makeStore();
    applyAIOp({ type: 'REORDER_PAGES', pageIds: ['page-1', 'page-2'] }, store as any);
    expect(store.reorderPages).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/form-app && npx jest src/lib/__tests__/applyAIOp.test.ts
```

Expected: FAIL — `RENAME_PAGE` and `REORDER_PAGES` cases not handled

- [ ] **Step 3: Add RENAME_PAGE and REORDER_PAGES to `applyAIOp.ts`**

In `apps/form-app/src/lib/applyAIOp.ts`:

1. Update the `store` parameter type to include `updatePageTitle` and `reorderPages`:
```typescript
export function applyAIOp(
  op: any,
  store: Pick<
    FormBuilderState,
    'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField' |
    'reorderFields' | 'updateLayout' | 'updatePageTitle' | 'reorderPages'
  >
): void {
```

2. Add two new cases to the switch, after `UPDATE_LAYOUT`:
```typescript
case 'RENAME_PAGE': {
  const pageExists = (store.pages as any[]).some((p: any) => p.id === op.pageId);
  if (!pageExists) return;
  store.updatePageTitle(op.pageId, op.newTitle);
  break;
}

case 'REORDER_PAGES': {
  const desired: string[] = op.pageIds ?? [];
  const current: string[] = (store.pages as any[]).map((p: any) => p.id);
  for (let i = 0; i < desired.length; i++) {
    const fromIdx = current.indexOf(desired[i]);
    if (fromIdx !== -1 && fromIdx !== i) {
      store.reorderPages(fromIdx, i);
      const [moved] = current.splice(fromIdx, 1);
      current.splice(i, 0, moved);
    }
  }
  break;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/form-app && npx jest src/lib/__tests__/applyAIOp.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Update `buildOpLabel` in `useAIChat.ts`**

In `apps/form-app/src/hooks/useAIChat.ts`, add two cases to `buildOpLabel`:

```typescript
case 'RENAME_PAGE': return `Renamed page "${(op.newTitle as string) ?? 'page'}"`;
case 'REORDER_PAGES': return 'Reordered pages';
```

- [ ] **Step 6: TypeScript check**

```bash
cd apps/form-app && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/form-app/src/lib/applyAIOp.ts apps/form-app/src/lib/__tests__/applyAIOp.test.ts apps/form-app/src/hooks/useAIChat.ts
git commit -m "feat(ai): applyAIOp handles RENAME_PAGE + REORDER_PAGES; update buildOpLabel"
```

---

## Task 6: Quick action chips (Feature 4)

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`
- Modify: `apps/form-app/src/locales/en/aiEditDrawer.json`
- Modify: `apps/form-app/src/locales/ta/aiEditDrawer.json`

- [ ] **Step 1: Add chip keys to locale files**

In `apps/form-app/src/locales/en/aiEditDrawer.json`, add a `chips` object:
```json
"chips": {
  "analyseForm": "Analyse form",
  "listAllFields": "List all fields",
  "makeAllRequired": "Make all required"
}
```

In `apps/form-app/src/locales/ta/aiEditDrawer.json`, add:
```json
"chips": {
  "analyseForm": "படிவத்தை பகுப்பாய்",
  "listAllFields": "அனைத்து புலங்களையும் பட்டியலிடு",
  "makeAllRequired": "அனைத்தையும் கட்டாயமாக்கு"
}
```

- [ ] **Step 2: Add `QuickChips` component and wire it in `AIEditDrawer.tsx`**

In `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`:

1. Add the `QUICK_CHIPS` constant and `QuickChips` component before `AIEditDrawer`:

```tsx
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
```

2. In the drawer JSX, add `<QuickChips>` just above the textarea wrapper `<div>` inside the `{/* Input */}` section:

```tsx
{/* Input */}
<div className="border-t border-border p-3">
  {!isStreaming && activeConversationId && (
    <QuickChips
      onChipClick={(prompt) => sendMessage(prompt)}
      disabled={isStreaming}
    />
  )}
  <div className={cn(/* existing textarea wrapper classes */)}>
    {/* existing textarea + button */}
  </div>
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/form-app && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx apps/form-app/src/locales/en/aiEditDrawer.json apps/form-app/src/locales/ta/aiEditDrawer.json
git commit -m "feat(ai): add quick action chips (Analyse form, List all fields, Make all required)"
```

---

## Final Verification

After all 6 tasks, manually test in the browser:

- [ ] Send a message → watch status text appear (*"Reading form structure..."*, *"Adding field..."*) then disappear when done
- [ ] Ask AI to *"make the name field accept max 30 characters"* → field gets maxLength validation
- [ ] Ask AI to *"set age field to accept 18 to 99"* → number field gets min/max
- [ ] Ask AI to *"rename page 1 to Personal Info"* → page title updates in sidebar
- [ ] Ask AI to *"swap the order of page 1 and page 2"* → pages reorder
- [ ] Click **Analyse form** chip → AI reads all fields and gives structured feedback
- [ ] Click **List all fields** chip → AI lists all fields by page
- [ ] Chips disappear while streaming and reappear after response completes
