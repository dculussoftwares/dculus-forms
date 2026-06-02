# AI Chat Re-Architecture — LOCKED CONTRACT

This is the single source of truth for the consolidated tool/op shapes and the caching
mechanics. Backend and frontend implementations MUST match this exactly. Do not deviate.

---

## A. Consolidated tool set (17 → 13 max; 11 on small forms)

Merges (behavior-preserving):
- `updateField` + `bulkUpdateFields` → **`updateFields`**
- `removeField` + `bulkRemoveFields` → **`removeFields`**
- `moveField` + `copyField` → **`relocateField`** (`mode: 'move' | 'copy'`)
- `reorderFields` + `reorderPages` → **`reorder`** (`scope: 'fields' | 'pages'`)

Unchanged: `addField`, `updateLayout`, `renamePage`, `addPage`, `removePage`,
`navigateToPage`, `proposeValidation` (NEVER merge — suggest-vs-apply contract),
`listFields`, `getField` (read-only; **conditional** — included only on large forms).

### Final tool → op-type map

| Tool | Op `type` | Notes |
|---|---|---|
| `listFields(pageId?)` | — (read) | conditional (large forms) |
| `getField(fieldId)` | — (read) | conditional (large forms) |
| `addField(pageId, insertAfterFieldId, fieldType, label, required, placeholder, options)` | `ADD_FIELD` | unchanged |
| `updateFields(fieldIds[], updates)` | `UPDATE_FIELDS` | `fieldIds` min 1; single edit = 1-elem array |
| `removeFields(fieldIds[])` | `REMOVE_FIELDS` | `fieldIds` min 1 |
| `relocateField(fieldId, targetPageId, insertAfterFieldId, mode)` | `RELOCATE_FIELD` | `mode: 'move' \| 'copy'` |
| `reorder(scope, ids[], pageId?)` | `REORDER` | `scope: 'fields' \| 'pages'`; `pageId` required when `scope='fields'` |
| `updateLayout(content?, customCTAButtonName?)` | `UPDATE_LAYOUT` | unchanged |
| `renamePage(pageId, newTitle)` | `RENAME_PAGE` | unchanged, `newTitle` max 50 |
| `addPage(title, insertAfterPageId)` | `ADD_PAGE` | **MUST keep** pre-generated `pageId` in return |
| `removePage(pageId)` | `REMOVE_PAGE` | **MUST keep** last-page guard (`{error}` if ≤1 page) |
| `navigateToPage(pageId)` | `NAVIGATE_TO_PAGE` | unchanged |
| `proposeValidation(suggestions[], rationale)` | `PROPOSE_VALIDATION` | unchanged |

### `updatesSchema` (shared by `updateFields`) — unchanged from current
```ts
z.object({
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
})
```

### `FormOperation` union (backend `aiFormEditTools.ts`)
```ts
export type FormOperation =
  | { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null }
  | { type: 'UPDATE_FIELDS'; fieldIds: string[]; updates: Record<string, unknown> }
  | { type: 'REMOVE_FIELDS'; fieldIds: string[] }
  | { type: 'RELOCATE_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null; mode: 'move' | 'copy' }
  | { type: 'REORDER'; scope: 'fields' | 'pages'; ids: string[]; pageId?: string }
  | { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string }
  | { type: 'RENAME_PAGE'; pageId: string; newTitle: string }
  | { type: 'ADD_PAGE'; pageId: string; title: string; insertAfterPageId: string | null }
  | { type: 'REMOVE_PAGE'; pageId: string }
  | { type: 'NAVIGATE_TO_PAGE'; pageId: string }
  | { type: 'PROPOSE_VALIDATION'; suggestions: Array<{ fieldId: string; fieldLabel: string; fieldType: string; validation?: { minLength?: number | null; maxLength?: number | null; minSelections?: number | null; maxSelections?: number | null }; min?: number | null; max?: number | null; required?: boolean }>; rationale: string };
```

`createFormEditTools(schema, opts?: { includeReadTools?: boolean })` — when `includeReadTools`
is false, OMIT `listFields` and `getField` from the returned object. Default `true`.

---

## B. Frontend op → store-action mapping (`applyAIOp.ts`)

The store already has every needed action. Map the NEW ops as:

| Op `type` | Store action(s) |
|---|---|
| `ADD_FIELD` | `addFieldAtIndex` (if insertAfter found) else `addField`; `setAIHighlightedFieldId` |
| `UPDATE_FIELDS` | **loop** `updateField(pageId, fieldId, updates)` for each `fieldIds` (resolve each field's page) |
| `REMOVE_FIELDS` | **loop** `removeField(pageId, fieldId)` for each `fieldIds` |
| `RELOCATE_FIELD` mode='move' | `moveFieldBetweenPages(sourcePageId, targetPageId, fieldId, insertIndex?)` |
| `RELOCATE_FIELD` mode='copy' | reconstruct fieldData from source field, `addFieldAtIndex`/`addField` on target (same as current COPY_FIELD logic) |
| `REORDER` scope='fields' | **loop** `reorderFields(pageId, fromIdx, toIdx)` to converge to `ids` order (same as current REORDER_FIELDS) |
| `REORDER` scope='pages' | **loop** `reorderPages(fromIdx, toIdx)` to converge to `ids` order (same as current REORDER_PAGES) |
| `UPDATE_LAYOUT` | `updateLayout({ content?, customCTAButtonName? })` (whitelist keys) |
| `RENAME_PAGE` | `updatePageTitle(pageId, newTitle)` |
| `ADD_PAGE` | `addPageAtPosition(title ?? 'New Page', insertAfterPageId ?? null, pageId)` |
| `REMOVE_PAGE` | `removePage(pageId)` (skip if `pages.length <= 1`) |
| `NAVIGATE_TO_PAGE` | `setSelectedPage(pageId)` |
| `PROPOSE_VALIDATION` | `setPendingValidationSuggestions(suggestions ?? [])` |

Keep the post-mutation `invalidate-schema` fire-and-forget (all except PROPOSE_VALIDATION).

**The reorder/loop convergence and copy-reconstruction logic already exists** for the old
`REORDER_FIELDS`/`REORDER_PAGES`/`COPY_FIELD`/`BULK_*` ops — reuse it verbatim, just keyed
on the new op `type`s.

---

## C. Frontend tool-name surfaces (update all in lockstep)

- `aiAgentTypes.ts`: per-tool UIMessage interfaces (`tool-<name>` + `output.type`), the 3 union
  types (`FormEditToolPart`, `FormEditAgentUIMessage`, `MutationToolPart`), and
  `MUTATION_TOOL_NAMES`.
- New `MUTATION_TOOL_NAMES` = `{ addField, updateFields, removeFields, relocateField, reorder, updateLayout, renamePage, addPage, removePage, navigateToPage }`.
- `useAIChat.ts`: `buildOpLabel(op)` switch — new op types. Default branch returns a generic label.
- `MutationToolPart.tsx`: `getActionLabel` switch — new `tool-*` types. **Add a `default` returning a generic "Working…" label** so legacy parts in old conversations don't break the type/switch.
- `ChangeSummaryCard.tsx`: rebuild `MUTATION_OUTPUT_TYPES` to the NEW op types (and include them ALL — the current set was stale). `ADD_OPS = {ADD_FIELD, ADD_PAGE}`, `REMOVE_OPS = {REMOVE_FIELDS, REMOVE_PAGE}`.
- `AIEditDrawer.tsx` dispatch: render `ListFieldsToolPart`/`GetFieldToolPart`/`proposeValidation`
  by exact type; for everything else `part.type.startsWith('tool-')` route to `MutationToolPart`
  (this makes BOTH new and legacy mutation parts render — back-compat for old conversations).
  `toolStatusLabel` maps `part.type.replace('tool-','')` → i18n `toolStatus.<name>`.
- i18n `apps/form-app/src/locales/{en,ta}/aiEditDrawer.json` `toolStatus`: add keys for
  `updateFields`, `removeFields`, `relocateField`, `reorder` (keep a `default`). Tamil = real translations.

## D. Back-compat (old persisted conversations)

Old rows in `AIChatMessage.data` contain legacy `tool-updateField`, `tool-bulkUpdateFields`,
`tool-moveField`, `tool-copyField`, `tool-removeField`, `tool-bulkRemoveFields`,
`tool-reorderFields`, `tool-reorderPages` parts with legacy `output.type` (`UPDATE_FIELD`,
`BULK_UPDATE_FIELDS`, `MOVE_FIELD`, `COPY_FIELD`, `REMOVE_FIELD`, `BULK_REMOVE_FIELDS`,
`REORDER_FIELDS`, `REORDER_PAGES`).
- These are NEVER re-applied (applyAIOp only runs on live-streamed new tool calls), so no
  store mutation risk.
- They MUST still render in history without throwing → that's why `MutationToolPart` and
  `buildOpLabel`/`getActionLabel` need default branches, and `AIEditDrawer` routes any
  `tool-*` (except read/proposeValidation) to `MutationToolPart`.
- `applyAIOp` switch must have a `default` that no-ops (defensive).

---

## E. Caching mechanics (backend — owned by main agent, here for reference)

- `instructions` (system prompt) becomes **100% static** — no currentPageId, no form summary.
- Trailing ephemeral context = a final **`user`** message: `<current_context>...current page + compact form snapshot...</current_context>`. NOT persisted to history.
- `providerOptions: { openai: { promptCacheKey: conversationId } }` passed once in the
  `ToolLoopAgent` constructor (reaches every step).
- Read cached tokens: `const u = await result.totalUsage; u.inputTokenDetails.cacheReadTokens`.
- `systemMessageMode`: leave unset (provider picks `developer` for gpt-5.x).
