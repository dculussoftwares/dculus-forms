# Conditional Logic (Field & Page Conditions) — Research & Analysis

> Research date: 2026-07-16. Sources: hands-on exploration of JotForm's condition builder
> (form 261958773432064, Settings → Conditions) + dculus-forms codebase analysis.

## 1. What JotForm offers (observed first-hand)

JotForm's Conditions live under **Settings → Conditions** as a flat, form-level list of
rules — *not* attached to individual fields. Eight condition types:

| Condition type | What it does | Relevance for us |
|---|---|---|
| **Show/Hide Field** | Change visibility of one or more fields | **Core — v1** |
| **Skip to / Hide a Page** | Jump to a page or remove it from the flow | **Core — v1** |
| Enable/Require/Mask Field | Make a field required/disabled, set input mask | Good v2 (require/unrequire) |
| Update/Calculate Field | Copy values / arithmetic into a field | v3 — needs calc engine |
| Update Options (NEW) | Filter dropdown/choice options dynamically | v3 |
| Change Thank You Page | Conditional thank-you content/redirect | v2 — pairs with our ThankYouDisplay |
| Change Email Recipient | Route notification emails | v2 — pairs with our email plugin |
| Run Workflow (NEW) | Trigger a workflow | N/A (maps to our plugin events) |

### Rule anatomy (same shape for every condition type)

```text
IF    [field]  [STATE operator]  [VALUE]     ← 1..N terms ("+" adds terms)
IF    [field]  [STATE operator]  [VALUE]
      IF (Any | All) OF THE "IF" RULES ARE MATCHED   ← flat combinator, no nested groups
DO    [action] [target field/page]           ← 1..N actions ("+" adds actions)
```

- **Trigger fields**: any fillable field. Display-only elements (heading, image,
  paragraph, captcha) are disabled as triggers but **selectable as show/hide targets**.
- **Actions** for Show/Hide: `Show`, `Hide`, `Show Multiple`, `Hide Multiple`.
- **Actions** for pages: `Skip to Page`, `Hide Page` (the trigger's own page is disabled
  in the target picker — no self-reference).
- Saved rules render as human-readable summary cards ("IF Multiple Choice IS EQUAL TO
  'Choice A' … SHOW Long Text Answer") with search + filter by type/field, and per-rule
  enable/disable/duplicate/delete.
- An AI box ("Describe your conditions") generates rules from natural language.

### Operators by field type (observed in STATE dropdown)

| Field type | Operators |
|---|---|
| Text / TextArea | Is Equal To, Is Not Equal To, Contains, Does not Contain, Starts With, Doesn't Start With, Ends With, Doesn't End With, Is Empty, Is Filled |
| Number / Spinner | Is Equal To, Is Not Equal To, Is Empty, Is Filled, Less Than, Greater Than |
| Date | Is Empty, Is Filled, Before, After, Is Equal to Date, Not Equal to Date, Is Equal to Day, Not Equal to Day |
| Single/Multiple choice, Dropdown | Is Equal To, Is Not Equal To, Is Empty, Is Filled — **VALUE becomes an option picker** populated from the field's options |

### Hidden-field data semantics (critical design decision)

Form Settings → "Clear Hidden Field Values" — three modes:
- **Clear when hidden** — value wiped the moment the field hides
- **Clear when submitted** (JotForm's default) — user keeps the value if the field
  re-shows during filling, but hidden values are dropped at submit
- **Don't clear** — hidden values submit anyway

## 2. Where conditions plug into our codebase

Evaluation needs live in exactly one shared place so builder-preview and public viewer
behave identically: **`packages/`**, not the apps.

| Concern | Location today | Change needed |
|---|---|---|
| Schema | `FormSchema` / `FormPage` interfaces, `packages/types/src/index.ts:111-122` | Add `conditions?: ConditionalRule[]` — form-level list (JotForm-style), serialized like everything else via `serializeFormSchema` / `deserializeFormSchema` |
| Rule evaluation | — (new) | New `packages/types` (or `utils`) module: `evaluateConditions(rules, responses) → { hiddenFieldIds, hiddenPageIds, requiredOverrides }`. Pure function; unit-testable |
| Answer state | `packages/ui/src/stores/useFormResponseStore.ts` — per-page maps, `getAllResponses()` already exposes cross-page values | Feed all responses into the evaluator; recompute on every response change (Zustand subscribe or derived selector) |
| Field visibility | `FormFieldRenderer` / `SinglePageForm` (react-hook-form + `zodResolver(validationSchema)` per page) | Skip rendering hidden fields **and exclude them from the page's zod schema** — a hidden required field must not block navigation (`getFieldValidationSchema` composition happens per page) |
| Page flow | `PageRenderer.tsx:48,113-159` — sequential `currentPageIndex`, `goToNextPage` just does `index + 1`; progress bar & `isLastPage` assume `pages.length` | Replace with "next *visible* page" lookup; `isLastPage` = last visible; progress = visible pages. This is the biggest viewer refactor |
| Builder editing + collab | Y.js: `serializeFieldToYMap` (`apps/form-app/src/store/helpers/fieldHelpers.ts:347`), `CollaborationManager.deserializePagesFromYJS`; slices in `apps/form-app/src/store/slices/` | Conditions as a new top-level Y.Array in the form doc (like pages/layout) → new `conditionsSlice` + Y.js (de)serialization. Field/page deletion must clean up or flag referencing rules |
| Builder UI | Settings-style pages exist (`FormSettings`); field settings in `field-settings-v2/` | New "Conditions" tab/page in form-app mirroring JotForm's list + rule editor. All strings i18n'd (en + ta) |
| Backend | `submitResponse` (`apps/backend/src/services/responseService.ts:397`) stores data as-is — **no schema validation server-side today** | v1 can stay client-side (consistent with current posture). If we adopt "clear when submitted", the viewer strips hidden values before submit; optional server-side strip later |
| Analytics/exports | Field analytics processors, `unifiedExportService` | No structural change — hidden fields simply have no value. Worth noting "conditionally skipped" ≠ "left blank" in analytics interpretation |
| AI form builder | `packages/types/src/ai.ts` + AI chat builder | Follow-up: teach generation about conditions (JotForm has this — "Describe your conditions" AI) |

### Interactions to watch

- **`isShuffleEnabled`** (`FormSchema`) — shuffled field order + show/hide is fine, but
  page-skip logic assumes stable page order; decide precedence (suggest: conditions win,
  shuffle only shuffles within visible sets).
- **Chained/cascading rules** — hiding field A can change the truth of a rule that
  depends on A. JotForm re-evaluates transitively (with "clear when hidden" making it
  deterministic). Our evaluator does both: hidden fields' values read as empty during
  evaluation, and it iterates to a fixed point (final model — see strategy doc §6).
- **Response edit mode** (`ResponseEdit` + `responseEditTrackingService`) — the edit UI
  uses the same renderer (`RendererMode.EDIT`), so conditions apply automatically; edit
  history will record cleared-by-condition fields as DELETEs.
- **Circular rules** (A hides B, B hides A) — builder should warn; evaluator must not
  loop (fixed-point iteration with repeated-state detection; items oscillating within
  a cycle resolve to visible — see strategy doc §6).

## 3. Proposed data model (v1)

```typescript
// packages/types — serialized as plain JSON inside FormSchema, synced via Y.js
export type ConditionOperator =
  | 'equals' | 'notEquals' | 'contains' | 'notContains'
  | 'startsWith' | 'endsWith' | 'isEmpty' | 'isFilled'
  | 'lessThan' | 'greaterThan'          // number
  | 'before' | 'after';                 // date

export interface ConditionTerm {
  fieldId: string;
  operator: ConditionOperator;
  value?: string | number | string[];   // omitted for isEmpty/isFilled
}

export type ConditionAction =
  | { type: 'showField' | 'hideField'; fieldIds: string[] }
  | { type: 'showPage' | 'hidePage'; pageId: string }
  | { type: 'skipToPage'; pageId: string };            // v1.5 if needed

export interface ConditionalRule {
  id: string;
  enabled: boolean;
  combinator: 'any' | 'all';
  terms: ConditionTerm[];
  actions: ConditionAction[];
}

export interface FormSchema {
  pages: FormPage[];
  layout: FormLayout;
  isShuffleEnabled: boolean;
  conditions?: ConditionalRule[];       // NEW — absent = no conditions (back-compat)
}
```

Semantics recommendation (simplest deterministic set):
- Default visibility: **visible**; a `showField` action implies the target starts hidden
  (JotForm works this way — "Show X" hides X until the rule matches).
- Hidden fields evaluate as **empty** in other rules; evaluation iterates to a fixed
  point so cascades resolve deterministically (see strategy doc §6 for cycle handling).
- Hidden-value policy: **clear at submit** (JotForm's default) — keep typed values while
  filling, strip hidden fields' values from the payload on submit. No setting in v1.
- Hidden fields are excluded from the page zod schema (never block navigation).

## 3.1 Conditions-before-validation design (agreed 2026-07-16)

Principle: **zod validation must never see a hidden field.** Conditions evaluate first;
schema building, rendering, navigation, and the submit payload all consume the result.

```text
responses → evaluateConditions → { hiddenFieldIds, hiddenPageIds }
                                   ├─ render      (SinglePageForm skips hidden FormFieldRenderer)
                                   ├─ zod schema  (createPageSchema omits hidden field keys)
                                   ├─ navigation  (PageRenderer filters visible pages)
                                   └─ submit      (strip hidden values at handleFormComplete)
```

1. **`useConditionalVisibility()` hook** (packages/ui) — subscribes to
   `useFormResponseStore` (cross-page answers via `getAllResponses()`), runs the pure
   evaluator on every response change, exposes the visibility sets through
   `FormResponseContext` so all renderers share one result.
2. **`createPageSchema(page, hiddenFieldIds?)`**
   (`packages/ui/src/utils/zodSchemaBuilder.ts:362`) — skip hidden fields when building
   `schemaFields`: the key is *omitted entirely* (not relaxed to `.optional()`), so a
   hidden required/invalid field can never produce an error or block `goToNextPage`.
   No changes needed inside the per-field-type schemas.
3. **Dynamic resolver in `SinglePageForm`** — visibility changes while typing on the
   same page, and the schema is currently memoized on `[page]` and passed to
   `zodResolver` once. Replace with a resolver that rebuilds at validation time:
   `resolver: (v, c, o) => zodResolver(createPageSchema(page, getHiddenFieldIds()))(v, c, o)`
   — avoids react-hook-form resolver-staleness entirely.
4. **Hidden fields unmount but keep their store values** (re-show restores typed input);
   values are stripped only at submit ("clear when submitted" policy), which is the
   second enforcement gate in `handleFormComplete`.
5. **Evaluator semantics**: hidden fields' values count as empty during rule evaluation
   and rules re-evaluate to a fixed point — hiding A auto-deactivates rules depending
   on A; oscillating cycles are detected and resolved deterministically (strategy §6).

## 4. Suggested phasing

| Phase | Scope |
|---|---|
| **v1** | Show/Hide **field** + Hide **page**; operators per table above; Any/All combinator; builder UI (rule list + editor); viewer evaluation; Y.js sync; clear-hidden-at-submit; e2e tests |
| v1.5 | Skip-to-page (forward-only jump), circular-reference warnings in builder |
| v2 | Require/unrequire action; conditional thank-you; conditional email-plugin recipient |
| v3 | Calculated fields; dynamic option filtering; AI "describe your conditions" |

## 5. Open questions

1. Form-level rule list (JotForm model, recommended — supports multi-target actions)
   vs per-field "visibility" settings (Google Forms model, simpler but weaker)?
2. Should the **backend** also strip hidden-field values at submit (defense in depth),
   given it currently does no schema validation at all?
3. Is `skipToPage` needed in v1, or does `hidePage` cover the real use cases? (Skip
   creates back-navigation ambiguity; JotForm ships both.)
4. Do we surface "field was hidden by condition" in response views/exports, or render
   as blank?

## Screenshots captured during research

- `jotform-conditions-landing.png` — 8 condition types
- `jotform-showhide-rule-builder.png` — IF/STATE/VALUE → DO/FIELD editor
- `jotform-multi-if-terms.png` — multi-term + Any/All combinator bar
- `jotform-saved-conditions-list.png` — saved rule summary cards + filters
