# Confirm-Gated Destructive AI Actions + Field-Type Conversion

**Date:** 2026-06-02
**Status:** Approved
**Branch:** `feat/ai-confirm-destructive-and-convert`

---

## Problem

Two gaps in the AI form-builder chat:

1. **Field-type conversion doesn't work.** There is no `changeFieldType` tool, and `updateFields`
   deliberately excludes `type`. Each field type is a different class with a different shape
   (text → `validation.minLength/maxLength`; select/radio/checkbox → `options[]`; number →
   `min/max`; date → `minDate/maxDate`) and a validation discriminator. Mutating `type` in place
   would corrupt the field and — critically — **break response data**: responses are stored as
   `data: { [fieldId]: value }`, so a value saved for a text field won't match a select field
   under the same id. Analytics, the responses table, and exports all read `response.data[fieldId]`
   assuming a consistent shape.

2. **Deletions apply immediately, no confirmation.** `removeFields` and `removePage` flow straight
   through `applyAIOp` to the store. Deleting a field/page silently orphans existing response data
   keyed by that field id, with no warning and no chance to reconsider.

---

## Decision

- **Conversion = delete-old + create-new (NEW id).** Keeping the id would break analytics/table/
  export (shape-mismatched values under one id). So conversion removes the old field and inserts a
  new field of the new type at the same position with a **new id**, preserving label/required/
  placeholder/hint where compatible. Old responses retain their original values as immutable
  history; they do not carry over to the new field.
- **All three destructive actions are propose-then-confirm:** delete field(s), delete page, convert
  field type. They never auto-apply. They mirror the existing `proposeValidation` pattern.
- **Scope: AI chat only.** The manual builder keeps its current behavior (it has undo).
- **Warnings show an exact per-field response count** via a cheap JSONB query.

---

## Architecture

Mirror the proven `proposeValidation` flow (tool returns a *proposal* op carrying no mutation →
`applyAIOp` stores it as "pending" without mutating or invalidating schema → a card renders a
warning + Accept/Dismiss → only Accept performs the real store mutation, then invalidates schema).

```
AI calls removeFields | removePage | proposeFieldTypeChange
  └─ tool.execute() (server): compute response counts, return PROPOSE_* op (NO mutation)
       └─ SSE → applyAIOp: setPendingDestructiveActions([...])   (no store mutation, no invalidate)
            └─ <DestructiveActionCard/> renders warning + count + Accept / Dismiss
                 ├─ Accept  → store mutation (removeField / removePage / convertFieldType) → invalidateSchema(formId)
                 └─ Dismiss → clear pending entry; nothing changes
```

### Why this shape
- Reuses an already-working, already-tested confirmation mechanism — low risk.
- The proposal op is inert, so a disconnect/refresh mid-proposal loses nothing.
- Real mutation still happens through existing store actions (`removeField`, `removePage`) and one
  new atomic action (`convertFieldType`), so Yjs/collaboration/undo all behave normally.

---

## Backend Changes

### `apps/backend/src/services/responseService.ts`
- `countResponsesPerField(formId, fieldIds: string[]): Promise<Record<string, number>>` — per-field
  count of responses with a non-empty value. Raw JSONB: `data->>fieldId` is not null/empty,
  `deletedAt IS NULL`. Used by delete-field and convert cards.
- `countResponsesReferencingAnyField(formId, fieldIds: string[]): Promise<number>` — distinct
  responses touching any of the given fields (`data ?| array[...]`). Used by the page-delete card
  (count distinct affected responses across the page's fields).

### `apps/backend/src/lib/aiFormEditTools.ts`
- `createFormEditTools(schema, opts?: { includeReadTools?: boolean; formId?: string })` — `formId`
  enables count queries inside `execute`.
- `removeFields.execute` → returns `{ type: 'PROPOSE_DELETE_FIELDS', fields: [{ fieldId, label, responseCount }], ... }` (no longer `REMOVE_FIELDS`).
- `removePage.execute` → returns `{ type: 'PROPOSE_DELETE_PAGE', pageId, pageTitle, fieldCount, responseCount }` (keeps last-page guard returning `{error}`).
- New `proposeFieldTypeChange` tool: input `{ fieldId, newFieldType }` → returns
  `{ type: 'PROPOSE_FIELD_TYPE_CHANGE', fieldId, label, currentType, newFieldType, responseCount }`.
  Guards: error if field not found, or if `newFieldType === currentType`.
- Update the `FormOperation` union: remove `REMOVE_FIELDS`/`REMOVE_PAGE` direct ops, add
  `PROPOSE_DELETE_FIELDS`, `PROPOSE_DELETE_PAGE`, `PROPOSE_FIELD_TYPE_CHANGE`.
- Tool `execute` is `async` and resolves counts via the service (when `formId` provided; default 0).

### `apps/backend/src/lib/formEditAgent.ts`
- Thread `formId` through `FormEditAgentOptions` → `createFormEditTools`.

### `apps/backend/src/routes/aiChat.ts`
- Pass `formId: conv.formId` when building the agent.
- `STATIC_SYSTEM_PROMPT`: 
  - Deleting fields/pages and converting field types **require user confirmation** — the tool only
    *proposes*; the model must tell the user to confirm in the card, and must NOT claim the change
    is done.
  - `proposeFieldTypeChange` is the supported way to change a field's type. Note it deletes and
    recreates the field (responses won't carry over) and needs confirmation.

---

## Frontend Changes (`apps/form-app/src`)

### `store/slices/aiSlice.ts`
- State `pendingDestructiveActions: DestructiveAction[]` where `DestructiveAction` is a discriminated
  union: `{ kind: 'delete-fields'; fields: {fieldId,label,responseCount}[] }` |
  `{ kind: 'delete-page'; pageId; pageTitle; fieldCount; responseCount }` |
  `{ kind: 'convert'; fieldId; label; currentType; newFieldType; responseCount }`.
- Each gets a stable `id` (e.g. derived from op/toolCallId) so Accept/Dismiss target one entry.
- `setPendingDestructiveActions`, `acceptDestructiveAction(id) → DestructiveAction | null`,
  `dismissDestructiveAction(id)` — exactly parallel to the validation-suggestion actions.

### `store/slices/fieldsSlice.ts`
- New `convertFieldType(pageId, fieldId, newType)`: in one `ydoc.transact`, read the existing field's
  index + label/required/placeholder/hint, remove it, and insert a freshly-created field of `newType`
  (via `createFormField`/`serializeFieldToYMap`) at the same index with a **new id**. Carry over
  compatible props only; choice types get default options if none.

### `lib/applyAIOp.ts`
- Add `PROPOSE_DELETE_FIELDS`, `PROPOSE_DELETE_PAGE`, `PROPOSE_FIELD_TYPE_CHANGE` cases → push to
  `setPendingDestructiveActions` (no mutation). Exclude all three from `invalidateSchema` (like
  `PROPOSE_VALIDATION`).
- Keep a `default` no-op (legacy `REMOVE_FIELDS`/`REMOVE_PAGE` ops from old conversations are never
  re-applied — applyAIOp only runs on live calls — but guard anyway).

### `components/form-builder/tool-parts/DestructiveActionCard.tsx` (new)
- Reads `pendingDestructiveActions` + accept/dismiss actions from the store (like
  `ValidationSuggestionCard`). For each entry renders an amber/red warning card:
  - delete-fields: "Delete field "<label>"? Used in N of the form's responses."
  - delete-page: "Delete page "<title>" and its M field(s)? Affects N responses."
  - convert: "Convert "<label>" from <currentType> to <newType>? This deletes the field and creates
    a new one — N existing response(s) won't carry over."
  - Accept → resolve store action (`removeField` loop / `removePage` / `convertFieldType`) then
    `invalidateSchema(formId)`; Dismiss → `dismissDestructiveAction`.

### `lib/aiAgentTypes.ts`
- Remove `removeFields`/`removePage` from `MUTATION_TOOL_NAMES` (they are confirmations now, not
  direct mutations). Add `proposeFieldTypeChange`. Update per-tool interfaces, the three union types,
  and `output.type` literals to the new PROPOSE_* ops.

### `components/form-builder/AIEditDrawer.tsx`
- Render `<DestructiveActionCard/>` (next to `<ValidationSuggestionCard/>`).
- Dispatch `tool-removeFields`, `tool-removePage`, `tool-proposeFieldTypeChange` as an
  "⚠ awaiting confirmation" chip (like `tool-proposeValidation`), not a "done" pill. Any other
  `tool-*` still routes to `MutationToolPart` (back-compat).

### i18n
- `locales/en/aiEditDrawer.json` + `locales/ta/aiEditDrawer.json`: card titles, warnings, Accept/
  Dismiss labels, the new tool-status chips. Tamil = real translations.

---

## Testing

- **Backend**
  - `responseService`: `countResponsesPerField` / `countResponsesReferencingAnyField` return correct
    counts (mocked repo / raw query). Empty-value and missing-key cases count as 0.
  - `aiFormEditTools`: `removeFields`/`removePage`/`proposeFieldTypeChange` return the PROPOSE_* ops
    with labels + counts; `proposeFieldTypeChange` errors on unknown field and on same-type.
  - Keep branch coverage ≥ 80% (add tests for new branches: count helpers, guards).
- **Frontend**
  - type-check clean.
  - `applyAIOp`: PROPOSE_* cases set pending and do **not** mutate the store or call invalidateSchema.
  - `convertFieldType`: preserves label/required, changes type, assigns a new id, keeps position.
- **Docs:** update `docs/ai-builder-chat-capabilities.md` — S5 now supported (convert = delete+
  recreate, confirmed); deletions are confirm-gated.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Model claims "deleted" before user confirms | System-prompt rule: propose + ask to confirm, never claim done. |
| Old conversations carry legacy `REMOVE_FIELDS`/`REMOVE_PAGE` parts | Render via default chip; `applyAIOp` default no-op. Never re-applied. |
| Per-field count query slow on large forms | Single indexed JSONB query over `response` (already indexed by `formId`); counts only the listed fieldIds. |
| Convert loses response data unexpectedly | That's the point — but the card states the exact count up front and requires Accept. |
| Coverage dips below 80% | Add focused unit tests for new helpers/branches. |

---

## Files Touched

| File | Change |
|---|---|
| `apps/backend/src/services/responseService.ts` | + count helpers |
| `apps/backend/src/lib/aiFormEditTools.ts` | removeFields/removePage → propose; + proposeFieldTypeChange; FormOperation union; formId opt |
| `apps/backend/src/lib/formEditAgent.ts` | thread formId |
| `apps/backend/src/routes/aiChat.ts` | pass formId; system-prompt confirmation rules + convert guidance |
| `apps/form-app/src/store/slices/aiSlice.ts` | pendingDestructiveActions + accept/dismiss |
| `apps/form-app/src/store/slices/fieldsSlice.ts` | + convertFieldType |
| `apps/form-app/src/lib/applyAIOp.ts` | PROPOSE_* cases (no mutate); invalidation exclusion |
| `apps/form-app/src/lib/aiAgentTypes.ts` | tool names/interfaces/unions |
| `apps/form-app/src/components/form-builder/tool-parts/DestructiveActionCard.tsx` | new |
| `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` | render card + confirm chips |
| `apps/form-app/src/locales/{en,ta}/aiEditDrawer.json` | strings |
| `docs/ai-builder-chat-capabilities.md` | S5 + deletion confirmation updates |
| backend `__tests__/*`, form-app tests | new + updated |
