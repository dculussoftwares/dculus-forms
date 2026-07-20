# Conditional Logic v3 — Dynamic Option Filtering (Design)

> Companion to `conditional-logic-research.md` (§1 "Update Options", §3 data model) and
> `conditional-logic-v1-strategy.md` (§3.1 per-field operator semantics, §9 locked
> decisions). This doc is design-only — see §9 for the coding-agent-ready follow-up
> tickets. Canonical case used throughout: **Country → State** cascading select.

## 1. Recommendation summary

- **Action-based, not field-declarative.** Add one new `ConditionAction` variant,
  `filterOptions`, to the existing flat rule-list model. Do **not** introduce a
  parallel "option→condition mapping baked into the field" mechanism.
- **Full replacement, last-rule-wins**, mirroring `requireField`/`unrequireField`'s
  `requiredOverrides: Map<fieldId, boolean>` exactly — a new
  `optionOverrides: Map<fieldId, string[]>` on `ConditionEvaluationResult`.
- **Filtered-out selected value**: keep-while-filling, strip-at-submit — the same
  policy already locked for hidden fields (strategy §9.5), applied per-value instead
  of per-field.
- **Validation**: schema becomes visible-options-aware only for fields with an active
  override (backward compatible for every field with no `filterOptions` rule).
- **The 30+ pairs authoring problem is a builder-UX concern, not a runtime-model
  concern.** Solve it with a dedicated bulk-mapping generator that emits ordinary
  rules under the hood (§8), not by inventing a second evaluation mechanism.

## 2. Why action-based, not field-declarative

The issue asks us to weigh `{ type: 'filterOptions', fieldId, options }` against a
declarative option→condition mapping stored on the field itself. The field-declarative
route was rejected:

- It forks the architecture. Every consumer of conditional logic — `evaluateConditions`,
  the Y.js `conditions` array, `conditionsSlice`, the builder's Conditions tab,
  `detectConditionCycles`, `checkRuleReferences`, the AI `upsertConditionRule` tool, the
  server-side `conditionalStrip.ts` — reads one flat `FormSchema.conditions` list. A
  second mechanism means a second evaluator, a second Y.js sync path, and a second
  builder surface, violating research doc §2's "evaluation needs live in exactly one
  shared place" principle.
- It doesn't actually simplify the hard case. Country→State still needs a per-country
  mapping table somewhere; putting it on the field instead of in a rule doesn't remove
  the N-mappings problem, it just moves it out of the audited, testable, Y.js-synced
  rule list into ad-hoc field metadata with no cycle detection, no broken-reference
  badge, and no AI-authoring support.
- The action-based shape is a **one-line extension** of a pattern already shipped
  twice (`requireField`/`unrequireField` in v2). Sizing risk is low because the
  precedent — discriminated-union action, `isWellFormedAction`, evaluator merge into a
  `Map`, `createPageSchema` override threading, client + server strip — is proven code,
  not a new design.

## 3. Data model

`packages/types/src/conditions.ts`:

```typescript
export type ConditionAction =
  | { type: 'showField' | 'hideField'; fieldIds: string[] }
  | { type: 'showPage' | 'hidePage'; pageId: string }
  | { type: 'skipToPage'; pageId: string }
  | { type: 'requireField' | 'unrequireField'; fieldIds: string[] }
  | { type: 'filterOptions'; fieldId: string; options: string[] };   // NEW — v3
```

- Single `fieldId` target (not `fieldIds`) — a filter list only makes sense against
  one target's own option set at a time; batching two unrelated Select fields under
  one options array has no sane semantics.
- `options: string[]` is a **full replacement list**, not an additive/subtractive
  patch. When no active rule targets a field, its default is the field's own
  `options: string[]` (unrestricted) — same "everything visible by default" posture
  used for fields/pages (strategy §9.4), not the `showField`-style "hidden until
  shown" posture. There is no natural "hidden by default" reading for an option list.
- Not validated against the target field's own `options` at the schema-parse layer —
  same posture as `hideField`'s `fieldIds` (which aren't checked against real fields
  either). Dangling entries are inert, never crash (locked decision §9.9); the builder
  surfaces them as broken references (§8).
- Applies to **Select, Radio, and Checkbox** targets uniformly. Select/Radio compare
  a scalar string; Checkbox compares each element of the stored array (§5).

`conditionActionSchema` gains a matching branch:

```typescript
z.object({
  type: z.literal('filterOptions'),
  fieldId: z.string().min(1),
  options: z.array(z.string()),   // [] is valid — "no options currently visible"
}),
```

`isWellFormedAction` gains a `filterOptions` case (`typeof candidate.fieldId ===
'string' && Array.isArray(candidate.options)`).

`ConditionEvaluationResult` gains:

```typescript
optionOverrides: Map<string, string[]>;   // fieldId -> currently-visible options
```

Computed exactly like `requiredOverrides` (§ "Compute requiredOverrides" block in
`evaluateConditions`): after the fixed-point visibility pass, walk `activeRules` in
order, re-test each rule's match against the *final* hidden state, and for every
matched rule's `filterOptions` action, `optionOverrides.set(action.fieldId,
action.options)` — later matching rules win. **Hidden-beats-filtered**: like
`requiredOverrides`, strip any override for a field in `current.fields` (hidden fields
don't need an option list — they're excluded from rendering and schema entirely
regardless).

`detectConditionCycles`'s `ruleAffects` construction gains `filterOptions` alongside
the existing field-target actions (`action.fieldId` added to the affects set) — one
line, so the already-shipped circular-reference warnings (#139) cover the new action
type for free. Example cycle this now catches: State filters Country's options based
on... a field that filters State (self-referential Country↔State pairs would be a
misconfiguration worth flagging, same as any other cycle).

**Compositionality is free**: `filterOptions` coexists with other actions on the same
rule's `actions` array — e.g. `IF Country equals "USA" DO [showField(State),
filterOptions(State, usStates)]` needs no new plumbing, multi-action rules already
work this way.

## 4. Filtered-out selected value — resolution

This is the question the issue flags as needing to resolve consistently with the
keep-while-filling/strip-at-submit policy. Walking the Country→State scenario:

1. User picks Country = USA, State = California. Store holds `State: "California"`.
2. User changes Country = Canada. The active `filterOptions` rule for State now
   evaluates to Canada's provinces; `"California"` is no longer in that list.

**Decision: keep-while-filling, strip-at-submit — identical policy to hidden fields
(strategy §9.5), applied per-value.**

- **Store**: `"California"` is **not** cleared. Same non-destructive rationale as
  locked decision #4/#5 — if the user flips Country back to USA, California should
  reappear selected without having to re-type/re-pick it. An eager-clear policy
  (JotForm's "Clear when hidden" mode) is explicitly not adopted here, for the same
  reason it wasn't adopted for hidden fields.
- **Render**: unlike a hidden field (which fully unmounts, so this question doesn't
  arise), a filtered field **stays mounted and visible** — so its displayed selection
  must be reconciled against the *live* option list every render, not just at write
  time. `FormFieldRenderer.tsx` renders Select/Radio/Checkbox options straight from
  `fillableField.options` today (lines 277, 288, 321) with no visibility awareness.
  Fix: when an `optionOverrides` entry exists for the field, render **from the
  override list**, and derive the *displayed* value as
  `visibleOptions.includes(storedValue) ? storedValue : ''` (Checkbox:
  `selected.filter(v => visibleOptions.includes(v))` for the checked-state
  computation only, not for the underlying store write). The user sees State as
  unselected the moment Canada is chosen — never a phantom "California" checked
  against a Canadian-provinces list — without the store value being touched. This is
  the same "value persists, presentation reflects current visibility" pattern already
  used for hidden fields, just at the value level instead of the field level.
- **Validation**: once the schema is visible-options-aware (§5), `"California"` simply
  fails membership against Canada's list. If State is required, this correctly blocks
  navigation until the user re-picks — no special-casing needed, it's the standard
  required+invalid-value path every other field already has.
- **Submit**: strip stale values at the same choke point that already strips hidden
  values (strategy §5, `handleFormComplete`). Extend the strip step: for every field
  with an `optionOverrides` entry, drop the stored value if it isn't in the current
  list (Select/Radio), or truncate the stored array to only currently-listed entries
  (Checkbox — a partial strip, since some checked options may still be valid). This
  guarantees a submitted response can never contain an option string that wasn't
  actually offered at submit time, exactly mirroring "no hidden field's value is ever
  submitted."
- **Server-side**: `conditionalStrip.ts` already re-runs `evaluateConditions` +
  `stripHiddenResponses` as defense-in-depth against a crafted GraphQL mutation
  bypassing the client (research §5.2, PR #131). Extend it the same way — mirror the
  client-side option strip using `optionOverrides` from the same evaluator call. This
  keeps backend enforcement scoped to *stripping*, not full schema validation,
  consistent with locked decision #10 (backend does no schema validation).

## 5. Validation — visible-options-aware schema

Current state (`zodSchemaBuilder.ts:274-345`): Select/Radio validate only
`z.string().min(1)` — **membership in `field.options` is never checked today**, even
without conditions (the picker UI is trusted to only ever offer real options).
Checkbox validates array length via `minSelections`/`maxSelections`, also with no
membership check.

`filterOptions` is the first thing that needs a real membership check — without it, a
value that visually shows as "nothing selected" (per §4's render fix) would still pass
`z.string().min(1)` and get submitted, contradicting what the user sees on screen.

Thread `optionOverrides` through the same seam `requiredOverrides` already uses:

```typescript
export const createFieldSchema = (
  field: FormField,
  opts?: { isRequired?: boolean; visibleOptions?: readonly string[] }
): z.ZodTypeAny => { ... }

export const createPageSchema = (
  page: FormPage,
  hiddenFieldIds?: ReadonlySet<string>,
  requiredOverrides?: ReadonlyMap<string, boolean>,
  optionOverrides?: ReadonlyMap<string, readonly string[]>,   // NEW
): z.ZodObject<any> => { ... }
```

- **Select/Radio**, when `visibleOptions` is present: replace `z.string().min(1)`
  with a membership check against `visibleOptions` (`z.enum` needs a non-empty tuple,
  so use `.refine(v => visibleOptions.includes(v), ...)` to also cover the `[]` case
  cleanly) plus the existing required/optional wrapping.
- **Checkbox**, when `visibleOptions` is present: add a `.refine` that every selected
  entry is in `visibleOptions`, composed with the existing `minSelections`/
  `maxSelections` refines (which should evaluate against the *filtered* count — a
  required-min-2 Checkbox with only 1 currently-visible option is a legitimate
  broken-config state the builder should warn about, not something the runtime needs
  to paper over).
- **No `optionOverrides` entry for a field** (the common case — most Select/Radio/
  Checkbox fields have no `filterOptions` rule targeting them): behavior is byte-for-
  byte unchanged from today. Fully backward compatible, zero risk to existing forms.

Both existing enforcement gates that already need `hiddenFieldIds` (strategy §4) need
`optionOverrides` too, since they're the same two independent validation call paths:
1. The dynamic RHF resolver in `SinglePageForm` — extend
   `getHiddenFieldIds()`/`getRequiredOverrides()`'s sibling pattern with
   `getOptionOverrides()`, rebuilt at validation time (visibility and option lists can
   both change while the user is typing on the same page).
2. `validatePageData` inside `useFormSubmission.handleSubmit` — thread
   `optionOverrides` through the same way `hiddenFieldIds`/`requiredOverrides` already
   are, or the second independent validation silently diverges from the first.

Context plumbing: `useConditionalVisibility` returns `optionOverrides` alongside
`hiddenFieldIds`/`requiredOverrides`; `FormResponseContext` exposes it;
`SinglePageForm` passes `visibleOptions={optionOverrides?.get(field.id)}` into
`FormFieldRenderer` the same way it already passes
`requiredOverride={requiredOverrides?.get(field.id)}` (`SinglePageForm.tsx:189`) — one
more prop on an existing, proven wiring path, not a new one.

## 6. Builder editor UX — single-rule authoring

`ConditionRuleEditor.tsx` gains `filterOptions` in the action-type `Select` (next to
the `requireField`/`unrequireField` entries at lines 379–380). Selecting it renders:

1. **Target field picker** — reuse `getTargetFieldOptions`, filtered to
   `SELECT_FIELD | RADIO_FIELD | CHECKBOX_FIELD` only (unlike `showField`/`hideField`,
   RichText and other types aren't valid targets — there's no option list to filter).
2. **Options checklist** — sourced from the *target field's own currently-defined*
   `options: string[]` (same list `OptionsSettings.tsx` edits), rendered as a
   checkbox list of "visible when this rule matches," not a free-text input. This
   keeps authored `filterOptions.options` values in sync with real option strings by
   construction for anything built through the UI (hand-edited/AI-proposed rules can
   still reference stale strings — that's exactly what the broken-reference check in
   §8 is for).

This single-rule editor is sufficient for a small filter set (e.g. a Yes/No field
gating 2–3 visible choices on another field). It is **not** the intended authoring
path for Country→State — seeing that as one row in a 195-country dropdown, repeated
195 times, is the UX failure this design must avoid (see §8).

## 7. Runtime example (Country → State)

```typescript
// One rule per Country value. 195 rules for a full country list — an authoring
// UX problem (§8), not a runtime problem: the evaluator handles 195 rules exactly
// as cheaply as 2.
{
  id: 'cond-us', enabled: true, combinator: 'all',
  terms: [{ fieldId: 'country', operator: 'equals', value: 'United States' }],
  actions: [{ type: 'filterOptions', fieldId: 'state',
              options: ['Alabama', 'Alaska', /* … */] }],
}
```

`optionOverrides.get('state')` is `undefined` until Country is answered (State shows
its full/default option list — recommend the field's authored default list doubles as
the "no country picked yet" fallback, so State isn't empty-and-confusing before
Country is touched). Once a rule matches, State's rendered list becomes exactly that
rule's `options`; changing Country re-evaluates and swaps the list; an unmatched
Country value (an option added to Country but with no corresponding State rule)
leaves State's *previous* override in place — same last-write-wins behavior as every
other override in this system.

## 8. Cascading-select authoring (the 30+ pairs case)

The single-rule editor (§6) does not scale to Country→State. Recommend a dedicated
**bulk-mapping generator**, scoped as its own follow-up (§9, Ticket D) so it doesn't
block shipping the core action type:

- New entry point in `ConditionsTab.tsx`, alongside "Add Rule": **"Add cascading
  options"**.
- Flow: pick **source field** (any Select/Radio — the field whose *value* drives the
  mapping) and **target field** (any Select/Radio/Checkbox — the field whose
  *options* get filtered). The generator then renders a grid: one row per the source
  field's existing options, one cell per row holding a multi-select (or paste-a-list
  textarea, for bulk entry) of which target options are visible for that row.
- On save, generate **one ordinary `ConditionalRule` per source-option row** — a
  single term (`sourceField equals rowValue`) and a single `filterOptions` action.
  This is a pure generation step; nothing new is added to the evaluator, Y.js sync,
  cycle detection, or broken-reference checking — all of §3–§8 already handles
  whatever rules come out of it, whether hand-authored or generated.
- **Rule-list presentation** is the one piece that does need new UI: 195 flat rule
  cards would flood `ConditionsTab.tsx`'s list. Tag generated rules with a shared,
  purely-cosmetic `cascadeGroupId` (a new **optional** field on `ConditionalRule`,
  ignored by the evaluator entirely — it changes no runtime behavior, only how the
  rule list groups cards) so the list can collapse them into one summary card
  ("Country → State cascade — 195 mappings") that expands to the full grid for
  editing. Rules without a `cascadeGroupId` render exactly as today.
- This keeps the "30+ pairs" problem entirely inside builder presentation/generation
  code — the parts of the system that already validate rules at runtime
  (`evaluateConditions`, `sanitizeConditions`, `conditionalStrip.ts`) never need to
  know a cascade generator exists.

## 9. Broken-reference / rename behavior

Options have **no stable id** — confirmed in code: `SelectField.options: string[]`
(`packages/types/src/index.ts:450`), edited in place by array index in
`OptionsSettings.tsx` (`updateOption(index, value)` mutates the string at that
position directly). Renaming an option is, structurally, deleting the old string and
inserting a new one at the same slot — there is nothing for a reference to "follow."

This is already a known class of problem: `checkRuleReferences`
(`conditionFieldConfig.ts:146`) detects `staleOptionValues` today, but only by
scanning `rule.terms` (the IF side). `filterOptions.options` (the DO side) is a new
place the same staleness can occur and is currently unchecked.

**Recommendation: extend `checkRuleReferences`, don't invent a second mechanism.**
Add a loop over `rule.actions` alongside the existing term loop: for each
`filterOptions` action, look up the *target* field's current `options` and flag any
entry of `action.options` not present in it, pushing into the same
`staleOptionValues`-shaped list (or a sibling array with the same shape, surfaced by
the same `condition-broken-<ruleId>` badge). No new UI concept — a renamed option
already turns on the broken-reference badge for term references; this makes it turn
on for action references too.

For the cascade generator specifically (§8): a rename to the **source** field's
option orphans that row's *term* (already detected, no change needed). A rename to
the **target** field's option orphans it inside potentially many generated rules'
*actions* (now detected by the extension above, once per affected rule). The
cascade UI can optionally roll these up ("12 of 195 mappings reference a renamed
option") as a presentation nicety on top of the per-rule badges — not required for
correctness, since the per-rule badge already surfaces every affected row
individually.

## 10. Out of scope for v3

- **AI "describe your conditions" support for `filterOptions`** — the
  `upsertConditionRule` tool (`aiFormEditTools.ts:409-419`) has a fixed action union
  that would need one more branch. Small, but deliberately excluded from the core
  ticket (§9 Ticket A) to keep it reviewable; listed as an optional fast-follow.
- **Server-side full schema validation** — explicitly not proposed (§4, §5); backend
  enforcement stays limited to the strip step, consistent with locked decision #10.
- **Calculated/derived option lists** (e.g. options populated from an external API or
  another field's free-text answer) — out of scope; `filterOptions.options` is always
  an author-time literal string list, same posture as every other action target list
  in this system.

## 11. Follow-up tickets (file under Epic #130 after this doc merges)

| # | Title | Size | Depends on | Scope |
|---|---|---|---|---|
| A | `filterOptions` action: types, evaluator, schema validation, client+server strip | M | — | §3, §4 (strip), §5, cycle-detection line, unit tests. Closest precedent: v2's `requireField`/`unrequireField` — same shape of change, same file set. |
| B | Builder: single-rule `filterOptions` editor UI | S | A | §6 — action-type entry, target-field picker, options checklist, i18n en+ta. |
| C | Builder: broken-reference detection for `filterOptions.options` | S | A, B | §9 — extend `checkRuleReferences`, reuse existing badge. |
| D | Builder: cascading-options bulk-mapping generator | L | A, B, C | §8 — grid UI, rule generation, `cascadeGroupId` grouping in the rule list, i18n. The direct answer to the Country→State authoring problem. |
| E (optional) | AI condition authoring: `filterOptions` support in `upsertConditionRule` | XS | A | §10 — one more action branch in the tool's zod schema + resolver. |

E2E coverage rides along with A/B (single-rule filtering: pick Country, assert State's
rendered options change, assert stale State value clears from submitted payload) and D
(cascade generator round-trip), following the existing pattern in
`test/e2e/features/conditional-logic*.feature`.
