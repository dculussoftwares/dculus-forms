# Conditional Logic v1 — Field-by-Field Strategy & Validation Deep Dive

> Companion to `conditional-logic-research.md`. That doc covers the JotForm research and
> overall architecture; this one pins down v1 exactly: per-field condition support, every
> validation interaction, and how each is resolved. Based on a line-level read of
> `zodSchemaBuilder.ts`, `SinglePageForm`, `useFormSubmission`, `useFormValidation`,
> `useStoreSync`, `useFormResponseStore`, `PageRenderer`, and `FormViewer.tsx`.

## 1. v1 scope

- **Actions**: `showField` / `hideField` (multi-target), `hidePage`. No skip-to-page,
  no require/unrequire, no calculations.
- **Triggers**: any fillable field, cross-page references allowed.
- **Combinator**: flat `any` / `all` per rule. No nested groups.
- **Hidden-value policy**: keep values in the store while filling; strip hidden fields'
  values at submit ("clear when submitted"). No form-level setting in v1.

## 2. Runtime value model (what the evaluator actually sees)

`useFormResponseStore` holds `pageId → fieldId → value`. Values are written by
`useStoreSync` on every react-hook-form change, so the evaluator can subscribe to the
store and see near-realtime answers for **all** pages. Shapes by field type:

| Field type | Store value shape | "Empty" means |
|---|---|---|
| TextInput, TextArea | `string` | `''` / whitespace-only / `undefined` |
| Email | `string` | same |
| PhoneNumber | `string` (E.164, e.g. `+9198…`) — the input only commits **complete valid** numbers | `''` / `undefined` (a half-typed number is never committed → counts as empty) |
| Number | `number` \| `''` \| `undefined` | `''` / `undefined` / `null` (0 is **filled**) |
| Date | `'YYYY-MM-DD'` string | `''` / `undefined` |
| Select (single), Radio | `string` (option text) | `''` / `undefined` |
| Checkbox | `string[]` (option texts) | `[]` / `undefined` |
| FileUpload | `File[]` while filling (uploaded → R2 keys only at submit, in `FormViewer.handleFormSubmit`) | `[]` / `undefined` |
| RichText | — (non-fillable, no value) | n/a |

## 3. Field-by-field condition support (v1)

### 3.1 As trigger (IF side)

| Field | Operators (v1) | VALUE editor input | Evaluation semantics |
|---|---|---|---|
| TextInput | equals, notEquals, contains, notContains, startsWith, endsWith, isEmpty, isFilled | free text | trim both sides, case-insensitive compare |
| TextArea | same as TextInput | free text | same |
| Email | same as TextInput | free text | same (enables domain rules via endsWith `@acme.com`) |
| PhoneNumber | equals, notEquals, startsWith, isEmpty, isFilled | free text | compare raw E.164; startsWith enables country-code rules (`+91`); no trim-insensitivity games — exact digits |
| Number | equals, notEquals, lessThan, greaterThan, isEmpty, isFilled | numeric input | coerce store value: `''`/`undefined`/`null` → empty; compare as numbers; rule value stored as `number` |
| Date | equals, notEquals, before, after, isEmpty, isFilled | date picker | both sides are `YYYY-MM-DD` → plain string compare is correct and timezone-proof (never construct `Date` objects — repo rule) |
| Select | equals, notEquals, isEmpty, isFilled | **option picker** from `field.options` | exact string match (options are canonical strings) |
| Radio | same as Select | option picker | same |
| Checkbox | contains, notContains, isEmpty, isFilled | option picker | `contains` = value ∈ array; `notContains` = value ∉ array (incl. empty array) |
| FileUpload | isEmpty, isFilled **only** | none | `isFilled` = array length > 0 (works on both `File[]` and uploaded keys) |
| RichText | ❌ not a trigger | — | non-fillable, no value |

Operator enum stays exactly as committed in the research doc §3 (`equals … after`) —
every row above is a subset; the rule editor filters the operator dropdown by the
selected trigger field's type, and swaps the VALUE input (text / number / date picker /
option picker / none for isEmpty+isFilled). This mirrors JotForm's STATE/VALUE morphing.

### 3.2 As target (DO side)

- **show/hide field**: every field type is a valid target, **including RichText**
  (conditional info blocks are a top JotForm use case; display-only elements were
  targetable there too).
- **hidePage**: any page except… no restriction needed in v1 (JotForm disables the
  trigger's own page; we allow it — the evaluator handles it — but the builder UI
  should warn since hiding your own trigger's page is almost always a mistake).

## 4. Validation deep dive — every surface, and the fix for each

Current validation per field (from `zodSchemaBuilder.createFieldSchema`):

| Field | Validation rules that can block navigation/submit |
|---|---|
| TextInput/TextArea | required (`min(1)`), minLength, maxLength |
| Email | required, email format |
| PhoneNumber | required, `isValidPhoneNumber` refine |
| Number | required (must be number), min/max range refine |
| Date | required, valid-date refine, minDate/maxDate refine |
| Select/Radio | required (`min(1)`) |
| Checkbox | required→minSelections, minSelections refine (even when optional), maxSelections refine |
| FileUpload | required (`min(1)`), maxFiles; plus viewer-side size/MIME check (`validateFiles` in `FormViewer.tsx:22`) |
| RichText | none (`z.any().optional()`) |

**The universal fix**: `createPageSchema(page, hiddenFieldIds)` omits hidden fields'
keys entirely. Every rule in the table above becomes unreachable for a hidden field —
no per-type work needed. But there are **four distinct call paths** that must all
receive the hidden set, found by tracing `PageRenderer.goToNextPage`:

1. **RHF resolver** (`SinglePageForm.tsx:67`) — used by `trigger()` via
   `useFormValidation.validatePage` (this is what `goToNextPage` awaits first).
   Fix: dynamic resolver that rebuilds the schema with the *current* hidden set at
   validation time (visibility changes as the user types on the same page):
   `resolver: (v, c, o) => zodResolver(createPageSchema(page, getHidden()))(v, c, o)`.
2. **`validatePageData` inside `useFormSubmission.handleSubmit`**
   (`useFormSubmission.ts:23`) — ⚠️ **independent second validation**. After
   `validate()` passes, `goToNextPage` calls `formRef.submit()` →
   `submitCurrentValues` → `validatePageData(page, data)` which builds its **own**
   schema. If this one isn't visibility-aware it fails silently
   (`success: false`), `store.setPageResponses` is skipped, and the page's
   *visible* answers are lost on navigation. Fix: thread `hiddenFieldIds` through
   `validatePageData(page, data, hiddenFieldIds)`.
   *(Same applies to `goToPrevPage`, which also calls `submit()`.)*
3. **`showAllValidationErrors` / error summary** (`useFormValidation`) — reads RHF
   `formState.errors`; upstream fix (1) means hidden fields can never appear here.
   Also `setFocus` on first error can never target an unmounted hidden field. No code
   change needed, but add a test.
4. **Viewer `validateFiles`** (`FormViewer.tsx:22`) — iterates response *values*, so it
   is safe **iff hidden values are stripped before it runs** (see §5). No change needed.

Per-field validation nuances worth tests:

- **Number**: a hidden required number with `''` in the store — schema omission covers
  it; also the min/max refine can't fire.
- **Checkbox `minSelections` on an optional field**: this refine fires even when not
  required (`zodSchemaBuilder.ts:298`) — omission covers it; without omission this
  would be a subtle blocker ("select at least 2 or leave all unchecked" on an
  invisible field).
- **Date `minDate/maxDate`**: a pre-filled default outside the range on a hidden field
  — omission covers it.
- **PhoneNumber**: value is only ever committed when complete+valid, so a re-shown
  phone field never holds garbage; only required-ness matters, and omission covers it.
- **FileUpload required + hidden**: must not demand an upload — omission covers it;
  and stripping before the upload loop (§5) means hidden files are **never uploaded to
  R2** (no orphaned objects, no wasted bandwidth).

## 5. Submit pipeline ordering (the second enforcement gate)

`PageRenderer.handleFormComplete` currently does
`getFormattedResponses()` → `onFormSubmit/onResponseUpdate`. v1 inserts the strip
**here**, before anything else sees the data:

```text
getAllResponses() → evaluateConditions(rules, responses)   // final pass
                  → strip values of hidden fields AND all fields of hidden pages
                  → getFormattedResponses()                 // flatten
                  → viewer: validateFiles → upload File[] → GraphQL submitResponse
```

Ordering consequences, all intentional:
- hidden File[] never reach `validateFiles` or the R2 upload loop;
- the "send me a copy" recipient-email lookup (`FormViewer.tsx:219`) reads processed
  responses — a hidden email field correctly yields no copy;
- EDIT mode (`onResponseUpdate`) passes through the same choke point, so response
  editing gets identical semantics: values hidden by conditions are stripped on
  update and recorded by `responseEditTrackingService` as `DELETE` field changes —
  correct audit behavior, worth an explicit test.
- Backend stays unchanged in v1 (it does no schema validation today); server-side
  stripping is listed as a fast-follow (open question §5.2 of the research doc).

## 6. Evaluator specification

```typescript
evaluateConditions(
  rules: ConditionalRule[],
  responses: Record<string /*pageId*/, Record<string /*fieldId*/, unknown>>,
  schema: { pages: FormPage[] }        // for field types + page membership
): { hiddenFieldIds: Set<string>; hiddenPageIds: Set<string> }
```

- **Default visibility**: a field targeted by any `showField` action is hidden until a
  rule shows it (JotForm behavior); everything else is visible. Same for pages.
- **Hidden = empty**: rules evaluate against *effective* values, where a currently
  hidden field's value reads as empty.
- **Fixed-point iteration with repeated-state detection**: start from the
  default-visibility state, evaluate all rules, recompute the hidden set, repeat until
  the state stabilizes or a previously seen state repeats (show/hide cycles can
  oscillate: A hides B → B empty → rule deactivates → B shows → …). On a repeat, the
  cycle has closed: return the cycle state with the fewest hidden items (prefer
  visibility on paradoxes; ties broken by a canonical signature). This is
  deterministic, never loops, and — unlike a rule-count-based iteration cap — cannot
  change an oscillating field's outcome when unrelated rules are added. A generous
  numeric cap (100 passes) bounds pathological rule sets only. Builder-side
  circular-reference warnings are v1.5.
- **Page cascade**: a page is hidden iff an active `hidePage` rule targets it, **or**
  it has ≥1 field and *all* of its fields are hidden (auto-skip — otherwise the viewer
  renders an empty page with an OK button). A RichText-only info page counts: it stays
  visible unless its RichText blocks are hidden. All fields on a hidden page evaluate
  as empty and are stripped at submit.
- **Robustness**: a term referencing a deleted/unknown fieldId evaluates to `false`;
  a rule with zero terms is inactive; `enabled: false` rules are skipped. Type
  mismatches (e.g. lessThan on a string) evaluate to `false`, never throw — the
  evaluator must be total.
- Pure function in `packages/types` (or `utils`) with exhaustive unit tests — no React,
  no store imports. `useConditionalVisibility()` in `packages/ui` wraps it with a store
  subscription and shares the result via `FormResponseContext`.

## 7. Viewer navigation changes (`PageRenderer`)

- `visiblePages = pages.filter(p => !hiddenPageIds.has(p.id))` computed once per
  visibility change; `currentPageIndex` indexes into **visiblePages**.
- If the *current* page becomes hidden mid-fill (an answer on it triggered a page
  rule), clamp to the nearest previous visible page — never strand the user.
- Progress bar, `Page X of Y`, `isLastPage`, and the submit-vs-OK button all derive
  from `visiblePages`. `data-page-index` test id keeps working (index within visible).
- `SinglePageForm` renders `page.fields.filter(f => !hiddenFieldIds.has(f.id))`;
  hidden fields unmount (values persist in the store; RHF default
  `shouldUnregister: false` keeps its copy too, harmless since the schema omits them).

## 8. Builder-side v1 (summary — detailed design when we get there)

- `conditions` as a top-level Y.Array beside `pages`/`layout`; new `conditionsSlice`
  in the form-builder store; extend `serializeFormSchema`/`deserializeFormSchema`.
- **Referential integrity**: deleting a field/page does *not* cascade-delete rules
  (collab-unsafe); instead the rule list shows a "broken reference" badge and the
  evaluator already treats the term as `false` / skips the action. User fixes or
  deletes the rule. Renaming a Select/Radio/Checkbox **option** similarly leaves the
  stored value dangling → badge "value no longer among options".
- Rule editor mirrors JotForm: field dropdown → type-filtered operator dropdown →
  morphing VALUE input; Any/All bar; multi-term, multi-action.
- New Conditions page in form-app (route alongside FormSettings), i18n en + ta from
  day one.
- Builder **preview** mode uses the same renderer stack, so conditions work in preview
  for free once the context is wired.

## 9. Decisions locked for v1 (with rationale)

| # | Decision | Rationale |
|---|---|---|
| 1 | Text compares are trimmed + case-insensitive | matches form-owner expectation; JotForm defaults similar |
| 2 | Date compare = ISO string compare | timezone-proof; repo already mandates YYYY-MM-DD strings |
| 3 | `0` is a filled number | anything else makes numeric rules unusable |
| 4 | Hidden = empty during evaluation, fixed-point with cap | deterministic cascades without JotForm's "clear when hidden" destructiveness |
| 5 | Strip at submit only (keep while filling) | JotForm's default; re-showing restores the user's typed input |
| 6 | Schema-key **omission**, not `.optional()` | kills every validation rule class in one move; zero per-type edits |
| 7 | Fix `validatePageData` path too | otherwise silent data loss on navigation (see §4.2) |
| 8 | Auto-skip pages whose fields are all hidden | avoids rendering empty pages; RichText counts as a field |
| 9 | Broken references disable the term, never crash | collab editing means rules and fields race |
| 10 | Client-side enforcement only | consistent with backend's current no-validation posture; server strip is a fast-follow |

## 10. Implementation order

1. `ConditionalRule` types + operator enums in `@dculus/types`; extend
   `FormSchema.conditions`; serialization round-trip tests.
2. `evaluateConditions` pure evaluator + exhaustive unit tests (every operator × every
   field type × empty/edge values; cascade + cycle-cap tests).
3. `createPageSchema` + `validatePageData` gain `hiddenFieldIds`; unit tests per §4
   nuances.
4. `useConditionalVisibility` + context plumbing in `FormRenderer`; dynamic resolver in
   `SinglePageForm`; field filtering.
5. `PageRenderer` visible-pages navigation + submit-time strip in `handleFormComplete`.
6. Y.js sync + `conditionsSlice` in form-app.
7. Builder Conditions UI (list + rule editor) with i18n.
8. E2E: multi-page form with field & page rules — fill, hide, re-show, navigate back,
   submit; assert stripped payload.
