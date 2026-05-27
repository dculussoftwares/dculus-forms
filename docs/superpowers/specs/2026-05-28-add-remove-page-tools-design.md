# Add / Remove Page Tools — Design Spec

**Date:** 2026-05-28  
**Status:** Approved

## Problem

The AI chat drawer can rename and reorder pages but cannot add or delete them. This means the AI cannot fully restructure a multi-page form — users must leave the chat to manage pages manually.

## Goal

Add `addPage` and `removePage` AI tools so the AI can create and delete pages end-to-end, following the same operation-object pattern as all existing mutation tools.

## Approach

All mutation tools return plain operation objects. The frontend `applyAIOp` applies them to Y.js via the Zustand store. Undo works for free through the existing Y.js undo manager batch. No database changes, no new GraphQL, no new UI.

---

## Changes

### 1. Backend — `apps/backend/src/lib/aiFormEditTools.ts`

**New tool: `addPage`**

```
inputSchema:
  title: string (max 50 chars) — title for the new page
  insertAfterPageId: string | null — insert after this page; null = append at end

execute: returns { type: 'ADD_PAGE', title, insertAfterPageId }
```

**New tool: `removePage`**

```
inputSchema:
  pageId: string — from listFields

execute:
  - reads live schema via getFormSchemaFromYjs
  - if pages.length <= 1: returns { error: 'Cannot remove the last page' }
  - otherwise: returns { type: 'REMOVE_PAGE', pageId }
```

**Updated `FormOperation` union:**

```typescript
| { type: 'ADD_PAGE'; title: string; insertAfterPageId: string | null }
| { type: 'REMOVE_PAGE'; pageId: string }
```

---

### 2. Backend — `apps/backend/src/routes/aiChat.ts`

`TOOL_STATUS_MAP` additions:
```
addPage: 'Adding page...'
removePage: 'Removing page...'
```

`MUTATION_OP_TYPES` set additions:
```
'ADD_PAGE', 'REMOVE_PAGE'
```

---

### 3. Backend — `apps/backend/src/services/aiChatService.ts`

Add one line to the system prompt:
```
- You can add and remove pages with addPage and removePage. Never remove the last page.
```

---

### 4. Frontend — store

**`apps/form-app/src/store/slices/pagesSlice.ts`**

New method: `addPageAtPosition(title: string, insertAfterPageId: string | null): string | undefined`

- Guards: Y.js doc must be available and ready
- Generates a new page ID: `page-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
- Creates a Y.Map with `id`, `title`, `order`, and an empty `fields` Y.Array
- If `insertAfterPageId` is null: `pagesArray.push([pageMap])`
- If `insertAfterPageId` is provided: find its index, then `pagesArray.insert(idx + 1, [pageMap])`; fall back to push if not found
- Updates `order` for all pages after insertion
- Does NOT auto-select the new page (unlike `addEmptyPage`) — the AI controls focus

**`apps/form-app/src/store/types/store.types.ts`**

Add to `PagesSlice`:
```typescript
addPageAtPosition: (title: string, insertAfterPageId: string | null) => string | undefined;
```

No changes to `removePage` — it already deletes all fields and guards against removing the last page.

---

### 5. Frontend — `apps/form-app/src/lib/applyAIOp.ts`

New cases in `applyAIOp`:

**`ADD_PAGE`:**
```
call store.addPageAtPosition(op.title, op.insertAfterPageId)
```

**`REMOVE_PAGE`:**
```
if store.pages.length <= 1: return (silent guard)
call store.removePage(op.pageId)
```

Update `Pick<>` type signature to include `addPageAtPosition` and `removePage`.

---

### 6. Frontend — `apps/form-app/src/hooks/useAIChat.ts`

`buildOpLabel` additions:
```
'ADD_PAGE'    → `Added page "${op.title ?? 'page'}"`
'REMOVE_PAGE' → 'Removed page'
```

---

## What does NOT change

- No database schema changes
- No new GraphQL types or resolvers
- No new UI components
- No changes to the undo manager — batching already works
- `addEmptyPage` in the store is untouched (used by the manual UI)

---

## Edge cases

| Scenario | Behaviour |
|---|---|
| Remove last page | `removePage` tool returns `{ error }` so AI explains to user |
| `insertAfterPageId` not found | Falls back to append at end |
| Y.js not ready when `addPageAtPosition` called | Returns `undefined`, op silently skipped |
| AI tries to remove a page it just added | Works normally — Y.js state is live |
