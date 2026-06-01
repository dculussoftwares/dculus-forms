# AI Builder Chat — Capability Test Suite

> What the AI form editor can and cannot do. Each scenario maps directly to a tool call or
> system-prompt behaviour. Use this as a manual test checklist or to scope new AI features.

**Backend entry point:** `POST /api/ai/chat` → `ToolLoopAgent` (max 15 steps)  
**Tools available:** 13 (`listFields`, `getField`, `addField`, `updateFields`, `removeFields`,
`reorder`, `updateLayout`, `renamePage`, `addPage`, `removePage`, `navigateToPage`,
`proposeValidation`, `relocateField`)  
**Conditional read tools:** `listFields`/`getField` are included only for large forms
(> 40 fields). Small forms receive a full compact form snapshot inline (in the per-turn
`<current_context>` block), so the model edits without read round-trips.  
**Consolidated tools:** `updateFields`/`removeFields` take an array of field IDs (one ID = single
edit, many = batch); `relocateField` takes `mode: 'move' | 'copy'`; `reorder` takes
`scope: 'fields' | 'pages'`.  
**Prompt caching:** the system prompt + tool definitions + history form a byte-stable prefix
cached by Azure/OpenAI (`promptCacheKey` = conversation id); per-turn dynamic context lives in
a trailing ephemeral message that is never persisted.  
**Token budget:** free 200k · starter 2M · advanced 20M (monthly, per org)

---

## 1. Form Generation (AIFormBar — one-shot, no conversation)

| # | Prompt | Expected behaviour | Mode |
|---|--------|-------------------|------|
| G1 | `"Contact form"` | ≤5 fields (name, email, message). Simple types only. | quick |
| G2 | `"Employee onboarding form"` | 6–10 fields, mixed types (text, date, select, file). | standard |
| G3 | `"Medical intake form"` | 10–20 fields. Rich variety including checkboxes, date, number, file. | professional |
| G4 | Any prompt | Generates `<h1>` title + `<p>` description as HTML intro. Sets CTA button label (max 4 words). | all |
| G5 | `"xyz"` (< 3 chars) | Rejected — 400 Bad Request. | — |
| G6 | Prompt > 1000 chars | Rejected — 400 Bad Request. | — |

---

## 2. Field Operations (Chat)

### 2a. Add Field

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| F1 | `"Add an email field"` | Adds `email` type field. Appended to current page. |
| F2 | `"Add a phone number field after Full Name"` | Adds `text` field inserted directly after the named field. |
| F3 | `"Add a required dropdown for Country with options UK, US, India"` | Adds `select` field, required, with 3 options. |
| F4 | `"Add a file upload to page 2"` | Navigates canvas to page 2, adds `file` field. |
| F5 | `"Add a checkbox for Terms agreement"` | Adds `checkbox` field. |
| F6 | `"Add a date field for Date of Birth with min age 18"` | Adds `date` field. Does NOT auto-apply validation — must be asked separately via proposeValidation. |
| F7 | `"Add a field to page 5"` (form has 3 pages) | Asks for clarification — does not create pages 4 and 5. |
| F8 | `"Add a field to page 4"` (form has 3 pages) | Automatically creates page 4 then adds the field. |

**Supported field types:** `text` · `textarea` · `email` · `number` · `date` · `select` · `radio` · `checkbox` · `file`

### 2b. Update Field

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| U1 | `"Make the Full Name field required"` | Sets `required: true` via `updateFields` (1-element array). Field details come from the inline snapshot (or `getField` on large forms). |
| U2 | `"Change the label of Email to Email Address"` | Updates label only. |
| U3 | `"Add a hint to the Organization field: 'Your company name'"` | Sets `hint` on that field. |
| U4 | `"Add a placeholder to Full Name"` | Sets `placeholder`. |
| U5 | `"Add options Red, Green, Blue to the Colour field"` | Sets `options` array. Works for `select`, `radio`, `checkbox`. |
| U6 | `"Set max length of 100 on the Bio field"` | Sets `validation.maxLength: 100` on a `text`/`textarea` field. |
| U7 | `"Set min 0 and max 120 on the Age field"` | Sets `min: 0, max: 120` on a `number` field. |
| U8 | `"Set min date of today on the Appointment field"` | Sets `minDate` on a `date` field. |
| U9 | `"Set minimum 2 selections on the Interests checkbox"` | Sets `validation.minSelections: 2` on a `checkbox` field. |

### 2c. Remove Field

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| R1 | `"Remove the Phone Number field"` | Deletes the field via `removeFields` (1-element array). Change is immediate; cannot be reversed except via Undo. |
| R2 | `"Delete all optional fields"` | Identifies optional fields from the snapshot (or `listFields` on large forms), removes them in one `removeFields` call. |

### 2d. Reorder Fields (within the same page)

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| O1 | `"Move Email before Full Name"` | `reorder` (scope `fields`) so Email appears first. |
| O2 | `"Put the file upload at the top of page 2"` | Navigates to page 2, `reorder` (scope `fields`) so file is first. |

### 2e. Move / Copy Field Between Pages

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| M1 | `"Move the Phone field from page 1 to page 2"` | `relocateField` mode `move`. Field removed from page 1, appended to page 2. |
| M2 | `"Move Email to page 2 after Full Name"` | `relocateField` mode `move`, inserts immediately after Full Name on page 2. |
| M3 | `"Copy the Address field to page 3"` | `relocateField` mode `copy` (appended). New field gets a new ID; all properties preserved. |
| M4 | `"Copy Email to page 2 before Phone"` | `relocateField` mode `copy`, inserts before Phone on page 2. |

---

## 3. Bulk Field Operations

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| B1 | `"Make all fields required"` | One `updateFields` call with every field ID across all pages. Field IDs come from the snapshot (or `listFields` on large forms). |
| B2 | `"Make every field on page 1 optional"` | One `updateFields` call with page 1's field IDs, `required: false`. |
| B3 | `"Add a hint 'Required' to all required fields"` | Filters required fields from the snapshot, sets hint via one `updateFields` call. |
| B4 | `"Rename all labels to sentence case"` | Per-field labels differ, so individual `updateFields` calls (one ID each) — batched where the same change applies. |

---

## 4. Page Operations

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| P1 | `"Add a new page called Summary"` | Creates page appended at the end. |
| P2 | `"Add a page after page 1 called Contact Info"` | Creates page inserted after page 1. |
| P3 | `"Rename page 2 to Membership Details"` | Updates page title. |
| P4 | `"Delete page 3"` | Removes page and all its fields. Refuses if only 1 page remains. |
| P5 | `"Move page 3 before page 1"` | `reorder` (scope `pages`). |
| P6 | `"Delete the last page"` (only 1 page) | Refuses — returns error message. |

---

## 5. Layout Operations

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| L1 | `"Change the form title to 'Membership Application'"` | Updates `<h1>` in the intro HTML. |
| L2 | `"Add a description: 'Fill this out to apply for membership'"` | Updates `<p>` in the intro HTML. |
| L3 | `"Change the submit button to 'Apply Now'"` | Sets `customCTAButtonName`. Max 4 words enforced. |
| L4 | `"Update the intro and CTA button"` | Can do both in a single `updateLayout` call. |

---

## 6. Validation Suggestions (User-Confirmed)

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| V1 | `"Suggest validation rules for all fields"` | Calls `proposeValidation` with all fields. Shows accept/dismiss card per field in the drawer. **Does not auto-apply.** |
| V2 | `"What validation should I add to the Age field?"` | Calls `proposeValidation` for that field. User clicks Accept to apply. |
| V3 | `"Set max length 200 on Bio"` (direct update request) | Uses `updateFields` directly — does not go through `proposeValidation` since user explicitly requested the value. |

> **Key distinction:** `proposeValidation` is used when the AI is *suggesting* rules. If the user states an explicit value, `updateFields` is used directly.

---

## 7. Form Analysis

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| A1 | `"Analyse this form"` (Analyse form chip) | Reads all pages with `listFields`. Returns feedback on field order, missing fields, unclear labels, required/optional decisions. |
| A2 | `"List all fields"` | Returns compact field list across all pages. |
| A3 | `"What fields are on page 2?"` | Returns fields for page 2 only. |
| A4 | `"Show me the details of the Email field"` | Calls `getField` and returns full details (placeholder, hint, options, validation). |

---

## 8. Navigation

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| N1 | `"Edit the bio field on page 3"` (user is on page 1) | Calls `navigateToPage` to switch canvas to page 3, then edits the field. |
| N2 | `"Go to page 2"` | Switches canvas view to page 2. No field edits. |

---

## 9. Remix / Transform

| # | Prompt | Expected behaviour |
|---|--------|-------------------|
| X1 | `"Remix this form into a job application"` (via chip) | Reads the snapshot, removes irrelevant fields (`removeFields`), adds job-specific fields (`addField`), relabels via `updateFields`, updates layout title/CTA. Preserves fields that fit both purposes. |
| X2 | `"Convert this contact form into an event registration form"` | Same remix flow. Adds first, then removes — never removes the last field on a page first. |

> Remix orchestrates existing tools — no dedicated remix tool. All changes are visible in the change summary card and can be undone.

---

## 10. Conversation Features

| # | Feature | Behaviour |
|---|---------|-----------|
| C1 | **Conversation history** | Last 20 messages sent to model. Older turns dropped. Tool call artifacts pruned from history. |
| C2 | **Auto-title** | First user message triggers automatic title generation (fire-and-forget). |
| C3 | **Multiple conversations** | User can create, rename, delete conversations per form. Each conversation is independent. |
| C4 | **Undo** | Global undo button in drawer header. Per-message undo badge on last mutating turn (Y.js LIFO). |
| C5 | **Token meter** | Drawer footer shows monthly usage. Green 0–79%, amber 80–99%, red 100%. Polls every 30s. |
| C6 | **Stream cancel** | Stop button appears while AI is responding. Clicking cancels the stream. |

---

## 11. Context-Aware Quick Chips

Chips are dynamic — they change based on current form state.

| Condition | Chips shown |
|-----------|------------|
| Form has 0 fields | ✦ Generate fields |
| Form has fields | ✦ Analyse form |
| Any optional fields exist | Make all required |
| Form has > 1 page | Reorganise pages |
| Fields lack validation + count > 2 | ✦ Suggest validation |
| Field count > 2 | ✦ Remix this form (pre-fills input, user completes) |

Maximum 3 chips shown at a time.

---

## 12. Scope Limits — What the AI Cannot Do

| # | Out of scope | Reason |
|---|-------------|--------|
| S1 | Create or delete forms | No form-level CRUD tools. Builder only edits the current form. |
| S2 | Publish or unpublish a form | Publishing is a separate UI action. |
| S3 | Edit response data | Responses are read-only. |
| S4 | Upload or change form background/logo | File uploads are not exposed via chat tools. |
| S5 | Change field type after creation | No `changeFieldType` tool. Must remove and re-add. |
| S6 | Rich text field content editing | `rich_text_field` is non-fillable; no edit tool exposed. |
| S7 | Apply validation without user confirmation | `proposeValidation` always shows accept/dismiss — never auto-applies. |
| S8 | Reference fields by index (e.g. "the 3rd field") | AI uses field labels and IDs, not positional indices. |
| S9 | Skip multiple pages to create (e.g. jump from p2 to p5) | AI creates only the next sequential page automatically. Gap pages require explicit confirmation. |
| S10 | Access forms from other organizations | All queries are scoped to the current org + user. |

---

## 13. Token Cost Reference (per message)

The system prompt, the 13 tool definitions, and pruned history form a **byte-stable cacheable
prefix** (keyed by `promptCacheKey` = conversation id). After the first step/turn, that prefix is
served from the Azure/OpenAI prefix cache at a discount — only the per-turn ephemeral context and
the new completion are billed at full rate.

| Component | Tokens | Cached after step 1? |
|-----------|--------|----------------------|
| System prompt (static) | ~330 | ✅ |
| Tool definitions (13 tools) | ~700 | ✅ |
| History (20 msgs, pruned) | ~1,000–2,500 | ✅ (grow-only prefix) |
| Ephemeral context: page + compact snapshot (small form) | ~150–600 | ❌ (per-turn) |
| User message | ~20–50 | ❌ |
| **Uncached input after warm-up** | **~200–700** | — |

Because the inline snapshot removes most `listFields`/`getField` round-trips, a typical edit
completes in 1–2 steps instead of 4–10. Per-turn telemetry logs `cachedInputTokens`,
`cacheHitRatio`, `inputTokens`, `outputTokens`, and `steps`.

Plans: `free` 200k · `starter` 2M · `advanced` 20M tokens/month.

---

## 14. Step Budget

The AI runs up to **15 tool call steps per response**. With the inline form snapshot, most edits
finish in 1–2 steps. Large forms (> 40 fields) omit the snapshot and use `listFields`/`getField`,
which adds read steps.

Batch tools keep step count low: `updateFields`/`removeFields` apply to many fields in a single
call, and `reorder`/`relocateField` each do their work in one step.
