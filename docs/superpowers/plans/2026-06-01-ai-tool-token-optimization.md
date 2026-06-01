# AI Tool Token Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce per-request token cost by compacting `listFields` output (~74% less per call) and trimming verbose tool descriptions (~176 tokens/message saved).

**Architecture:** Both changes are confined to `apps/backend/src/lib/aiFormEditTools.ts`. Task 1 rewrites the `listFields` execute function to return a compact string-based format instead of a verbose JSON object. Task 2 shortens the description strings on 7 verbose tools. No new files, no API changes.

**Tech Stack:** Node.js, Vitest.

---

## File Map

| File | Change |
|---|---|
| `apps/backend/src/lib/aiFormEditTools.ts` | Compact `listFields` execute + trim 7 tool descriptions |
| `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts` | Update existing listFields tests to match new format + add compact-format assertions |

---

### Task 1: Compact `listFields` response

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts:25–49`
- Test: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts:35–59`

- [ ] **Step 1: Update existing listFields tests to expect the new compact format**

Replace the three tests in `describe('listFields', ...)` in `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts` (lines 35–59) with:

```ts
describe('listFields', () => {
  it('returns summary and compact page strings for all pages', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.summary).toBe('2 pages total');
    expect(result.pages).toHaveLength(2);
    // p1 line includes page number, id, and both fields
    expect(result.pages[0]).toMatch(/^p1 "Page 1" \[id:page-1\]:/);
    expect(result.pages[0]).toContain('f-1|text|"Name"|req');
    expect(result.pages[0]).toContain('f-2|select|"Country"|opt');
    // p2 line
    expect(result.pages[1]).toMatch(/^p2 "Page 2" \[id:page-2\]:/);
    expect(result.pages[1]).toContain('f-3|email|"Email"|req');
  });

  it('filters to a specific page and preserves correct page number', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.listFields.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages).toHaveLength(1);
    // still shows p2 (absolute position) even when filtered
    expect(result.pages[0]).toMatch(/^p2 "Page 2" \[id:page-2\]:/);
    expect(result.pages[0]).toContain('f-3|email|"Email"|req');
  });

  it('returns empty summary for empty schema', async () => {
    const tools = createFormEditTools({ pages: [] });
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.summary).toBe('0 pages total');
    expect(result.pages).toHaveLength(0);
  });

  it('marks page as (empty) when it has no fields', async () => {
    const tools = createFormEditTools({ pages: [{ id: 'p1', title: 'Blank', fields: [] }] });
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages[0]).toContain('(empty)');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -A4 'listFields'
```

Expected: existing tests fail because `result.totalPages` and `result.pages[0].pageNumber` don't exist yet in the new format.

- [ ] **Step 3: Replace `listFields` execute with compact format**

In `apps/backend/src/lib/aiFormEditTools.ts`, replace the `listFields` tool (lines 25–49) with:

```ts
listFields: tool({
  description:
    'List form fields in compact format: p1 "Title" [id:pageId]: fieldId|type|"label"|req/opt. Omit pageId to list all pages.',
  inputSchema: z.object({
    pageId: z.string().optional().describe('Filter to this page; omit to list all pages'),
  }),
  execute: async ({ pageId }) => {
    const pages: any[] = schema.pages ?? [];
    const filtered = pageId ? pages.filter((p: any) => p.id === pageId) : pages;

    const TYPE_MAP: Record<string, string> = {
      text_input_field: 'text',  TEXT_INPUT_FIELD: 'text',
      text_area_field: 'ta',     TEXT_AREA_FIELD: 'ta',
      email_field: 'email',      EMAIL_FIELD: 'email',
      number_field: 'num',       NUMBER_FIELD: 'num',
      date_field: 'date',        DATE_FIELD: 'date',
      select_field: 'select',    SELECT_FIELD: 'select',
      radio_field: 'radio',      RADIO_FIELD: 'radio',
      checkbox_field: 'check',   CHECKBOX_FIELD: 'check',
      file_upload_field: 'file', FILE_UPLOAD_FIELD: 'file',
    };

    return {
      summary: `${pages.length} page${pages.length !== 1 ? 's' : ''} total`,
      pages: filtered.map((p: any) => {
        const pi = pages.indexOf(p) + 1;
        const fields = (p.fields ?? [])
          .map((f: any) => `${f.id}|${TYPE_MAP[f.type] ?? f.type}|"${f.label}"|${(f.required ?? false) ? 'req' : 'opt'}`)
          .join(', ');
        return `p${pi} "${p.title ?? `Page ${pi}`}" [id:${p.id}]: ${fields || '(empty)'}`;
      }),
    };
  },
}),
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -A6 'listFields'
```

Expected: all 4 listFields tests pass.

- [ ] **Step 5: Verify no other tests broke**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit 2>&1 | tail -6
```

Expected: same pass count as before (only the 4 pre-existing `formSharing.test.ts` failures).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "perf(ai): compact listFields response — ~74% fewer tokens per call"
```

---

### Task 2: Trim verbose tool descriptions

**Files:**
- Modify: `apps/backend/src/lib/aiFormEditTools.ts` (7 tool `description` strings)
- Test: `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`

- [ ] **Step 1: Write a test that enforces description length limits**

Add after the existing `describe('listFields', ...)` block in `apps/backend/src/lib/__tests__/aiFormEditTools.test.ts`:

```ts
describe('tool description lengths', () => {
  const tools = createFormEditTools({ pages: [] });

  const LIMITS: Record<string, number> = {
    listFields:        130,
    getField:          120,
    addField:          115,
    updateField:       175,
    removeField:        40,
    reorderFields:      90,
    updateLayout:       70,
    renamePage:         55,
    reorderPages:       60,
    addPage:           145,
    removePage:         90,
    navigateToPage:    135,
    bulkUpdateFields:  100,
    proposeValidation: 140,
  };

  for (const [name, limit] of Object.entries(LIMITS)) {
    it(`${name} description is under ${limit} chars`, () => {
      const desc = (tools as any)[name].description as string;
      expect(desc.length).toBeLessThanOrEqual(limit);
    });
  }
});
```

- [ ] **Step 2: Run tests to confirm which descriptions fail**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -E "(description is under|✗|FAIL|Expected)" | head -20
```

Expected: `getField`, `addField`, `updateField`, `addPage`, `proposeValidation`, `bulkUpdateFields` fail (their descriptions exceed the limits).

- [ ] **Step 3: Replace the 7 verbose descriptions in `aiFormEditTools.ts`**

Make the following targeted replacements. Each is a single `description:` string change — leave everything else (inputSchema, execute) untouched.

**`getField`** — replace description string:
```ts
// Old (163 chars):
'Get full details of a specific field: placeholder, hint, options, validation, and which page it belongs to. Use before updating a field to see its current values.'
// New (110 chars):
'Get field details (placeholder, hint, options, validation, pageId). Call before updating to see current values.'
```

**`addField`** — replace description string:
```ts
// Old (185 chars):
'Add a new field to a page. Use the pageId from listFields (match by pageNumber for user-facing page numbers). Use insertAfterFieldId to control position; pass null to append at the end.'
// New (103 chars):
'Add a field to a page. pageId from listFields. insertAfterFieldId for position; null to append at end.'
```

**`updateField`** — replace description string:
```ts
// Old (338 chars):
'Update one or more properties of an existing field. Only include properties you want to change. For text/textarea fields use updates.validation.minLength/maxLength. For number fields use updates.min/updates.max. For date fields use updates.minDate/updates.maxDate. For checkbox fields use updates.validation.minSelections/maxSelections.'
// New (162 chars):
'Update field properties. Only include changed properties. text/textarea: validation.minLength/maxLength. number: min/max. date: minDate/maxDate. checkbox: validation.minSelections/maxSelections.'
```

**`addPage`** — replace description string:
```ts
// Old (244 chars):
'Add a new empty page to the form. insertAfterPageId: pass a page ID to insert after that page, or null to append at the end. The returned pageId is the ID of the new page — use it immediately as the pageId when calling addField on this new page.'
// New (133 chars):
'Add a page. insertAfterPageId to position it, null to append. Use the returned pageId immediately as the pageId for addField on this page.'
```

**`bulkUpdateFields`** — replace description string:
```ts
// Old (143 chars):
'Apply the same update to multiple fields at once. Use instead of multiple updateField calls when applying the same change to 3 or more fields.'
// New (92 chars):
'Apply the same update to 3+ fields at once. Always prefer this over multiple updateField calls.'
```

**`proposeValidation`** — replace description string:
```ts
// Old (229 chars):
'Propose validation rules for fields based on their label and type. Use instead of updateField when suggesting validation — the user reviews before applying. Never call updateField for validation without explicit user confirmation.'
// New (122 chars):
'Propose validation rules for user review. Use instead of updateField for validation — never apply validation without user confirmation.'
```

**`navigateToPage`** — replace description string:
```ts
// Old (132 chars):
'Navigate the form builder canvas to a specific page. Call this before editing fields on a page the user is not currently viewing.'
// New: already 132 chars — check if it falls under the 135 limit. It does. Leave as-is.
```

- [ ] **Step 4: Run tests to confirm all description lengths pass**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit --reporter=verbose 2>&1 | grep -A2 'description is under'
```

Expected: all 14 description tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm test:unit 2>&1 | tail -6
```

Expected: same pass count as before (only the 4 pre-existing `formSharing.test.ts` failures).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/lib/aiFormEditTools.ts apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
git commit -m "perf(ai): trim verbose tool descriptions — ~176 fewer tokens per message"
```
