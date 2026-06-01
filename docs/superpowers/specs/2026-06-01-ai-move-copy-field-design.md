# AI Move & Copy Field Tools

**Date:** 2026-06-01  
**Status:** Approved

---

## Problem

The AI builder chat has no tools for moving a field to a different page or copying a field to another page. Both operations exist in the Zustand store (`moveFieldBetweenPages`, `copyFieldToPage`) but are not exposed through any AI tool. Users must do these operations manually in the builder UI.

---

## Solution

Two new tools: `moveField` and `copyField`. Both support optional position control via `insertAfterFieldId`, consistent with the existing `addField` tool.

---

## Tool Definitions (Backend)

### `moveField`

```ts
moveField: tool({
  description: 'Move a field to a different page. Use listFields to get target page field IDs if you need insertAfterFieldId for positioning; null to append.',
  inputSchema: z.object({
    fieldId: z.string().describe('The field ID to move — get it from listFields'),
    targetPageId: z.string().describe('The destination page ID — get it from listFields'),
    insertAfterFieldId: z.string().nullable().describe('Insert after this field ID on the target page; null to append at end'),
  }),
  execute: async (args) => ({ type: 'MOVE_FIELD' as const, ...args }),
}),
```

### `copyField`

```ts
copyField: tool({
  description: 'Copy a field to a different page, creating a duplicate with a new ID. Use listFields to get target page field IDs if you need insertAfterFieldId; null to append.',
  inputSchema: z.object({
    fieldId: z.string().describe('The source field ID — get it from listFields'),
    targetPageId: z.string().describe('The destination page ID — get it from listFields'),
    insertAfterFieldId: z.string().nullable().describe('Insert after this field ID on the target page; null to append at end'),
  }),
  execute: async (args) => ({ type: 'COPY_FIELD' as const, ...args }),
}),
```

Add both to the `FormOperation` union in `aiFormEditTools.ts`:
```ts
| { type: 'MOVE_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null }
| { type: 'COPY_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null }
```

---

## System Prompt Additions (`buildSystemPrompt` in `aiChat.ts`)

Append two lines:

```
- Use moveField to move a field to a different page. Call listFields first to get the target page's field IDs if you need to position it with insertAfterFieldId.
- Use copyField to duplicate a field onto a different page. The copy gets a new ID; all other properties (label, required, placeholder, hint, options) are preserved.
```

---

## Frontend — `applyAIOp.ts`

### `MOVE_FIELD`

Add `moveFieldBetweenPages` to the `Pick<FormBuilderState, ...>` type parameter.

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

### `COPY_FIELD`

Does **not** use `store.copyFieldToPage` (no position control). Instead reads source field data directly and calls `addFieldAtIndex` or `addField` on the target page. Creates a new field with a new auto-generated ID.

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

---

## Frontend — `aiAgentTypes.ts`

Add two new tool part interfaces:

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

Add both to `FormEditToolPart` and `MutationToolPart` unions.

Add to `MUTATION_TOOL_NAMES`:
```ts
export const MUTATION_TOOL_NAMES = new Set([
  ...existing...,
  'moveField', 'copyField',
]);
```

---

## Frontend — `MutationToolPart.tsx`

Add action labels for the two new tool types:

```ts
case 'tool-moveField': return 'Moving field…';
case 'tool-copyField': return 'Copying field…';
```

---

## Capability Doc Update (`docs/ai-builder-chat-capabilities.md`)

Update section 2e — change both M1 and M2 from ❌ to ✅ with example prompts and expected behaviour.

---

## Error Handling

- `MOVE_FIELD`: if source field not found or target page not found → silent skip (consistent with all other op handlers)
- `MOVE_FIELD`: if `insertAfterFieldId` not found on target page → appends to end (graceful fallback)
- `COPY_FIELD`: same fallbacks
- Neither tool adds safety guards beyond what the store already enforces (e.g. store prevents moving the last field off a page in some implementations — check at runtime)

---

## Testing

- `aiFormEditTools.test.ts`: add execute tests for `moveField` (returns `MOVE_FIELD` op) and `copyField` (returns `COPY_FIELD` op)
- `applyAIOp` unit test (if one exists): add cases for `MOVE_FIELD` and `COPY_FIELD`
- `aiFormEditTools.test.ts` tool count: update from 14 to 16
- `aiAgentTypes.ts` description length test: add `moveField` ≤90 and `copyField` ≤90 limits

---

## Files Changed

| File | Change |
|---|---|
| `apps/backend/src/lib/aiFormEditTools.ts` | Add `moveField`, `copyField` tools + `FormOperation` entries |
| `apps/backend/src/routes/aiChat.ts` | Add 2 system prompt lines |
| `apps/form-app/src/lib/aiAgentTypes.ts` | Add `MoveFieldToolPart`, `CopyFieldToolPart`, update unions + `MUTATION_TOOL_NAMES` |
| `apps/form-app/src/lib/applyAIOp.ts` | Add `MOVE_FIELD` + `COPY_FIELD` cases, add `moveFieldBetweenPages` to Pick |
| `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx` | Add labels for 2 new tool types |
| `docs/ai-builder-chat-capabilities.md` | Update section 2e from ❌ to ✅ |
