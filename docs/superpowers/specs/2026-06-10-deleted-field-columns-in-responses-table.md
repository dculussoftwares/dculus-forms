# Deleted Field Columns in Responses Table

**Date:** 2026-06-10  
**Status:** Approved

## Problem

When a field is deleted from the form builder, any responses already submitted for that field retain the value in `response.data` (keyed by field ID), but the column never appears in the responses table because the table is built from the current live form schema. That historical data is effectively invisible.

## Goal

Show deleted field columns in the responses table so form owners can always see all response data, even for fields that no longer exist on the form.

## Scope

- **In scope:** fields deleted after this feature ships (full metadata preserved via soft-delete)
- **In scope:** fields deleted before this feature ships (shown as "Unknown field (deleted)" with raw value — no label/type recovery)
- **Out of scope:** recovering labels for historically deleted fields; schema versioning; per-response schema snapshots

---

## Design

### Approach: Soft-delete in form schema

Instead of hard-deleting a field from the Y.js document, mark it `deleted: true`. The field stays in the form schema JSON indefinitely. The builder filters it out everywhere; the response table renders it as a read-only "deleted" column.

No database migrations required. No new tables.

---

## Section 1 — Data Layer

**`packages/types/src/index.ts`**  
Add `deleted?: boolean` to the `FormField` base class. Serialization/deserialization already passes through unknown properties.

**`apps/form-app/src/store/slices/fieldsSlice.ts` — `removeField` action**  
Change from hard-delete to soft-delete:
```typescript
// Before
fieldsArray.delete(fieldIndex, 1);

// After
fieldMap.set('deleted', true);
```

Y.js syncs the flag to collaborators and to the DB automatically. No other write-path changes.

**Unknown orphaned IDs** (historical deletions before this feature)  
When rendering the table, scan all `response.data` keys and diff against the full set of known field IDs (active + soft-deleted). Any key not found gets a synthetic "Unknown field (deleted)" descriptor.

---

## Section 2 — Builder UI Filtering

All field iterators add `filter(f => !f.deleted)` to exclude soft-deleted fields. The builder behaves identically to today.

Locations requiring the filter:
- `fieldsSlice.ts` selectors (`getAllFields`, `getFieldsByPage`, derived selectors)
- Builder left panel field list and canvas rendering
- `useFieldAnalytics` hook
- Form submission preview
- `formMetadataService.ts` field count caching
- `templateService.ts` (strip deleted fields when saving as template)

Single predicate everywhere: `fields.filter(f => !f.deleted)`

**Collaborative editing:** When user A soft-deletes a field, Y.js syncs `deleted: true` to user B in real time. The filter removes it from B's view immediately — no special handling needed.

---

## Section 3 — Response Table Rendering

**File:** `apps/form-app/src/utils/createResponsesColumns.tsx` — `createFieldColumns()`

Render three column groups in order:

1. **Active columns** — `field.deleted !== true`, same as today
2. **Deleted columns** — `field.deleted === true`
   - Accessor: `data.${field.id}` (unchanged)
   - Header: field label (muted/grey) + amber "deleted" badge
   - Read-only: no sort, no filter, no edit action
   - Empty value: "—" (same as "No response" today)
   - Value formatting: existing `formatFieldValueUtil()` — no special casing
3. **Unknown orphan columns** — field IDs in `response.data` not found in schema (active or deleted)
   - Header: `"Unknown field (deleted)"` with amber badge
   - Value: raw string cast of the stored value

**Orphan detection** (computed once per table render):
```typescript
const knownFieldIds = new Set(allFields.map(f => f.id)); // active + deleted
const orphanIds = new Set(
  responses.flatMap(r => Object.keys(r.data)).filter(id => !knownFieldIds.has(id))
);
```

---

## Section 4 — Export

**File:** `apps/backend/src/services/unifiedExportService.ts`

- Deleted columns are included by default (consistent with "always visible" table behaviour)
- Column visibility toggle controls inclusion — same as active columns
- Export column header: `"fieldLabel (deleted)"` for soft-deleted fields; `"Unknown field (deleted)"` for orphans
- No changes to ExcelJS formatting — deleted columns render as plain text cells

---

## Files Changed

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add `deleted?: boolean` to `FormField` |
| `apps/form-app/src/store/slices/fieldsSlice.ts` | Soft-delete in `removeField`; filter selectors |
| `apps/form-app/src/utils/createResponsesColumns.tsx` | Three column groups; orphan detection |
| `apps/backend/src/services/unifiedExportService.ts` | Include deleted columns; visibility-gated |
| `apps/backend/src/services/formMetadataService.ts` | Filter deleted fields from count |
| `apps/backend/src/services/templateService.ts` | Strip deleted fields on template save |
| `apps/form-app/src/hooks/useFieldAnalytics.ts` | Filter deleted fields |
| Builder field list / canvas components | Filter deleted fields from rendering |

---

## Non-Goals

- Recovering labels/types for fields deleted before this feature ships
- UI to "restore" a soft-deleted field
- Per-response schema snapshots
- Schema versioning / audit log of field changes
