# Native Quiz — Coding-Agent Prompts

One copy-paste prompt per ticket of Epic [#289](https://github.com/dculussoftwares/dculus-forms/issues/289) (Native Quiz). Design rationale and competitive analysis: [`docs/native-quiz-strategy.md`](./native-quiz-strategy.md).

**Execution order**: #290 → #291 ∥ #292 ∥ #293 ∥ #294 ∥ #296 → #295 ∥ #297 → #298 ∥ #299 ∥ #300 ∥ #301 → #302 → #303 → #304
(∥ = can run in parallel.)

`#290` is the only global blocker — nothing else can start until it merges. After it lands, **five agents can run concurrently** (#291, #292, #293, #294, #296) with no file contention; the touchpoints were split so no two tickets own the same file.

**Two ordering rules are load-bearing, not stylistic:**

- **#293 must merge before #297.** #293 stops the answer key leaking to the public form viewer. No answer key may be authorable until it lands.
- **#304 begins with a spike, not code.** It writes into live Y.js collaborative documents. The agent must post its findings on the issue and get review before touching real data.

Every prompt already tells the agent to read the issue + epic, honour the additive guarantee, run the gates, and open a PR. After each PR merges, tick the matching row in epic #289.

---

## Applies to every prompt

Each prompt below is self-contained, but these repo-wide rules are assumed throughout and are worth knowing before you dispatch any of them:

- **The additive guarantee.** With `form.settings.quiz` absent or `enabled: false`, behaviour must be byte-for-byte identical to before the change. Every UI- or request-path ticket has a specific test for this.
- **Quiz is a FREE feature** (decision D8). No entitlement, no usage counter, no `planLimits.ts` or `chargebeeService.ts` changes in any ticket.
- **i18n is mandatory** for `form-app`: `en` **and** `ta`, registered in **both** maps in `apps/form-app/src/locales/index.ts`. Hardcoded strings fail review.
- **Prisma changes need both** a checked-in migration (with `IF NOT EXISTS` guards) and `pnpm db:generate && pnpm db:push`.
- **Worktrees**: run `./scripts/setup-worktree.sh` first, or nothing will build.
- **This repo is public.** Never stage `.env` files, keys, or credentials.

---

## 1 · Issue #290 — Quiz types foundation

```text
Implement GitHub issue #290 of this repo (run: gh issue view 290 — follow it as the spec).
Context first: read the epic (gh issue view 289) — its "Data model" section is authoritative and
must be implemented verbatim.

This is the global blocker for Epic #289; five other tickets start the moment it merges.

Scope is packages/types ONLY. Create packages/types/src/quiz.ts with the quiz interfaces plus Zod
sanitizers modeled exactly on sanitizeConditions in packages/types/src/conditions.ts (drop invalid
data, never throw, return undefined when nothing survives). Add an OPTIONAL `grading?: FieldGrading`
declared property to FillableFormField in packages/types/src/index.ts — do NOT add it to any
constructor signature, because every `new XField(...)` call site in the monorepo must keep compiling
untouched. Carry grading through deserializeFormField for all fillable field types by assigning it
after construction; RICH_TEXT_FIELD must never receive it. Add `quiz?: QuizSettings` to FormSettings.
Export DEFAULT_QUIZ_SETTINGS, FIELD_TYPE_DEFAULT_GRADING_MODE and isGradableFieldType so later
tickets share one source of truth. Re-export './quiz.js' from index.ts.

Add tests under packages/types/src/__tests__/ covering serialize/deserialize round-trips with grading
for every gradable field type, sanitizer rejection of malformed grading, and that a field without
grading has `grading === undefined` (not {} or null).

THE HARD REQUIREMENT: `pnpm type-check` must pass across the ENTIRE monorepo with zero changes to any
other package. If another package needs editing, your types are not optional enough — fix the types,
not the other package. Do not touch packages/types/src/validation.ts (validation and grading are
separate concerns).

When done: branch feat/quiz-types-foundation, commit (no secrets staged), push, open a PR titled
"Native Quiz: types foundation" with body "Closes #290".
```

## 2 · Issue #291 — Pure grading engine

```text
Implement GitHub issue #291 of this repo (run: gh issue view 291 — follow it as the spec).
Context first: read the epic (gh issue view 289) for the data model. Requires #290 merged.

Create apps/backend/src/services/quiz/gradingEngine.ts exporting
`gradeResponse(schema, settings, data): GradeResult`. It must be PURE — no Prisma, no logger, no
service imports, only @dculus/types — so it stays trivially testable and reusable by the submit path,
a future regrade job, and preview.

Implement the five grading modes exactly as the issue specifies: exact, set (all / partial / any),
text, numeric, manual. `partial` set scoring is
pointValue * max(0, |picked ∩ key| − penalty·|picked \ key|) / |key|, floored at zero so a respondent
who picks every wrong option never scores negative. Text normalization order is: trim, collapse
whitespace, lowercase unless caseSensitive, strip punctuation if ignorePunctuation.

Treat author-supplied regex as hostile — it is a ReDoS vector. Anchor it as ^(?:...)$, reject patterns
over 200 characters, try/catch the compile so an invalid pattern scores zero rather than throwing, and
never interpolate the submitted value into the pattern.

Critical semantics: a question missing from `data` (because conditional logic hid it) must be EXCLUDED
from maxScore, NOT scored as wrong — with conditional logic two respondents legitimately face
different denominators. pointValue:0 questions report correctness but add nothing to the denominator.
maxScore of 0 must not divide by zero. A `manual` question forces overall status NEEDS_REVIEW.

Write thorough unit tests in apps/backend/src/services/quiz/__tests__/gradingEngine.test.ts covering
every mode and every edge case above, including a catastrophic-backtracking regex like (a+)+$ against
a long input.

Verify: `grep -nE "prisma|logger" apps/backend/src/services/quiz/gradingEngine.ts` is empty;
`pnpm --filter backend exec tsc --noEmit` and `pnpm test:unit` pass.

When done: branch feat/quiz-grading-engine, commit, push, open a PR titled
"Native Quiz: pure grading engine" with body "Closes #291".
```

## 3 · Issue #292 — ResponseGrade persistence

```text
Implement GitHub issue #292 of this repo (run: gh issue view 292 — follow it as the spec).
Context first: read the epic (gh issue view 289), decision D4. Requires #290 merged.

Add the ResponseGrade model to apps/backend/prisma/schema.prisma exactly as the issue specifies
(1:1 with Response, cascade delete, indexes on formId / [formId,percentage] / [formId,status]), plus
the inverse `grade ResponseGrade?` on Response. Per CLAUDE.md a schema edit alone is NOT enough: write
a checked-in migration under apps/backend/prisma/migrations/ using CREATE TABLE IF NOT EXISTS and
CREATE INDEX IF NOT EXISTS guards, then run `pnpm db:generate && pnpm db:push`.

Create apps/backend/src/repositories/responseGradeRepository.ts following formRepository.ts's shape
precisely (createXRepository factory + resolvePrisma + generic passthroughs named after the Prisma
delegate methods + `remove` exported under the `delete` key + the singleton footer), register it in
repositories/index.ts, and add domain helpers upsertForResponse, findByResponseId, findManyByFormId,
countByFormAndStatus, aggregateByForm.

Create apps/backend/src/services/quiz/gradingService.ts with saveGrade, getGradeForResponse,
getGradesForForm and toRespondentView.

toRespondentView IS THE SECURITY BOUNDARY: for gradeRelease afterReview, never, or scheduled-before-
releaseAt it must return exactly { released: false } with every other field ABSENT from the object —
not zeroed, not null, not merely unrendered by the client. Each respondentVisibility flag
independently omits its own field.

Test toRespondentView across the whole policy matrix by asserting on JSON.stringify(view) rather than
object shape, and add a mocked-Prisma repository test. Do NOT call any of this from submitResponse —
#295 owns that. No existing response row may be written or backfilled by this ticket.

Verify: `pnpm --filter backend exec tsc --noEmit` and `pnpm test:unit` pass.

When done: branch feat/quiz-response-grade, commit (no .env staged), push, open a PR titled
"Native Quiz: ResponseGrade model + persistence" with body "Closes #292".
```

## 4 · Issue #293 — SECURITY: strip the answer key from `formSchemaPublic`

```text
Implement GitHub issue #293 of this repo (run: gh issue view 293 — follow it as the spec).
Context first: read the epic (gh issue view 289), decision D5. Requires #290 merged.
This is security-critical and deliberately scoped small. It MUST merge before #297.

Background: #290 added an optional `grading` property — containing the correct answers — to form
fields in the schema. apps/backend/src/graphql/resolvers/forms.ts has a `Form.formSchemaPublic`
resolver (~line 126) which is what the PUBLIC form-viewer renders (see
apps/form-viewer/src/pages/FormViewer.tsx:126). Without a strip, every respondent can read the answer
key straight out of the GraphQL response before submitting. The old quiz plugin was only incidentally
safe because its key lived in FormPlugin.config, which is never served publicly.

That resolver already maps over pages and filters out `deleted` fields. Extend the same map to remove
the `grading` key from every field. Strip UNCONDITIONALLY — not "when quiz mode is off", always.
Strip on a COPY: never mutate the object returned by getFormSchemaFromHocuspocus, which may be shared
or cached. Leave the authenticated `Form.formSchema` resolver alone; the builder needs grading.

While you are there, document in the resolver's comment block why the other public surfaces are safe:
the Hocuspocus Y.doc is builder-only (form-viewer never connects; CollaborationManager sends a bearer
token), and Form.settings is a typed GraphQL object so the viewer only receives subfields it selects.

THE LOAD-BEARING TEST: build a form whose schema has grading on several fields across several pages,
call the resolver, and assert JSON.stringify(result) contains no "grading", "acceptedAnswers" or
"pointValue". Assert on the serialized STRING, not on object shape, so a nested leak cannot slip
through. Also assert: the authenticated formSchema resolver still returns grading; the input object
was not mutated (call the resolver twice and re-check); the existing deleted-field filter test still
passes; and a form with no grading produces a byte-identical payload to before.

Verify: `pnpm --filter backend exec tsc --noEmit` and `pnpm test:unit` pass.

When done: branch fix/quiz-answer-key-public-leak, commit, push, open a PR titled
"Native Quiz: strip grading from formSchemaPublic" with body "Closes #293".
```

## 5 · Issue #294 — Y.js collaboration plumbing

```text
Implement GitHub issue #294 of this repo (run: gh issue view 294 — follow it as the spec).
Context first: read the epic (gh issue view 289). Requires #290 merged.

This is the riskiest plumbing in the epic — the whole quiz builder sits on it, and a silent drop here
means users lose answer keys when they duplicate a question.

Study how apps/form-app/src/store/helpers/fieldHelpers.ts:291 (createYJSFieldMap) already hand-rolls
nested structures: `options` and `allowedMimeTypes` as Y.Array, `validation` as Y.Map. `grading` is a
nested object containing arrays, so it needs the same explicit treatment.

Update three files:
- store/collaboration/CollaborationManager.ts — add grading to the FieldData type, and read it back in
  extractFieldData (acceptedAnswers and optionFeedback come back from Y.Arrays; text/numeric/set are
  sub-structures). Return undefined, never {}, when the field has no grading.
- store/helpers/fieldHelpers.ts — createYJSFieldMap builds the grading Y.Map (skip entirely when
  absent); serializeFieldToYMap carries grading from the field instance into FieldData; createFormField
  assigns grading onto the constructed instance AFTER construction (#290 deliberately kept grading out
  of the constructors).

Then verify and add a test for each of the five operations that round-trip through these functions:
duplicate field, copy field to another page, reorder, duplicate page, and change field type. Type
change is special — DROP grading when the new type is incompatible (a stale key on an incompatible
field is worse than no key), but KEEP it between compatible types like radio_field -> select_field.
Use isGradableFieldType / FIELD_TYPE_DEFAULT_GRADING_MODE from @dculus/types; do not re-derive the rule.

Add round-trip tests for every grading mode with its mode-specific options object, and assert that a
field without grading produces a Y.Map with NO grading key at all. Every existing test under
apps/form-app/src/store/ must pass unmodified.

Nothing renders in this ticket — it is pure state plumbing. Verify `pnpm type-check` passes.

When done: branch feat/quiz-yjs-grading, commit, push, open a PR titled
"Native Quiz: Y.js plumbing for field grading" with body "Closes #294".
```

## 6 · Issue #295 — Grade inside `submitResponse`

```text
Implement GitHub issue #295 of this repo (run: gh issue view 295 — follow it as the spec).
Context first: read the epic (gh issue view 289), decisions D3 and D7.
Requires #290, #291 and #292 merged.

This delivers what the plugin architecture structurally could not: the score exists before the
mutation returns. (emitFormSubmitted at responses.ts:359 is fire-and-forget, so a plugin can never
put a score in the payload.)

In apps/backend/src/graphql/resolvers/responses.ts, submitResponse: after
stripConditionallyHiddenValues (~line 210) and after the response row is created, but BEFORE the
resolver returns, grade the response when form.settings?.quiz?.enabled is true. Resolve the live
schema the way the resolver already does for thank-you mentions:
getFormSchemaFromHocuspocus(formId) ?? form.formSchema, then deserializeFormSchema.

The post-strip ordering is a CORRECTNESS requirement, not style — a question hidden by conditional
logic must be excluded from maxScore rather than scored as wrong, because two respondents can
legitimately face different denominators.

Wrap grading in try/catch. On failure: log, attempt to persist a NEEDS_REVIEW grade, and LET THE
SUBMISSION SUCCEED. Losing a response to a grading bug is far worse than an ungraded response.

Add an optional `grade: ResponseGradeView` to the submitResponse payload in
apps/backend/src/graphql/schema.ts, built ONLY via gradingService.toRespondentView(grade, settings).
Never hand-roll the projection here — that function is where release and visibility policy is enforced.

Add quizScore/quizMaxScore/quizPercentage/quizPassed to the emitFormSubmitted payload so automations
can branch on the grade, preserving the existing spread order (user data first, control fields after)
so a form field literally named "quizScore" cannot spoof it.

THE CRITICAL TEST: for a form with settings.quiz absent, the mutation must perform ZERO extra DB
queries, write NO ResponseGrade row, and return a byte-identical payload to before this change.
Also test: immediate release returns a populated grade; afterReview/never return { released: false }
with nothing else in the JSON; a conditionally-hidden graded question is excluded from maxScore; and a
thrown grading error still leaves the Response row saved and the mutation successful.

Verify: `pnpm --filter backend exec tsc --noEmit`, `pnpm test:unit`, and existing submitResponse tests
pass unmodified.

When done: branch feat/quiz-submit-grading, commit, push, open a PR titled
"Native Quiz: synchronous grading in submitResponse" with body "Closes #295".
```

## 7 · Issue #296 — Form Settings → Quiz panel

```text
Implement GitHub issue #296 of this repo (run: gh issue view 296 — follow it as the spec).
Context first: read the epic (gh issue view 289), decision D6. Requires #290 merged.

This is the opt-in path that turns an EXISTING form into a quiz. It must change nothing for forms
that don't use it.

Backend: add QuizSettingsInput and QuizSettings to apps/backend/src/graphql/schema.ts and wire `quiz`
into FormSettingsInput (~line 375) and the FormSettings output type, mirroring the existing
AccessControlSettingsInput pattern. Sanitize with sanitizeQuizSettings from @dculus/types in the
updateForm path.

Frontend: add a `quiz` entry (GraduationCap icon, for visual continuity with the outgoing plugin) to
apps/form-app/src/components/form-settings/SettingsSidebar.tsx; create QuizSettings.tsx in the same
directory following AccessControlSettings.tsx's card/toggle/save idiom; register a `case 'quiz'` in
FormSettingsContainer.tsx. Controls: enable toggle (gates everything below), pass threshold %, grade
release (immediate / afterReview / scheduled+datetime / never), six INDEPENDENT respondent-visibility
switches (total score, per-question correctness, correct answers, point values, feedback, pass/fail
badge), and pass/fail result messages. Seed defaults from DEFAULT_QUIZ_SETTINGS.

Extend apps/form-app/src/hooks/useFormSettings.ts with updateQuizSettings/saveQuizSettings mirroring
the existing updateAccessControl/saveAccessControlSettings pair, and thread them through
FormSettings.tsx and FormSettingsContainer.tsx.

Turning quiz mode OFF must NEVER delete answer keys — confirm to the user that keys are preserved and
simply ignored, and never write to formSchema from this panel.

Quiz is a FREE feature (decision D8): no plan check, no entitlement, no planLimits.ts changes.

i18n is mandatory (CLAUDE.md): a `quizSettings` namespace in BOTH locales/en/ and locales/ta/,
registered in BOTH enTranslations and taTranslations in locales/index.ts. Hardcoded strings fail review.

Acceptance: enabling persists settings.quiz and leaves formSchema untouched; disabling leaves grading
intact; scheduled release cannot be saved without releaseAt; all six switches persist independently;
for a form without settings.quiz the settings page is unchanged apart from the new sidebar entry, and
every existing form-settings test passes unmodified. Verify `pnpm type-check`.

When done: branch feat/quiz-settings-panel, commit, push, open a PR titled
"Native Quiz: Form Settings quiz panel" with body "Closes #296".
```

## 8 · Issue #297 — Per-question answer key in the builder

```text
Implement GitHub issue #297 of this repo (run: gh issue view 297 — follow it as the spec).
Context first: read the epic (gh issue view 289). Requires #290, #294 and #296 merged.
DO NOT MERGE BEFORE #293 (the formSchemaPublic answer-key strip) — no key may be authorable while it
still leaks to respondents.

The old plugin's core UX failure was that answer keys lived on a separate page, two navigations from
the question. Fix that: the key is authored ON the question, like Google Forms.

Create apps/form-app/src/components/form-builder/field-settings-v2/GradingSettings.tsx as ONE shared
component that adapts to field type via FIELD_TYPE_DEFAULT_GRADING_MODE / isGradableFieldType from
@dculus/types (do not re-derive the mapping):
- Selection fields (radio/select/checkbox): mark correct option(s) INLINE next to each option — a
  radio column for single-answer, checkboxes for multi — with the point input alongside. One
  interaction, no modal.
- Text: an accepted-answers repeater plus normalization switches (case-sensitive, ignore punctuation).
- Number: target + tolerance (absolute or %) or a min/max range.
- Date: exact or range.
- Feedback (whenCorrect / whenIncorrect / general): collapsed by default so simple quizzes stay simple.
- For set-mode fields, expose the all / partial / any choice as a simple select.

Compose it into SelectionFieldSettings, TextFieldSettings, NumberFieldSettings and DateFieldSettings
(all in field-settings-v2/), rendered BELOW the existing Validation section and ONLY when
settings.quiz?.enabled is true. Update apps/form-app/src/hooks/useFieldEditor.ts so extractFieldData
reads grading and handleSave includes it — the same pattern the specialized validation objects follow.
Add a points badge and a "no answer key" warning marker to PageBuilderFieldCard.tsx, plus a quiz
summary strip (total points, question count, unkeyed count) in the builder chrome.

Authoring-time validation: pointValue >= 0; a keyed selection question needs at least one correct
option; regex accepted answers must be <= 200 chars and must compile — reject inline rather than
saving a pattern the engine will silently score as zero. Renaming an option that is the correct answer
must surface a warning (this is exactly the failure mode that motivated moving grading onto the field,
so prove it is visible).

i18n mandatory: `quizGrading` namespace in BOTH en and ta, registered in BOTH maps in locales/index.ts.

THE CRITICAL ACCEPTANCE TEST: with settings.quiz absent or disabled, NO grading UI renders anywhere —
no section, no badge, no summary strip — and the field settings panels are pixel-identical to before.
Verify against a pre-existing non-quiz form. All existing field-settings-v2 tests must pass unmodified.
Verify `pnpm type-check`.

When done: branch feat/quiz-answer-key-ui, commit, push, open a PR titled
"Native Quiz: per-question answer key in field settings" with body "Closes #297".
```

## 9 · Issue #298 — "Create a quiz" in the wizard

```text
Implement GitHub issue #298 of this repo (run: gh issue view 298 — follow it as the spec).
Context first: read the epic (gh issue view 289), decision D6. Requires #290 and #296 merged.

This is the discovery path for the quiz feature. THE ABSOLUTE REQUIREMENT from the product owner:
existing form-creation flows and the existing builder must be COMPLETELY unaffected.

apps/form-app/src/pages/CreateFormWizard.tsx has a `choice` step (~line 524) with two cards — Start
with AI, and Use a template. Add a third "Create a quiz" card (GraduationCap icon) matching the
existing card idiom exactly: same padding, radius, hover lift, focus ring. The grid becomes 3-up on md
and stays 1-up on mobile. It should read as a peer of the other two, not a promotion.

Extend the Step union (line 53) with 'quiz' and add a deliberately THIN quiz step: title/description;
"blank quiz or generate questions with AI"; pass threshold and grade release seeded from
DEFAULT_QUIZ_SETTINGS. For the AI option, REUSE the existing GENERATE_FORM_WITH_AI mutation with a
quiz-framed prompt — do not fork the AI pipeline or add a new AI mutation. Then continue into the
EXISTING `appearance` step; do not build a parallel appearance flow.

Backend: add an optional `settings: FormSettingsInput` to CreateFormInput in
apps/backend/src/graphql/schema.ts (~line 337) and persist it (sanitized) in the createForm resolver.
It must stay OPTIONAL so every existing caller — CreateFormPopover.tsx, the template flow, the tests —
compiles and behaves identically.

The user should land in the builder with quiz mode already on, so #297's answer-key affordances are
visible immediately and they never have to hunt for a settings toggle.

Quiz is a FREE feature (decision D8): add NO plan check, NO entitlement and NO usage counter. Do not
touch planLimits.ts or chargebeeService.ts.

i18n mandatory: extend the wizard's namespace with the new strings in BOTH en and ta.

Acceptance: three cards; the AI and Template paths are byte-identical to before (same steps, same
mutations, same payloads); the quiz path yields settings.quiz.enabled === true; the AI and Template
paths yield settings.quiz ABSENT (not {enabled:false}); no existing form is ever modified; all existing
wizard tests pass unmodified. Verify `pnpm type-check`.

When done: branch feat/quiz-create-wizard, commit, push, open a PR titled
"Native Quiz: Create a quiz entry point in the wizard" with body "Closes #298".
```

## 10 · Issue #299 — Respondent result screen

```text
Implement GitHub issue #299 of this repo (run: gh issue view 299 — follow it as the spec).
Context first: read the epic (gh issue view 289). Requires #290 and #295 merged.

This delivers the thing the old quiz plugin structurally could not: the score appears the instant the
respondent submits.

Create packages/ui/src/renderers/QuizResultScreen.tsx — score headline, pass/fail badge, optional
result message, and a per-question review list (question, respondent's answer, correct/incorrect
marker, points, correct answer, feedback). The component renders exactly what it is given and NEVER
decides policy: the server already applied release and visibility rules in
gradingService.toRespondentView, so simply omit anything absent from the payload.

Add an optional `gradeResult?: RespondentGradeView` prop to FormRenderer and render QuizResultScreen
in the EXISTING thank-you screen slot in LayoutRenderer. Reusing that slot is deliberate — it keeps
all nine layouts (L1-L9), every theme and every spacing option working with zero per-layout changes.

When released is false, show a neutral "Your responses have been recorded. Your score will be
available once reviewed." — never an empty score, never a zero.

Wire form-viewer: add `grade { ... }` to the submitResponse selection set in
apps/form-viewer/src/graphql/queries.ts and pass it into FormRenderer. Add the result-screen strings
to the form-viewer's own locale setup.

Accessibility: announce the result in a live region, and convey correct/incorrect with icon + text,
not colour alone.

THE CRITICAL ACCEPTANCE TEST: submitting a NON-quiz form must render the existing thank-you screen
completely unchanged — no wrapper element, no layout shift, no new DOM nodes. Verify against an
existing published form. Also verify all nine layouts, light and dark themes, and mobile width, and
that each respondentVisibility flag visibly changes the screen. Existing form-viewer tests must pass
unmodified. Verify `pnpm type-check`.

When done: branch feat/quiz-result-screen, commit, push, open a PR titled
"Native Quiz: respondent result screen" with body "Closes #299".
```

## 11 · Issue #300 — Responses table columns

```text
Implement GitHub issue #300 of this repo (run: gh issue view 300 — follow it as the spec).
Context first: read the epic (gh issue view 289). Requires #290, #292 and #295 merged.

The old plugin stored scores in unindexed Response.metadata JSON, so they could never be sorted or
filtered in SQL. #292 fixed that with a ResponseGrade table — now use it.

Backend: expose `grade` on the Response GraphQL type (score, maxScore, percentage, passed, status,
gradedAt, detail), guarded by the existing form-permission checks — `detail` can contain correct
answers and must never be reachable without form access. Extend
apps/backend/src/services/responseFilterService.ts and responseQueryBuilder.ts so responses can be
ordered by grade.percentage and filtered on grade.percentage / grade.passed / grade.status, composing
with existing filters and keeping the current filter contract intact.

Frontend: add native Score ("8/10 · 80%") and Status (pass/fail badge, or "Needs review") columns to
apps/form-app/src/utils/createResponsesColumns.tsx, rendered ONLY when the form has quiz mode enabled,
using DataTableColumnHeader for sorting like the existing columns. Build a grade detail drawer by
ADAPTING apps/form-app/src/plugins/quiz/ResultsDialog.tsx into a native component (e.g.
components/Responses/GradeDetailDrawer.tsx) — do not import from the plugin directory, which #303
deprecates.

Legacy compatibility matters: read ResponseGrade first and fall back to the old
metadata['quiz-grading*'] keys when absent, so a form migrated mid-term shows one continuous column
rather than a half-empty one. Use pluginTypeFromMetadataKey from
apps/backend/src/plugins/core/exportRegistry.ts to parse legacy keys.

i18n: extend the existing `responses` namespace in both en and ta.

Verify sorting happens in SQL by inspecting the generated Prisma query, not in memory. Add a
permission test proving `grade` is not returned to a user without form access.

THE CRITICAL ACCEPTANCE TEST: for a form without quiz mode the responses table has NO Score/Status
columns, fires NO extra query, and its column set and layout are identical to before. Verify against
an existing non-quiz form. Run `pnpm --filter backend exec tsc --noEmit`, `pnpm type-check`,
`pnpm test:unit`; existing responses tests must pass unmodified.

When done: branch feat/quiz-responses-columns, commit, push, open a PR titled
"Native Quiz: responses table score columns" with body "Closes #300".
```

## 12 · Issue #301 — Gradebook export columns

```text
Implement GitHub issue #301 of this repo (run: gh issue view 301 — follow it as the spec).
Context first: read the epic (gh issue view 289). Requires #290 and #292 merged.

Today quiz columns come from the plugin export registry (apps/backend/src/plugins/quiz/export.ts,
pulled in by the side-effect import at apps/backend/src/services/unifiedExportService.ts:10). Replace
that with a native path sourced from the ResponseGrade table.

Add native columns to unifiedExportService.ts: Score ("8/10"), Max Score, Percentage, Result
(Pass/Fail), Grading Status, Graded At — emitted ONLY when the form has quiz mode enabled. Add an
optional per-question points column set behind a toggle: one column per graded question headed by the
question label, so the file imports cleanly as a gradebook. Handle duplicate question labels without
column collision.

Legacy handling matters: when a response has no ResponseGrade but does have legacy
metadata['quiz-grading*'], populate the SAME native columns from it. Never emit two parallel sets of
quiz columns in one file — that is the confusing outcome to avoid.

Only remove the `import '../plugins/quiz/index.js'` side-effect import once the native path fully
covers it. If #303 has not landed, LEAVE the import and add a TODO(#289) — a duplicate-column
regression is worse than a stale import.

THE CRITICAL ACCEPTANCE TEST: a non-quiz form's export must be byte-identical to before — same
columns, same order, same headers — asserted on the generated workbook, not on a summary. Add tests to
apps/backend/src/services/__tests__/unifiedExportService.test.ts and keep existing export tests
passing unmodified. Run `pnpm --filter backend exec tsc --noEmit` and `pnpm test:unit`.

When done: branch feat/quiz-export-columns, commit, push, open a PR titled
"Native Quiz: gradebook export columns" with body "Closes #301".
```

## 13 · Issue #302 — Seed template + E2E

```text
Implement GitHub issue #302 of this repo (run: gh issue view 302 — follow it as the spec).
Context first: read the epic (gh issue view 289).
Requires #290, #295, #297, #298 and #299 merged — this ticket proves the feature works as a whole.

Add a quiz template to apps/backend/src/scripts/seed-templates.ts with settings.quiz enabled and
grading populated, covering at least three modes: an `exact` radio question, a `set` checkbox question,
and a `text` question. Update seed-templates-ci.ts too if it maintains its own list.

Write Cucumber E2E scenarios in test/e2e/ tagged @quiz, following the existing structure and reusing
existing step definitions where possible:
- create a quiz via the wizard's "Create a quiz" card and land in the builder with quiz mode on
- author an answer key on a radio question and on a checkbox question
- publish, submit as a respondent, and see the score on the result screen
- verify the score appears in the responses table and can be sorted
- gradeRelease 'afterReview' shows the pending message and NO score
- THE REGRESSION SCENARIO: an existing non-quiz form still builds, submits and reports exactly as
  before, explicitly asserting the ABSENCE of quiz UI in both the builder and the viewer

Use the existing credential convention — E2E_EMAIL / E2E_PASSWORD come from the test:e2e script's
fallback values in package.json. Never hardcode credentials and never register new accounts; this
repo is public.

Make sure the new scenarios are not excluded by the default tag filter
('not @mass-responses and not @persistence and not @skip-ci and not @collaboration').

Verify: `pnpm db:seed` produces a usable template; `pnpm test:e2e -- --tags "@quiz"` passes; the full
`pnpm test:e2e` suite passes with NO existing scenario modified; CI stays green.

When done: branch test/quiz-e2e-coverage, commit, push, open a PR titled
"Native Quiz: seed template + E2E coverage" with body "Closes #302".
```

## 14 · Issue #303 — Deprecate the quiz-grading plugin

```text
Implement GitHub issue #303 of this repo (run: gh issue view 303 — follow it as the spec).
Context first: read the epic (gh issue view 289). Requires #295 merged so native grading is live.

THIS IS DEPRECATION ONLY — DELETE NOTHING. Existing plugin instances must keep executing and every
historical score must keep rendering. A teacher's gradebook from last term cannot break.

Add a `deprecated: true` flag plus a deprecationMessage to packages/plugins/src/manifests/quiz.ts
(extend PluginManifest in packages/plugins/src/types.ts). Render it in
apps/form-app/src/components/plugins/shared/PluginCard.tsx as a "Deprecated" badge, with the card
disabled for NEW instances and a link to Form Settings -> Quiz; existing instances stay openable. Add
a migration banner to PluginConfiguration and PluginDashboardModal.

Block new instances SERVER-SIDE: reject createFormPlugin with type 'quiz-grading' using
createGraphQLError + an appropriate GRAPHQL_ERROR_CODES value. UI gating alone is insufficient — the
mutation is directly callable.

Retarget the AI so it stops proposing a deprecated plugin: in apps/backend/src/lib/aiFormEditTools.ts
remove 'quiz-grading' from AI_PLUGIN_TYPES (line 92), the quiz config block (591), the handling branch
(632-649) and the PROPOSE_CREATE_PLUGIN union member (758), and drop the now-unused QUIZ_FIELD_TYPES
(96). Update the quiz-grading intent regex at apps/backend/src/lib/intentClassifier.ts:41 so quiz
phrasing no longer routes to plugin creation. Update the matching tests
(aiFormEditTools.test.ts, intentClassifier.test.ts).

Do NOT delete the backend handler, the frontend plugin components, the export registration, or
QuizGradingMetadata in packages/types — existing responses, exports and the responses table still read
them. Also refresh the stale references in apps/form-app/src/pages/docs/diagrams/pluginPipeline.ts,
apps/form-app/src/components/automations/builder/actionCatalog.ts:13 and
apps/backend/src/services/automation/graphValidator.ts:109.

Acceptance: createFormPlugin('quiz-grading') is rejected, with a test; the gallery shows the card as
Deprecated and non-creatable; an EXISTING instance still executes on submission and still writes its
metadata; historical responses still render their score in the table and in exports; existing tests
under apps/backend/src/plugins/**/__tests__/ pass UNMODIFIED. Run `pnpm type-check` and `pnpm test:unit`.

When done: branch chore/deprecate-quiz-plugin, commit, push, open a PR titled
"Native Quiz: deprecate the quiz-grading plugin" with body "Closes #303".
```

## 15 · Issue #304 — Migration tool (spike first)

```text
Implement GitHub issue #304 of this repo (run: gh issue view 304 — follow it as the spec).
Context first: read the epic (gh issue view 289) and docs/native-quiz-strategy.md §10.2.
Requires #294 and #303 merged.

THIS IS THE HIGHEST-RISK TICKET IN THE EPIC — it writes into live Y.js collaborative documents.

START WITH A SPIKE, NOT CODE. Updating only the Form.formSchema DB column is NOT enough: for a form
with a materialized CollaborativeDocument row, the next builder session loads the Y.doc and overwrites
the column. Evaluate two approaches — (a) a headless Hocuspocus client that connects to the running
server and applies the change through the normal collaborative path, or (b) a server-side Y.js
transaction applied to the stored state and persisted back to CollaborativeDocument. Prefer (a). Post
your finding as a comment on issue #304 and get it reviewed BEFORE writing the bulk migration or
running anything against real data.

Then write apps/backend/src/scripts/migrate-quiz-plugin-to-native.ts following the conventions of the
existing scripts in that directory (backfill-ai-credits.ts, migrate-organization-roles.ts).
--dry-run is the DEFAULT; an explicit --apply is required to write.

Per FormPlugin of type 'quiz-grading': resolve the live schema the way submitResponse does
(getFormSchemaFromHocuspocus(formId) ?? form.formSchema); for each quizFields[] entry find the field by
fieldId and write grading = { mode:'exact', pointValue: marks, acceptedAnswers:[correctAnswer] }.
REPORT, NEVER GUESS, when the field is missing or when correctAnswer is no longer one of that field's
options — that is the plugin's referential-integrity failure materializing and it needs a human.

Write settings.quiz with enabled:true, passThresholdPercent from the plugin, and
gradeRelease:'never' — deliberately conservative, because the old plugin showed respondents nothing
and silently revealing scores on live forms would blindside form owners. The report tells them to opt
in. For forms with multiple quiz plugin instances, migrate the first enabled one and FLAG the rest for
manual review; never auto-merge conflicting keys. Disable each migrated instance and record
migratedToNativeAt in its config — never delete it.

Safety: snapshot the Y.js state before each write so a bad run is reversible, process in small batches,
and make the script fully idempotent (re-running must not double-write or clobber an already-migrated
form).

Report output per form: matched fields, unmatched fieldIds, options that no longer exist, skipped extra
instances. Exit non-zero from a dry run if anything needs human review.

THE acceptance test: after migration, opening the form in the builder shows the answer keys — proving
the Y.doc, not just the DB column, was updated. Also verify re-running is a no-op, historical
Response.metadata['quiz-grading*'] is untouched, and no form without a quiz plugin is touched at all.
Test against fixtures covering: a clean form, a form with a deleted keyed field, a form with a renamed
option, and a form with two quiz plugin instances.

When done: branch feat/quiz-plugin-migration, commit, push, open a PR titled
"Native Quiz: plugin to native migration tool" with body "Closes #304".
```
