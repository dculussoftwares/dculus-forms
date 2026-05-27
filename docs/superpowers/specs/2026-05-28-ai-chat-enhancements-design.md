# AI Chat Enhancements — Design Spec

**Date:** 2026-05-28  
**Status:** Approved for implementation

---

## Overview

Four targeted enhancements to the AI chat form builder:

1. **Tool call transparency** — show what the AI is doing while it works
2. **Field validation editing** — let AI set min/max length, value ranges, selection counts
3. **Page rename + reorder** — complete the multi-page story
4. **Quick action chips + Analyse** — one-click shortcuts above the input

---

## Feature 1: Tool Call Transparency

### Problem
While the AI reads the form and makes edits, users see only bouncing dots. They have no idea if the AI is thinking, reading fields, or applying changes.

### Design

**Backend — `apps/backend/src/routes/aiChat.ts`**

The `fullStream` emits `tool-call` events before each tool executes. Currently ignored. Add a handler that emits a `status` NDJSON chunk:

```
{ type: "status", text: "Reading form structure..." }
```

Tool name → status text mapping:

| toolName | status text |
|---|---|
| `listFields` | `Reading form structure...` |
| `getField` | `Checking field details...` |
| `addField` | `Adding field...` |
| `updateField` | `Updating field...` |
| `removeField` | `Removing field...` |
| `reorderFields` | `Reordering fields...` |
| `updateLayout` | `Updating layout...` |
| `renamePage` | `Renaming page...` |
| `reorderPages` | `Reordering pages...` |

Unknown tools fall back to `Working...`.

**Frontend — `useAIStream.ts`**

Add `onStatus: (text: string) => void` to `AIStreamCallbacks`. Route `status` chunks to this callback.

**Frontend — `useAIChat.ts`**

Add `statusText: string` state (empty string default). Set it on `onStatus`, clear it on `onDone` / `onError`. Expose `statusText` in the hook's return value.

**Frontend — `AIEditDrawer.tsx`**

Replace `TypingIndicator` (3 bouncing dots) with `StatusIndicator`:

```tsx
function StatusIndicator({ text }: { text: string }) {
  // Shows sparkles icon + italic status text if text is non-empty
  // Falls back to 3 bouncing dots if text is empty string
}
```

`streamingMessage` is already passed to the bubble when streaming; pass `statusText` to `StatusIndicator` via the drawer.

---

## Feature 2: Field Validation Editing

### Problem
The `updateField` tool only exposes `label`, `required`, `placeholder`, `hint`, `options`. Users can't set length limits, value ranges, or selection counts via AI.

### Design

**Backend — `apps/backend/src/lib/aiFormEditTools.ts`**

Extend `updateField`'s `updates` Zod schema with a `validation` sub-object:

```typescript
// In updates object — extend the existing Zod schema:
validation: z.object({
  required: z.boolean().optional(),
  minLength: z.number().nullable().optional(),     // text / textarea only
  maxLength: z.number().nullable().optional(),     // text / textarea only
  minSelections: z.number().nullable().optional(), // checkbox only
  maxSelections: z.number().nullable().optional(), // checkbox only
}).optional(),
// NUMBER field: min/max are field-level props (not inside validation)
min: z.number().nullable().optional(),
max: z.number().nullable().optional(),
// DATE field: minDate/maxDate are field-level props (ISO date string)
minDate: z.string().nullable().optional(),
maxDate: z.string().nullable().optional(),
```

Property routing (handled by existing `fieldsSlice.updateField`):
- `validation.minLength` / `validation.maxLength` → written to Y.js validation Y.Map (text/textarea)
- `validation.minSelections` / `validation.maxSelections` → written to Y.js validation Y.Map (checkbox)
- `min` / `max` → written directly to field Y.Map (number field)
- `minDate` / `maxDate` → written directly to field Y.Map (date field)

Update tool description to mention: *"For text/textarea use validation.minLength/maxLength. For number use min/max. For date use minDate/maxDate. For checkbox use validation.minSelections/maxSelections."*

**Frontend — no changes needed**

`applyAIOp`'s `UPDATE_FIELD` case passes `op.updates` directly to `store.updateField`. The store's `updateField` already handles the `validation` sub-object by writing each property to the Y.js validation Y.Map. The store handles type-specific routing (text vs checkbox vs number) internally.

**Example AI interactions:**
- *"Make the name field accept between 2 and 50 characters"* → `updateField({ fieldId, updates: { validation: { minLength: 2, maxLength: 50 } } })`
- *"Require at least 1 option on the checkboxes field"* → `updateField({ fieldId, updates: { validation: { minSelections: 1 } } })`

---

## Feature 3: Page Rename + Reorder

### Problem
AI can add/edit/remove fields on any page but cannot rename pages or change their order.

### Design

**Backend — `apps/backend/src/lib/aiFormEditTools.ts`**

Add two new tools:

```typescript
renamePage: tool({
  description: 'Rename a page. Get the pageId from listFields.',
  inputSchema: z.object({
    pageId: z.string(),
    newTitle: z.string().describe('New title for the page, max 50 characters'),
  }),
  execute: async (args) => ({ type: 'RENAME_PAGE' as const, ...args }),
})

reorderPages: tool({
  description: 'Reorder pages. Provide all page IDs in the desired order.',
  inputSchema: z.object({
    pageIds: z.array(z.string()).describe('All page IDs in the desired new order'),
  }),
  execute: async (args) => ({ type: 'REORDER_PAGES' as const, ...args }),
})
```

**Frontend — `applyAIOp.ts`**

Add two new cases to the switch:

```typescript
case 'RENAME_PAGE': {
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

**Frontend — `applyAIOp.test.ts`**

Add tests:
- `RENAME_PAGE` calls `store.updatePageTitle(pageId, newTitle)`
- `REORDER_PAGES` calls `store.reorderPages` with correct indices
- `REORDER_PAGES` handles already-correct order (no calls)

**Update `buildOpLabel`** in `useAIChat.ts`:
```typescript
case 'RENAME_PAGE': return `Renamed page "${(op.newTitle as string) ?? 'page'}"`;
case 'REORDER_PAGES': return 'Reordered pages';
```

**`FormOperation` type** — add two new variants to the union in `aiFormEditTools.ts`:
```typescript
| { type: 'RENAME_PAGE'; pageId: string; newTitle: string }
| { type: 'REORDER_PAGES'; pageIds: string[] }
```

---

## Feature 4: Quick Action Chips + Analyse

### Design

**`AIEditDrawer.tsx`** — add a `QuickChips` component rendered above the textarea, visible only when `!isStreaming && !!activeConversationId`.

```tsx
const QUICK_CHIPS = [
  {
    label: 'Analyse form',
    icon: Sparkles,
    prompt: `Please analyse this form. Use listFields to read all pages and fields first, then give structured feedback on: (1) field order and logical flow, (2) missing fields for this type of form, (3) unclear or confusing labels, (4) fields that should be required but aren't. Be concise and actionable.`,
  },
  {
    label: 'List all fields',
    icon: null,
    prompt: 'List all fields across every page of this form.',
  },
  {
    label: 'Make all required',
    icon: null,
    prompt: 'Make every field on every page required.',
  },
];
```

Clicking a chip calls `sendMessage(chip.prompt)` directly — same code path as typing and pressing Enter. The chip strip disappears while streaming (since `isStreaming` is true).

**i18n:** Add chip labels and prompts to `en/aiEditDrawer.json` and `ta/aiEditDrawer.json`.

---

## Files Changed

| File | Change |
|---|---|
| `apps/backend/src/routes/aiChat.ts` | Handle `tool-call` events; emit `status` chunks |
| `apps/backend/src/lib/aiFormEditTools.ts` | Add `validation` to `updateField`; add `renamePage` + `reorderPages` tools; update `FormOperation` type |
| `apps/form-app/src/hooks/useAIStream.ts` | Add `onStatus` callback to `AIStreamCallbacks` |
| `apps/form-app/src/hooks/useAIChat.ts` | Add `statusText` state; wire `onStatus`; update `buildOpLabel` |
| `apps/form-app/src/lib/applyAIOp.ts` | Add `RENAME_PAGE` + `REORDER_PAGES` cases |
| `apps/form-app/src/lib/__tests__/applyAIOp.test.ts` | Tests for new op types |
| `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` | Replace `TypingIndicator` with `StatusIndicator`; add `QuickChips` |
| `apps/form-app/src/locales/en/aiEditDrawer.json` | Add chip label/prompt keys |
| `apps/form-app/src/locales/ta/aiEditDrawer.json` | Add chip label/prompt keys |

---

## Out of Scope

- Chip prompts are hard-coded strings (no user-customisable shortcuts)
- Status messages are not persisted to the conversation history (ephemeral during streaming only)
- `min`/`max`/`minDate`/`maxDate` are field-level properties (not in the validation Y.Map) — the store's `fieldsSlice.updateField` handles them via `fieldMap.set(key, value)` in the else branch
- No new store code added; all validation routing uses existing `fieldsSlice` behavior
