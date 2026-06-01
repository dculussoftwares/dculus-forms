# AI Move & Copy Field Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose two new AI tools — `moveField` and `copyField` — so the AI can move or duplicate a field between pages with optional position control.

**Architecture:** Backend adds two tools to `createFormEditTools` returning `MOVE_FIELD` / `COPY_FIELD` op objects. Frontend `applyAIOp` handles both ops: `MOVE_FIELD` delegates to `store.moveFieldBetweenPages`; `COPY_FIELD` reads the source field from the store then calls `store.addFieldAtIndex` / `store.addField` (bypasses `copyFieldToPage` to gain position control). Both tools are wired into `MUTATION_TOOL_NAMES` so they auto-apply through the existing mutation pipeline.

**Tech Stack:** Node.js, Vitest (backend); React, Zustand, Y.js (frontend).

---

## File Map

| File | Change |
|---|---|
| `apps/backend/src/lib/aiFormEditTools.ts` | Add `moveField`, `copyField` tools + 2 `FormOperation` union entries |
| `apps/backend/src/routes/aiChat.ts` | Add 2 system prompt lines |
| `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts` | Add `moveField` + `copyField` execute tests; update tool count to 16; update description length limits |
| `apps/form-app/src/lib/aiAgentTypes.ts` | Add `MoveFieldToolPart`, `CopyFieldToolPart` interfaces; add to unions + `MUTATION_TOOL_NAMES` |
| `apps/form-app/src/lib/applyAIOp.ts` | Add `MOVE_FIELD` + `COPY_FIELD` cases; add `moveFieldBetweenPages` to Pick |
| `apps/form-app/src/hooks/useAIChat.ts` | Add `'MOVE_FIELD'` + `'COPY_FIELD'` to `buildOpLabel` |
| `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx` | Add labels for `tool-moveField` + `tool-copyField` |
| `docs/ai-builder-chat-capabilities.md` | Update section 2e from ❌ to ✅ |

---

### Task 1: Backend tools + system prompt + tests

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts`
- Modify: `apps/backend/src/routes/aiChat.ts`
- Modify: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts` after the existing `describe('proposeValidation', ...)` block:

```ts
describe('moveField', () => {
  it('returns MOVE_FIELD op with null insertAfterFieldId', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.moveField.execute!(
      { fieldId: 'f-1', targetPageId: 'page-2', insertAfterFieldId: null },
      { messages: [], toolCallId: 'test' }
    ) as any;
    expect(result.type).toBe('MOVE_FIELD');
    expect(result.fieldId).toBe('f-1');
    expect(result.targetPageId).toBe('page-2');
    expect(result.insertAfterFieldId).toBeNull();
  });

  it('returns MOVE_FIELD op with insertAfterFieldId', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.moveField.execute!(
      { fieldId: 'f-1', targetPageId: 'page-2', insertAfterFieldId: 'f-3' },
      { messages: [], toolCallId: 'test' }
    ) as any;
    expect(result.insertAfterFieldId).toBe('f-3');
  });
});

describe('copyField', () => {
  it('returns COPY_FIELD op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.copyField.execute!(
      { fieldId: 'f-2', targetPageId: 'page-2', insertAfterFieldId: 'f-3' },
      { messages: [], toolCallId: 'test' }
    ) as any;
    expect(result.type).toBe('COPY_FIELD');
    expect(result.fieldId).toBe('f-2');
    expect(result.insertAfterFieldId).toBe('f-3');
  });
});
```

Also update the tool count test from 14 to 16:
```ts
it('returns all 16 tools', () => {
  const tools = createFormEditTools(mockSchema);
  expect(Object.keys(tools)).toEqual([
    'listFields', 'getField', 'addField', 'updateField',
    'removeField', 'reorderFields', 'updateLayout',
    'renamePage', 'reorderPages', 'addPage', 'removePage',
    'navigateToPage', 'bulkUpdateFields', 'proposeValidation',
    'moveField', 'copyField',
  ]);
});
```

Also add description length limits for the two new tools inside the `describe('tool description lengths', ...)` block. Add to the `LIMITS` object:
```ts
moveField:         140,
copyField:         155,
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -E "(moveField|copyField|16 tools)" | head -10
```

Expected: `tools.moveField is undefined`, tool count test fails expecting 16.

- [ ] **Step 3: Add `moveField` and `copyField` tools to `aiFormEditTools.ts`**

Add before the closing `};` of the `return {` block (after `proposeValidation`):

```ts
moveField: tool({
  description:
    'Move a field to a different page. Use listFields to get target page field IDs for insertAfterFieldId positioning; null to append at end.',
  inputSchema: z.object({
    fieldId: z.string().describe('The field ID to move — get it from listFields'),
    targetPageId: z.string().describe('Destination page ID — get it from listFields'),
    insertAfterFieldId: z.string().nullable().describe('Insert after this field ID on the target page; null to append at end'),
  }),
  execute: async (args) => ({ type: 'MOVE_FIELD' as const, ...args }),
}),

copyField: tool({
  description:
    'Copy a field to a different page, creating a duplicate with a new ID. Preserves label, required, placeholder, hint, and options. Use listFields for insertAfterFieldId positioning; null to append.',
  inputSchema: z.object({
    fieldId: z.string().describe('Source field ID — get it from listFields'),
    targetPageId: z.string().describe('Destination page ID — get it from listFields'),
    insertAfterFieldId: z.string().nullable().describe('Insert after this field ID on the target page; null to append at end'),
  }),
  execute: async (args) => ({ type: 'COPY_FIELD' as const, ...args }),
}),
```

Also add both to the `FormOperation` union at the bottom of the file:

```ts
| { type: 'MOVE_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null }
| { type: 'COPY_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null }
```

- [ ] **Step 4: Add system prompt lines in `aiChat.ts`**

In `buildSystemPrompt`, append two lines to the returned template string:

```
- Use moveField to move a field to a different page. Call listFields first to get the target page's field IDs if you need to position it with insertAfterFieldId.
- Use copyField to duplicate a field onto a different page. The copy gets a new ID; all other properties are preserved.
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -E "(moveField|copyField|16 tools|✓|✗)" | head -15
```

Expected: all 4 new tests pass (2 for moveField, 1 for copyField, tool count = 16).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/routes/aiChat.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "feat(ai): add moveField and copyField backend tools"
```

---

### Task 2: Frontend wiring

**Files:**
- Modify: `apps/form-app/src/lib/aiAgentTypes.ts`
- Modify: `apps/form-app/src/lib/applyAIOp.ts`
- Modify: `apps/form-app/src/hooks/useAIChat.ts`
- Modify: `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx`
- Modify: `docs/ai-builder-chat-capabilities.md`

- [ ] **Step 1: Add types to `aiAgentTypes.ts`**

Add two new interfaces after `BulkUpdateFieldsToolPart`:

```ts
export interface MoveFieldToolPart {
  type: 'tool-moveField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string; targetPageId: string; insertAfterFieldId: string | null };
  output?: { type: 'MOVE_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null };
}

export interface CopyFieldToolPart {
  type: 'tool-copyField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string; targetPageId: string; insertAfterFieldId: string | null };
  output?: { type: 'COPY_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null };
}
```

Add both to `FormEditToolPart` union:
```ts
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
  | RemovePageToolPart
  | NavigateToPageToolPart
  | BulkUpdateFieldsToolPart
  | ProposeValidationToolPart
  | MoveFieldToolPart
  | CopyFieldToolPart;
```

Add both to `MutationToolPart` union:
```ts
export type MutationToolPart =
  | AddFieldToolPart
  | UpdateFieldToolPart
  | RemoveFieldToolPart
  | ReorderFieldsToolPart
  | UpdateLayoutToolPart
  | RenamePageToolPart
  | ReorderPagesToolPart
  | AddPageToolPart
  | RemovePageToolPart
  | NavigateToPageToolPart
  | BulkUpdateFieldsToolPart
  | MoveFieldToolPart
  | CopyFieldToolPart;
```

Add `'moveField'` and `'copyField'` to `MUTATION_TOOL_NAMES`:
```ts
export const MUTATION_TOOL_NAMES = new Set([
  'addField', 'updateField', 'removeField', 'reorderFields',
  'updateLayout', 'renamePage', 'reorderPages', 'addPage', 'removePage',
  'navigateToPage', 'bulkUpdateFields', 'moveField', 'copyField',
]);
```

- [ ] **Step 2: Add `MOVE_FIELD` and `COPY_FIELD` cases to `applyAIOp.ts`**

First, add `moveFieldBetweenPages` to the `Pick` type parameter:

```ts
export function applyAIOp(
  op: any,
  store: Pick<
    FormBuilderState,
    | 'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField'
    | 'reorderFields' | 'updateLayout' | 'updatePageTitle' | 'reorderPages'
    | 'addPageAtPosition' | 'removePage' | 'setSelectedPage'
    | 'setAIHighlightedFieldId' | 'setPendingValidationSuggestions'
    | 'moveFieldBetweenPages'
  >,
  formId?: string
): void {
```

Add `MOVE_FIELD` case inside the switch (after `REMOVE_PAGE`):

```ts
case 'MOVE_FIELD': {
  const sourcePageId = findPageForField(store.pages, op.fieldId);
  if (!sourcePageId) break;

  const targetPage = (store.pages as any[]).find((p: any) => p.id === op.targetPageId);
  if (!targetPage) break;

  let insertIndex: number | undefined;
  if (op.insertAfterFieldId) {
    const idx = (targetPage.fields ?? []).findIndex((f: any) => f.id === op.insertAfterFieldId);
    if (idx !== -1) insertIndex = idx + 1;
  }

  store.moveFieldBetweenPages(sourcePageId, op.targetPageId, op.fieldId, insertIndex);
  break;
}
```

Add `COPY_FIELD` case after `MOVE_FIELD`:

```ts
case 'COPY_FIELD': {
  let sourceField: any = null;
  for (const page of store.pages as any[]) {
    sourceField = (page.fields ?? []).find((f: any) => f.id === op.fieldId) ?? null;
    if (sourceField) break;
  }
  if (!sourceField) break;

  const targetPage = (store.pages as any[]).find((p: any) => p.id === op.targetPageId);
  if (!targetPage) break;

  const fieldType = AI_TYPE_MAP[sourceField.type] ?? FieldType.TEXT_INPUT_FIELD;
  const isChoice = CHOICE_TYPES.has(fieldType);
  const fieldData = {
    label: sourceField.label,
    required: sourceField.required ?? false,
    placeholder: sourceField.placeholder ?? '',
    defaultValue: '',
    prefix: '',
    hint: sourceField.hint ?? '',
    ...(isChoice && { options: sourceField.options ?? [] }),
  };

  if (op.insertAfterFieldId) {
    const idx = (targetPage.fields ?? []).findIndex((f: any) => f.id === op.insertAfterFieldId);
    if (idx !== -1) {
      store.addFieldAtIndex(op.targetPageId, fieldType, fieldData, idx + 1);
      break;
    }
  }
  store.addField(op.targetPageId, fieldType, fieldData);
  break;
}
```

- [ ] **Step 3: Add `buildOpLabel` entries in `useAIChat.ts`**

In `buildOpLabel`, add two cases before the `default`:

```ts
case 'MOVE_FIELD': return 'Moved field';
case 'COPY_FIELD': return 'Copied field';
```

- [ ] **Step 4: Add labels to `MutationToolPart.tsx`**

In `getActionLabel`, add two cases before the last existing case:

```ts
case 'tool-moveField': return 'Moving field…';
case 'tool-copyField': return 'Copying field…';
```

Note: TypeScript will error if these are missing because `MutationToolPart` is now a union that includes `MoveFieldToolPart` and `CopyFieldToolPart`, making the switch non-exhaustive.

- [ ] **Step 5: Update capability doc**

In `docs/ai-builder-chat-capabilities.md`, replace section 2e (the move/copy NOT supported section) with:

```markdown
### 2e. Move / Copy Field Between Pages

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| M1 | `"Move the Phone field from page 1 to page 2"` | AI calls listFields to get page IDs, then moveField. Canvas navigates to page 2. Field disappears from page 1. |
| M2 | `"Move Email to page 2 after Full Name"` | Moves Email, inserts it immediately after the Full Name field on page 2. |
| M3 | `"Copy the Address field to page 3"` | Copies field to page 3 (appended). New field gets a new ID; all properties preserved. |
| M4 | `"Copy Email to page 2 before Phone"` | Copies Email, inserts before Phone on page 2 (pass Phone's ID as insertAfterFieldId of the preceding field, or null if first). |
```

- [ ] **Step 6: Run type-check**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm type-check 2>&1 | grep -i error | head -20
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit 2>&1 | tail -6
```

Expected: all 1981 + new backend tests passing (only pre-existing failures if any).

- [ ] **Step 8: Commit**

```bash
git add apps/form-app/src/lib/aiAgentTypes.ts apps/form-app/src/lib/applyAIOp.ts apps/form-app/src/hooks/useAIChat.ts apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx docs/ai-builder-chat-capabilities.md
git commit -m "feat(ai-frontend): wire moveField and copyField tools — MOVE_FIELD + COPY_FIELD in applyAIOp"
```
