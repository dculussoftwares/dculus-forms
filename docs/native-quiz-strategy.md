# Native Quiz — Strategy, Competitive Analysis & Implementation Plan

**Status:** Approved — tracked in Epic #289 (stories #290–#304)
**Date:** 2026-08-19
**Supersedes:** the `quiz-grading` plugin (`apps/backend/src/plugins/quiz/`, `apps/form-app/src/plugins/quiz/`)
**Agent prompts:** [`docs/native-quiz-agent-prompts.md`](./native-quiz-agent-prompts.md)
**Related:** `docs/architecture/05-plugin-pipeline.md`, `docs/architecture/12-field-type-system.md`, `docs/conditional-logic-v1-strategy.md`, `docs/automations-strategy.md`

---

## 1. Executive summary

### The decision

Move quiz grading from an **event-driven plugin** to a **first-class property of the form schema**, the way Google Forms and Microsoft Forms do it. Concretely:

| | Today (plugin) | Proposed (native) |
|---|---|---|
| Where the answer key lives | `FormPlugin.config.quizFields[]` — a side table keyed by `fieldId` | `field.grading` — on the field itself, in `FormSchema` |
| Who authors it | A separate "Plugins → Quiz Auto-Grading" config page | The field settings panel, next to validation |
| When grading happens | Async, after `emitFormSubmitted` fires | Synchronously inside `submitResponse`, before it returns |
| What the respondent sees | Nothing | Score, per-question correctness, feedback |
| Where the score is stored | `Response.metadata['quiz-grading:<pluginId>']` JSON | `ResponseGrade` row (indexed, sortable, aggregatable) |
| Supported question types | `select_field`, `radio_field` only | select, radio, checkbox, text, textarea, number, date + manual-grade for the rest |

### Why this is the right call

The plugin architecture is a genuinely good fit for **outbound side effects** — webhooks, emails, Sheets rows. It is the wrong shape for quizzes for four structural reasons, none of which can be patched inside the plugin model:

1. **A quiz is a property of the form, not a reaction to it.** The answer key is authored per question and belongs with the question. Keeping it in `FormPlugin.config` means the key silently rots when a field is deleted, retyped (`fieldsSlice.ts` regenerates the field id on type change — see the comment at `apps/form-app/src/store/slices/fieldsSlice.ts:354`), or has its options renamed. There is no referential integrity today.
2. **Plugins fire after the mutation returns.** `submitResponse` calls `emitFormSubmitted` fire-and-forget (`apps/backend/src/graphql/resolvers/responses.ts:359`), so the score physically cannot be in the response payload. **Every competitor shows the score instantly.** This is the single biggest product gap and it is unfixable without moving grading inline.
3. **Two authoring surfaces for one mental model.** Users build questions in the form builder, then leave to a plugin page to say which answers are right. Google Forms puts an "Answer key" link at the bottom of each question card. Ours is two navigations away and lists fields by label in a flat table.
4. **Metadata JSON is a dead end for reporting.** `Response.metadata` is unindexed JSON. You cannot sort responses by score, filter `percentage >= 80`, or compute a class average in SQL. Every quiz-shaped analytics feature is blocked behind a full table scan and in-memory aggregation.

### The additive guarantee

Quiz is an **extension**, not a rewrite of the builder.

> With `form.settings.quiz` **absent** or `enabled: false`, behaviour is **byte-for-byte identical** to before the change: no new UI affordance renders, no new query fires, no new column appears, no new payload field is populated, no extra DB write happens.

Both `grading` (per field) and `settings.quiz` (per form) are optional; absent means the old world. No existing form's schema or settings is ever migrated or backfilled as a side effect of shipping. Every story in the epic carries this as an explicit acceptance criterion, verified against a pre-existing non-quiz form in the builder, the public viewer, and the responses table.

There are two ways in, and both write the same `settings.quiz`:

- **At creation** — a third "Create a quiz" card beside *Start with AI* and *Use a template* in the create-form wizard's `choice` step (`apps/form-app/src/pages/CreateFormWizard.tsx:524`). This is the discovery path.
- **On an existing form** — the Form Settings → Quiz panel. This is the opt-in path, and it never touches `formSchema`.

### What we get that competitors don't

Three things fall out of our existing architecture almost for free, and none of Google Forms / Microsoft Forms / Typeform ship them well:

- **Psychometric item analysis** — difficulty index, discrimination index, distractor efficiency, KR-20 reliability. Our `fieldAnalyticsService` + per-type processors (`apps/backend/src/services/fieldAnalytics/`) is already exactly the right shape to host this. No competitor in the general-purpose form-builder category offers it.
- **Certificates on pass, with zero new infrastructure.** We already have `PdfTemplate` + `PdfGenerator.autoRunOnSubmit` + `responseCopy.pdfTemplateId` (attach a generated PDF to the respondent's copy email). Binding `{{quiz.score}}` / `{{quiz.percentage}}` into a PDF template and gating the generator on `passed = true` is wiring, not new capability. ClassMarker charges for this.
- **Score-aware workflows.** The `Automation` graph engine already has condition nodes and a `form.submitted` trigger. Exposing grade fields in the automation context gives "if score < 50, email the manager and tag the response" for free.

### Recommended shape

- **Phases 1–3 are the product.** Phase 1 reaches Google Forms parity plus instant scoring. Phase 2 makes grading actually good (partial credit, text normalization, manual review). Phase 3 is the differentiation (item analysis, integrity controls).
- **Phase 4+ is optional** and should be re-scoped after seeing Phase 1–3 usage.
- The plugin is **deprecated, not deleted, in the same release** — see §10. The Y.js migration is the riskiest step in the whole plan and deserves its own spike.

---

## 2. Where we are today — plugin audit

### 2.1 Current capability

`apps/backend/src/plugins/quiz/handler.ts` (130 lines) is the entire grading engine:

```ts
const isCorrect = userAnswer === correctAnswer;      // strict string equality
const marksAwarded = isCorrect ? maxMarks : 0;       // binary, no partial credit
```

Config shape (`apps/backend/src/plugins/quiz/types.ts`):

```ts
interface QuizFieldConfig { fieldId, fieldLabel?, correctAnswer: string, marks: number }
interface QuizGradingPluginConfig { quizFields[], passThreshold, columnName? }
```

Result is written to `Response.metadata['quiz-grading:<pluginId>']` as `QuizGradingMetadata` (declared in `packages/types/src/index.ts`), then surfaced by:

- `apps/form-app/src/plugins/quiz/ResponseCell.tsx` — score cell in the responses table
- `apps/form-app/src/plugins/quiz/ResultsDialog.tsx` — per-question breakdown modal
- `apps/backend/src/plugins/quiz/export.ts` — 4 Excel/CSV columns via `registerPluginExport`

### 2.2 Honest limitation list

| # | Limitation | Root cause | Fixable in-plugin? |
|---|---|---|---|
| 1 | Only `select_field` / `radio_field` gradable | `extractSelectionFields` in `ConfigForm.tsx:43`; also hard-coded in `aiFormEditTools.ts:96` (`QUIZ_FIELD_TYPES`) | Yes, but the equality-only engine limits value |
| 2 | Binary scoring only — no partial credit | `handler.ts:28` | Yes |
| 3 | No respondent-facing result at all | `emitFormSubmitted` is fire-and-forget | **No** |
| 4 | No per-question or per-option feedback | No place to author it | Partly |
| 5 | Answer key detaches on field delete/retype/option rename | No referential integrity between `FormPlugin.config` and `FormSchema` | **No** |
| 6 | Score not sortable/filterable/aggregatable | Unindexed `Response.metadata` JSON | **No** |
| 7 | No manual grading, no override, no regrade | No grading state machine | Partly |
| 8 | Multiple quiz plugin instances per form are possible and produce conflicting scores | `quizMetadataKey(pluginId)` namespacing implies N instances by design | **No** — the concept is wrong |
| 9 | No timer, shuffle, attempt limit, question pool | Out of scope for a submission-event handler | **No** |
| 10 | Checkbox (multi-select) unsupported | `userAnswer === correctAnswer` cannot compare arrays | Yes |

Items 3, 5, 6, 8, 9 are architectural. That is the case for going native.

### 2.3 Full removal surface (verified inventory)

Everything that mentions quiz today, so nothing is missed in §10:

**Delete**
- `apps/backend/src/plugins/quiz/` (`handler.ts`, `types.ts`, `export.ts`, `index.ts`, `__tests__/`)
- `apps/form-app/src/plugins/quiz/` (`ConfigForm.tsx`, `MetadataViewer.tsx`, `OverviewSummary.tsx`, `ResponseCell.tsx`, `ResultsDialog.tsx`, `index.ts`)
- `packages/plugins/src/manifests/quiz.ts`
- `apps/form-app/src/locales/{en,ta}/quizGradingPluginConfig.json`, `quizResultsDialog.json`, `quizGradingMetadataViewer.json`

**Edit**
- `apps/backend/src/plugins/index.ts` — drop `./quiz/index.js`
- `apps/form-app/src/plugins/index.ts` — drop `./quiz/index`
- `packages/plugins/src/index.ts` — drop from `allPluginManifests`
- `apps/backend/src/services/unifiedExportService.ts:10` — drop the `import '../plugins/quiz/index.js'` side-effect import
- `apps/backend/src/lib/aiFormEditTools.ts` — `AI_PLUGIN_TYPES` (:92), `QUIZ_FIELD_TYPES` (:96), the `quiz` config block (:591), the `quiz-grading` branch (:632–649), the `PROPOSE_CREATE_PLUGIN` union member (:758)
- `apps/backend/src/lib/intentClassifier.ts:41` — the quiz-grading intent regex (repoint at native quiz intents)
- `apps/form-app/src/pages/Responses.tsx:23,640` — `QuizResultsDialog` import + render branch
- `apps/form-app/src/components/automations/builder/actionCatalog.ts:13` — comment
- `apps/backend/src/services/automation/graphValidator.ts:109` — comment
- `apps/form-app/src/locales/index.ts` — deregister the three namespaces
- `apps/form-app/src/pages/docs/diagrams/pluginPipeline.ts` — quiz appears in the docs diagram

**Keep for back-compat (one release)**
- `QuizGradingMetadata` / `QuizFieldResult` in `packages/types/src/index.ts` — old responses still carry this metadata
- `pluginTypeFromMetadataKey` legacy-key handling in `apps/backend/src/plugins/core/exportRegistry.ts`

---

## 3. Competitive analysis

### 3.1 Feature matrix

Legend: ● full · ◐ partial / workaround · ○ none

| Capability | Google Forms | Microsoft Forms | Typeform | Jotform | Fillout | ClassMarker | **Dculus today** | **Dculus target (P1–P3)** |
|---|---|---|---|---|---|---|---|---|
| Quiz mode toggle | ● | ● | ● | ● | ● | ● | ○ | ● |
| Answer key on the question card | ● | ● | ● | ● | ● | ● | ○ | ● |
| Points per question | ● | ● | ● | ● | ● | ● | ● | ● |
| Auto-grade single choice | ● | ● | ● | ● | ● | ● | ● | ● |
| Auto-grade multi-select | ● | ● | ● | ● | ● | ● | ○ | ● |
| Partial credit (multi-select) | ● | ◐ | ○ | ◐ | ○ | ● | ○ | ● |
| Auto-grade short text | ◐ exact | ◐ exact | ○ | ◐ | ○ | ● | ○ | ● + normalize/regex |
| Auto-grade number w/ tolerance | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ● |
| Per-question feedback (right/wrong) | ● | ● | ○ | ◐ | ○ | ● | ○ | ● |
| Per-**option** feedback | ○ | ○ | ○ | ○ | ○ | ● | ○ | ● (P2) |
| Instant score to respondent | ● | ● | ● | ● | ● | ● | ○ | ● |
| Grade release policy (now / after review) | ● | ◐ | ○ | ○ | ○ | ● | ○ | ● |
| Manual grading + override | ● | ● | ○ | ◐ | ○ | ● | ○ | ● (P2) |
| Bulk regrade after key change | ○ | ○ | ○ | ○ | ○ | ● | ○ | ● (P2) |
| Shuffle questions | ● | ● | ○ | ◐ | ○ | ● | ◐ `isShuffleEnabled` | ● |
| Shuffle answer options | ● | ● | ○ | ◐ | ○ | ● | ○ | ● |
| Question pool (pick N of M) | ○ | ○ | ○ | ○ | ○ | ● | ○ | ● (P4) |
| Timer + auto-submit | ○ (add-on) | ◐ | ○ | ◐ | ○ | ● | ○ | ● (P3) |
| Attempt limits / retakes | ○ | ◐ | ○ | ◐ | ○ | ● | ○ | ● (P3, signed-in) |
| Item analysis (difficulty/discrimination) | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ● (P3) ★ |
| Score distribution / cohort stats | ◐ | ● Insights | ○ | ○ | ○ | ● | ○ | ● (P3) |
| Certificate on pass | ○ | ○ | ○ | ◐ | ○ | ● | ○ | ● (P4) ★ |
| Score-based branching | ○ | ◐ | ● | ◐ | ● | ● | ○ | ● (P3) |
| Outcome / personality quiz | ○ | ○ | ● | ◐ | ◐ | ○ | ○ | P5 (optional) |
| Score-driven workflow automation | ○ | ○ | ○ | ◐ | ◐ | ◐ | ○ | ● (P3) ★ |

★ = our structural advantage; existing platform capability we can point at a quiz.

### 3.2 What each competitor teaches us

**Google Forms** — the interaction model to copy. Quiz mode is one toggle in Settings; every question card then grows an "Answer key" affordance where you pick the correct option(s), set a point value (0 is allowed, for ungraded questions), and write feedback shown after submission. Grade release is a binary choice — *immediately after each submission* (self-paced) vs *later, after manual review*. Three independent respondent-visibility toggles control whether they see missed questions, correct answers, and point values. Multiple-choice supports "award partial credit" or "require all correct". Its data model is worth mirroring almost literally: a `grading` object per question holding `pointValue`, `correctAnswers.answers[]`, `whenRight`, `whenWrong`, `generalFeedback`. Its hard limits: no question bank, no native timer, no per-question time limit, no item analysis, no certificates, and short-answer grading is exact-match only.

**Microsoft Forms** — beats Google on two axes worth stealing: **granular branching** (show/hide individual questions on the same page, and branch on more than just multiple-choice — Google can only jump between sections from a choice question) and **math equation support**, which matters enormously for STEM assessment and is a common Google Forms complaint. Its Insights panel gives class-level performance data — closer to what we want in Phase 3, though still not psychometric.

**Typeform** — a different product. Its "Score quiz" (numeric points → route to endings) and "Outcome quiz" (personality-style, each answer feeds an outcome bucket) are mutually exclusive modes, which is itself a design warning: their two scoring systems both hijack ending-routing and therefore can't coexist. If we ever build outcome quizzes (Phase 5), keep the scored path and the outcome path composable rather than exclusive.

**Jotform / Fillout / Tally** — the "form builder with a scoring widget" tier. Serviceable, but scoring is bolted on and reporting is thin. Fillout's strength is choice-based routing into structured submissions; that's roughly what our existing `skipToPage` condition action already does.

**ClassMarker** — the assessment specialist, and the honest benchmark for Phases 3–4. Question banks with categorization and reuse; pull 20 random questions from a pool of 50 so no two candidates see the same exam; shuffled question and option order; strict time limits; attempt limits; auto-populating PDF certificates issued the moment a candidate passes. This is what "serious assessment" looks like, and it maps almost exactly onto our Phase 3 + 4 list.

**Academic item analysis** — the standard metrics we should implement in Phase 3, with published interpretation bands so the UI can label them:
- **Difficulty index (P)**, 0–100% = share of respondents who got it right. Higher = easier. Recommended band 30–70%; below 30% is a hard item, above 70% is an easy one.
- **Discrimination index (D)**, −1.00 to +1.00 = does this item separate strong from weak respondents (top 27% vs bottom 27%). ≥0.35 excellent, 0.20–0.35 acceptable, ≤0.20 poor. **Negative D is the money signal** — it usually means a miskeyed answer.
- **Distractor efficiency** — how many low scorers vs high scorers picked each wrong option. A distractor nobody picks is non-functional; it artificially inflates the difficulty index and weakens discrimination.
- **KR-20** — internal-consistency reliability for the quiz as a whole.

### 3.3 Positioning

> Google Forms is where quizzes get made. Nobody tells you whether the quiz was any good.

Our wedge is not "another quiz builder." It's **quiz mode plus the reporting and workflow layer around it** — item analysis that tells an educator which questions to rewrite, certificates that issue themselves, and automations that route a failing score to a human. All three are cheap for us and expensive for Google.

---

## 4. Feature analysis — what to build, scored

Scored on value to users vs cost against *our* architecture. "Cost" reflects the specific touchpoints in §9.

| Feature | Value | Cost | Notes |
|---|---|---|---|
| Quiz mode toggle + per-question answer key | **Critical** | M | The whole feature's foundation |
| Synchronous grading in `submitResponse` | **Critical** | M | Unblocks every respondent-facing behaviour |
| `ResponseGrade` storage (indexed) | **Critical** | M | Unblocks every reporting behaviour |
| Respondent result screen | **Critical** | M | Reuses the thank-you screen slot |
| Grade release policy | High | S | Two states in P1; scheduled release later |
| Score column + sort + filter in responses table | High | S | `createResponsesColumns.tsx` + `responseQueryBuilder` |
| Export gradebook columns | High | S | Replaces `plugins/quiz/export.ts` |
| Partial credit (checkbox) | High | S | Pure engine work |
| Text answer normalization (case/trim/punctuation) | High | S | Pure engine work; beats Google |
| Regex / multiple accepted answers | Med-High | S | Same |
| Number tolerance (± abs / ± %) | Med | S | Nobody else has it |
| Per-question feedback (right/wrong/general) | High | M | Authoring UI is the cost |
| Per-**option** feedback | Med | M | Real differentiator for teaching |
| Manual grading queue + override + audit | High | L | Needed the moment text/file answers are gradable |
| Bulk regrade after key change | High | M | Reuse `PluginBackfillJob` pattern (`plugins/core/backfill.ts`) |
| Item analysis dashboard | **High ★** | L | Slots into `fieldAnalytics/` cleanly |
| Score distribution + cohort stats | High | M | Same |
| Shuffle options | Med | S | Viewer-side; must be seeded per session for stable back-nav |
| Timer + auto-submit + server enforcement | Med-High | L | Needs a server-issued attempt token |
| Attempt limits / retakes | Med | M | Requires `requireSignIn`; policy for best vs latest |
| Integrity signals (tab switches, paste, per-question time) | Med | M | Deterrent, **not** proctoring — say so in the UI |
| Score-based branching | Med | S | New condition source `__quiz.percentage` over existing engine |
| Score in automations context | Med-High | S | Add grade to the automation trigger payload |
| Certificate on pass ★ | **High ★** | M | Existing PDF stack + a pass filter + score bindings |
| Question pool (pick N of M) | Med | **XL** | Breaks the fixed-schema assumption — see §11 |
| Practice mode (per-question instant feedback) | Med | L | Needs a `gradeAnswer` mutation |
| Outcome / personality quiz | Low-Med | L | Needs multiple endings, which we don't have |
| Math equation questions | Med | L | New field type; separate initiative |

**Explicit non-goals for v1:** real proctoring (webcam/lockdown browser), LMS/LTI integration, adaptive testing (IRT-driven item selection), and handwriting/OCR grading. Each is a product on its own.

---

## 5. Proposed data model

### 5.1 Per-question: `grading` on the field

Add an optional `grading` property to `FillableFormField`, sibling to `validation`. Plain JSON, no classes — same treatment `conditions` gets, so it flows through `serializeFormField` / `deserializeFormField` / Y.js untouched.

```ts
// packages/types/src/quiz.ts (new)

export type GradingMode =
  | 'exact'        // single-value equality (radio, select-single, date)
  | 'set'          // multi-select comparison (checkbox, select-multiple)
  | 'text'         // normalized text match against acceptedAnswers[]
  | 'numeric'      // numeric equality within a tolerance
  | 'manual';      // never auto-graded; a human assigns points

export interface TextMatchOptions {
  caseSensitive?: boolean;        // default false
  trimWhitespace?: boolean;       // default true
  ignorePunctuation?: boolean;    // default false
  collapseWhitespace?: boolean;   // default true
  regex?: boolean;                // treat acceptedAnswers as anchored patterns
}

export interface NumericMatchOptions {
  tolerance?: number;             // absolute, e.g. 0.01
  tolerancePercent?: number;      // relative, e.g. 5 => ±5%
  min?: number;                   // range answers: accept anything in [min, max]
  max?: number;
}

export interface SetMatchOptions {
  /** 'all'    — full points only when the selection matches the key exactly
   *  'partial'— pointValue * (correctPicked - wrongPicked*penalty) / keySize, floored at 0
   *  'any'    — full points if at least one keyed option is selected */
  scoring: 'all' | 'partial' | 'any';
  wrongSelectionPenalty?: number; // 0..1, default 1 (a wrong pick cancels a right one)
}

export interface OptionFeedback {
  option: string;                 // must match an entry in field.options
  feedback: string;               // rich text shown when this option was chosen
}

export interface FieldGrading {
  /** Question is part of the quiz. Absent grading === not graded. */
  mode: GradingMode;
  /** Points for a fully correct answer. 0 is legal (ungraded but shown in the key). */
  pointValue: number;
  /** Accepted answers. Semantics depend on `mode`:
   *  exact   -> exactly one entry
   *  set     -> the full correct selection
   *  text    -> any one match scores
   *  numeric -> one entry, parsed as a number (ignored when min/max are set)
   *  manual  -> empty */
  acceptedAnswers: string[];
  text?: TextMatchOptions;
  numeric?: NumericMatchOptions;
  set?: SetMatchOptions;
  /** Feedback (rich text/HTML, same editor as hint) */
  whenCorrect?: string;
  whenIncorrect?: string;
  general?: string;               // always shown, regardless of correctness
  optionFeedback?: OptionFeedback[];
  /** Shuffle this question's options per respondent (P3) */
  shuffleOptions?: boolean;
}
```

Attach it to the base class:

```ts
export class FillableFormField extends FormField {
  // ...existing
  grading?: FieldGrading;   // absent => this question is not graded
}
```

**Why on the field and not a parallel `FormSchema.quiz.questions[]` map?** The parallel-map approach is exactly what the plugin does today, and limitation #5 (key detaches on field delete/retype) is its direct consequence. Putting `grading` on the field means delete/duplicate/reorder/type-change all do the right thing automatically, because they already operate on the whole field object.

**Field-type → default mode:**

| Field type | Default `mode` | Notes |
|---|---|---|
| `RADIO_FIELD`, `SELECT_FIELD` (single) | `exact` | key = one option string |
| `SELECT_FIELD` (multiple), `CHECKBOX_FIELD` | `set` | key = option array |
| `TEXT_INPUT_FIELD`, `TEXT_AREA_FIELD` | `text` | textarea defaults to `manual` above a length threshold |
| `NUMBER_FIELD` | `numeric` | |
| `DATE_FIELD` | `exact` (or `numeric` range via min/max) | |
| `EMAIL_FIELD`, `PHONE_NUMBER_FIELD` | `text` | rarely useful, but harmless |
| `FILE_UPLOAD_FIELD` | `manual` | only manual is coherent |
| `RICH_TEXT_FIELD` | *(non-fillable — not gradable)* | usable as a passage/stimulus block |

### 5.2 Form-level: `FormSettings.quiz`

Policy — not the key — goes in settings, alongside `submissionLimits` / `accessControl` in `packages/types/src/index.ts`:

```ts
export type GradeRelease = 'immediate' | 'afterReview' | 'scheduled' | 'never';

export interface QuizRespondentVisibility {
  totalScore: boolean;          // "You scored 8/10"
  perQuestionCorrectness: boolean;
  correctAnswers: boolean;      // reveal the key for missed questions
  pointValues: boolean;
  feedback: boolean;
  passFailBadge: boolean;
}

export interface QuizIntegritySettings {
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  timeLimitSeconds?: number;      // whole-quiz countdown; auto-submits
  perPageTimeLimitSeconds?: number;
  maxAttempts?: number;           // requires accessControl.requireSignIn
  attemptScoring?: 'best' | 'latest' | 'first';
  disableBackNavigation?: boolean;
  recordFocusLoss?: boolean;      // logs tab-switch count — a deterrent, not proctoring
}

export interface QuizSettings {
  enabled: boolean;
  passThresholdPercent?: number;   // default 60
  gradeRelease: GradeRelease;
  releaseAt?: string;              // ISO 8601, when gradeRelease === 'scheduled'
  respondentVisibility: QuizRespondentVisibility;
  integrity?: QuizIntegritySettings;
  /** Rich text shown above the result, with {{score}} / {{percentage}} mentions */
  resultMessagePass?: string;
  resultMessageFail?: string;
}

export interface FormSettings {
  // ...existing
  quiz?: QuizSettings;
}
```

### 5.3 Grade storage: a `ResponseGrade` table

**Recommendation: a 1:1 relation, not columns on `Response` and not JSON in `metadata`.**

This mirrors the existing `FormSubmissionAnalytics` 1:1 precedent, keeps the hot `response` table narrow, and still supports `orderBy: { grade: { percentage: 'desc' } }` and `where: { grade: { percentage: { gte: 80 } } }` in Prisma, which is what the responses table and filters need.

```prisma
model ResponseGrade {
  id             String    @id @default(cuid())
  responseId     String    @unique
  formId         String    // denormalized: cohort aggregates without a join through response
  score          Float     // auto + manual, after overrides
  maxScore       Float
  percentage     Float     // 0..100, persisted so we can index/sort on it directly
  passed         Boolean
  status         String    // AUTO_GRADED | NEEDS_REVIEW | REVIEWED | RELEASED
  autoScore      Float     // pre-override machine score, kept for audit
  gradedAt       DateTime  @default(now())
  gradedById     String?   // null for machine grading
  releasedAt     DateTime?
  schemaVersion  Int       @default(1) // bump on regrade so stale rows are visible
  /** QuestionGradeResult[] — per-question breakdown */
  detail         Json
  /** attempt tracking + integrity signals (focusLossCount, durationSeconds, …) */
  attemptNumber  Int       @default(1)
  integrity      Json?

  response Response @relation(fields: [responseId], references: [id], onDelete: Cascade)

  @@index([formId])
  @@index([formId, percentage])
  @@index([formId, status])
  @@map("response_grade")
}
```

Per-question detail (in `detail`, and mirrored as a shared type):

```ts
export interface QuestionGradeResult {
  fieldId: string;
  fieldLabel: string;       // snapshot — the label may change later
  fieldType: FieldType;
  mode: GradingMode;
  submittedValue: unknown;
  acceptedAnswers: string[];
  correct: boolean | null;  // null = awaiting manual grading
  pointsAwarded: number;
  pointValue: number;
  autoPointsAwarded: number;
  overriddenBy?: string;    // userId, when a human changed it
  graderComment?: string;
  feedbackShown?: string;
  timeSpentSeconds?: number;
}
```

Prisma changes require **both** a checked-in migration under `apps/backend/prisma/migrations/` and `pnpm db:generate && pnpm db:push` locally — see CLAUDE.md "Prisma Schema Changes". Use `CREATE TABLE IF NOT EXISTS` in the migration SQL.

---

## 6. Security model — the answer key must never reach the viewer

**This is the most important section in the document.** The current plugin is, incidentally, secure: the answer key lives in `FormPlugin.config`, which the public API never returns. Moving `grading` into `FormSchema` puts the key one careless resolver away from being served to every respondent.

### 6.1 The exposure paths

| Path | Reaches the public? | Mitigation |
|---|---|---|
| `Form.formSchemaPublic` (GraphQL) | **Yes** — this is what form-viewer renders (`apps/form-viewer/src/pages/FormViewer.tsx:126`) | **Strip `grading` from every field.** The resolver at `apps/backend/src/graphql/resolvers/forms.ts:126` already maps over pages/fields to filter `deleted` — extend that same map. |
| `Form.formSchema` (GraphQL) | No — builder only, behind `requireAuth` + form permission | Keep `grading` |
| Hocuspocus Y.doc (`:4000`) | No — form-viewer never connects; `CollaborationManager` sends a bearer token | Keep `grading` |
| `Form.settings` (GraphQL) | Typed object with explicit subfields; the viewer selects only what it needs | Expose only a **public projection** of `QuizSettings` — never `respondentVisibility` internals that would hint at the key, and never per-question data |
| `submitResponse` result | Yes, by design | Return only what `respondentVisibility` + `gradeRelease` permit — see §7.3 |
| Excel/CSV export | Builder-only | Full detail is fine |

### 6.2 Non-negotiable rules

1. **`formSchemaPublic` strips `grading` unconditionally.** Not "when quiz mode is off" — always. A single unit test asserting `JSON.stringify(publicSchema)` contains no `grading` key is the cheapest insurance in this project, and it belongs in the same test file as the `deleted`-filter test.
2. **Grading runs server-side only.** The client never computes a score, even for display. There is no client-side grading path to disable.
3. **The result payload is assembled per-policy on the server.** `gradeRelease: 'afterReview'` returns *no* score at all — not a hidden field, not a zero. `respondentVisibility.correctAnswers: false` means correct answers are absent from the JSON, not merely unrendered.
4. **A shuffled-option seed is server-issued and bound to the session.** Otherwise re-rolling the shuffle client-side leaks nothing, but a client-chosen seed makes attempt-level integrity signals meaningless.
5. **Timer deadlines are enforced in `submitResponse`**, against a server-recorded attempt start, not a client-reported elapsed time. The client countdown is a courtesy.
6. **Attempt limits are enforced server-side** against `respondentUserId`, and are only offered when `accessControl.requireSignIn` is on. An anonymous quiz cannot have a meaningful attempt limit and the UI must say so rather than pretending.

---

## 7. Grading engine

### 7.1 Placement

A pure module — `apps/backend/src/services/quiz/gradingEngine.ts` — with **no** Prisma or I/O dependency, so it is trivially unit-testable and can be reused by the regrade job and by preview.

```ts
export function gradeResponse(
  schema: FormSchema,               // deserialized, with grading intact
  settings: QuizSettings,
  data: Record<string, unknown>,    // already conditionally-stripped
): GradeResult                      // { score, maxScore, percentage, passed, status, questions[] }
```

### 7.2 Call site

Inside `submitResponse` (`apps/backend/src/graphql/resolvers/responses.ts`), **after** `stripConditionallyHiddenValues` (~line 210) and **after** the response row is created, but **before** the resolver returns. Two ordering rules matter:

- Grade *after* conditional stripping, so a question the respondent never saw is excluded from `maxScore` rather than counted as wrong. This is a correctness requirement, not a nicety — with conditional logic, two respondents can legitimately face different denominators.
- Grade *inside* the request, not in the plugin fan-out. The `emitFormSubmitted` payload then carries the grade so automations can branch on it.

Failure policy: if grading throws, **log and continue** — the response must still be saved. Write `status: NEEDS_REVIEW` with an error note. Losing a submission because of a grading bug is strictly worse than an ungraded submission.

### 7.3 The response payload

`SubmitResponsePayload` gains an optional `grade`, assembled per policy:

```ts
interface RespondentGradeView {
  released: boolean;                 // false => everything below is absent
  score?: number;
  maxScore?: number;
  percentage?: number;
  passed?: boolean;
  message?: string;                  // resultMessagePass/Fail, mention-substituted
  questions?: Array<{
    fieldId: string;
    label: string;
    correct?: boolean;
    pointsAwarded?: number;
    pointValue?: number;
    yourAnswer?: unknown;
    correctAnswer?: string[];        // only when respondentVisibility.correctAnswers
    feedback?: string;
  }>;
}
```

When `gradeRelease` is `afterReview` / `scheduled` / `never`, `released: false` and the viewer shows "Your responses have been recorded. Your score will be available once reviewed." — Google's exact behaviour.

### 7.4 Per-mode semantics

**`exact`** — compare the submitted scalar to `acceptedAnswers[0]` after `String()` coercion and trim. Full points or zero.

**`set`** — normalize both sides to string sets.
- `all`: `pointValue` iff the sets are equal.
- `partial`: `pointValue * max(0, (|picked ∩ key| − penalty·|picked \ key|)) / |key|`, rounded to 2dp. Default `wrongSelectionPenalty = 1`, which is the standard "guessing-proof" rule.
- `any`: `pointValue` iff `|picked ∩ key| ≥ 1`.
- Respect `CheckboxFieldValidation.minSelections/maxSelections` — a submission violating them is already rejected by validation, so the engine can assume well-formed input.

**`text`** — normalize per `TextMatchOptions` (trim → collapse whitespace → lowercase unless `caseSensitive` → strip punctuation if asked), then test against each accepted answer. With `regex: true`, each accepted answer is compiled **anchored** (`^(?:…)$`) with a **length cap and a compile-time guard**, and evaluated under a step budget — untrusted regex from a form author is a ReDoS vector and must be treated as one. Reject patterns over ~200 chars at authoring time.

**`numeric`** — parse the submitted value with `Number()`; `NaN` scores zero. Then:
- `min`/`max` present → correct iff `min ≤ v ≤ max`
- `tolerance` present → correct iff `|v − target| ≤ tolerance`
- `tolerancePercent` present → correct iff `|v − target| ≤ |target| · pct/100`
- otherwise strict equality

**`manual`** — `correct: null`, `pointsAwarded: 0`, and the whole response's `status` becomes `NEEDS_REVIEW`. `maxScore` still includes the `pointValue`.

### 7.5 Denominator rules

`maxScore` = sum of `pointValue` over questions that were **visible to this respondent** (post conditional-strip) and have `grading` present. Questions with `pointValue: 0` participate in correctness reporting but not the denominator — that's how Google's "0-point ungraded question" behaves.

### 7.6 Regrade

Changing an answer key after responses exist is common (a miskeyed question surfaced by a negative discrimination index is *exactly* the case we want to support). Provide a `regradeResponses(formId, filter?)` mutation that replays `gradeResponse` over stored `data` using the current schema, bumps `schemaVersion`, preserves manual overrides unless explicitly told to discard them, and writes an audit row. Model it on the existing `PluginBackfillJob` / `apps/backend/src/plugins/core/backfill.ts` pattern rather than inventing new job plumbing.

---

## 8. UX design

### 8.1 Turning quiz mode on

Two entry points, one setting (see "The additive guarantee" in §1). At creation, a third **Create a quiz** card in the wizard's `choice` step, whose flow stays deliberately thin — title, blank-or-AI, pass threshold, grade release — then continues into the *existing* appearance step rather than forking a parallel flow.

For existing forms, a new **Quiz** section in the form-settings sidebar (`apps/form-app/src/components/form-settings/SettingsSidebar.tsx` + a `QuizSettings.tsx` panel, registered in `FormSettingsContainer.tsx`'s switch). Contents: the enable toggle, pass threshold, grade release, the six respondent-visibility switches, result messages, and (Phase 3) the integrity block.

When quiz mode turns on, the builder changes:
- Each gradable field card in `PageBuilderFieldCard.tsx` grows a **points badge** and an **"Answer key"** affordance.
- The field settings panel (`field-settings-v2/`) grows a **Grading** section below Validation — implemented once as `field-settings-v2/GradingSettings.tsx` and composed into `SelectionFieldSettings`, `TextFieldSettings`, `NumberFieldSettings`, `DateFieldSettings`, driven by the field-type → mode table in §5.1.
- A **quiz summary strip** shows total points, question count, and ungraded-question count.

Turning quiz mode *off* must not delete answer keys. Keep `grading` in the schema, ignore it at grade time, and warn on the toggle. Users toggle quiz mode off by accident and destroying an hour of key-entry is unforgivable.

### 8.2 Answer key authoring

For selection fields, keep it in-place: a radio/checkbox column next to each option marks it correct, with the point input inline — one interaction, no modal, matching Google. For text/number fields, an "accepted answers" repeater plus the normalization switches. Feedback fields (correct/incorrect/general) are collapsed by default so simple quizzes stay simple.

### 8.3 Respondent experience (form-viewer)

Reuse the thank-you screen slot in `LayoutRenderer` rather than inventing a route. `FormRenderer` gains a `gradeResult?: RespondentGradeView` prop; when present, the thank-you screen renders a `QuizResultScreen` — score headline, pass/fail badge, then the per-question review list gated by `respondentVisibility`. This keeps every existing layout (L1–L9), theme, and spacing working with no per-layout changes.

Per-question review rows show: the question, the respondent's answer, a correct/incorrect marker, points, the correct answer (if permitted), and feedback (question-level + option-level for the option they picked).

### 8.4 Builder-side reporting

- **Responses table** — replace the plugin's `ResponseCell` with native `Score` and `Status` columns in `apps/form-app/src/utils/createResponsesColumns.tsx`, sortable via the `grade` relation and filterable through `responseQueryBuilder.ts`. Row click opens a native grade detail drawer (adapted from `plugins/quiz/ResultsDialog.tsx`, which is decent UI worth keeping).
- **Grading queue** — a `?status=NEEDS_REVIEW` view over the responses table with per-question point inputs and a grader comment, plus keyboard-driven next/previous so grading 60 papers isn't 60 page loads.
- **Quiz analytics tab** (Phase 3) — sits beside the existing Analytics tabs: score distribution histogram, mean/median/std-dev, pass rate, per-question difficulty/discrimination/distractor table with the interpretation bands from §3.2 rendered as colored chips, and KR-20 with a plain-English reading. Follow `docs/dataviz` conventions and the existing `FieldAnalytics/` component structure.

### 8.5 i18n

Mandatory, per CLAUDE.md. New namespaces, each in both `en` and `ta`, registered in `apps/form-app/src/locales/index.ts`:
`quizSettings`, `quizGrading` (field-settings section), `quizResults` (builder-side), `quizAnalytics`. The form-viewer result screen needs its own strings in the viewer's locale setup.

---

## 9. Implementation plan

### Phase 0 — Spikes (must precede Phase 1)

1. **Y.js nested-object spike.** `createYJSFieldMap` currently special-cases `options` (Y.Array), `allowedMimeTypes` (Y.Array) and `validation` (Y.Map) by hand (`apps/form-app/src/store/helpers/fieldHelpers.ts:291`). Prove that a `grading` Y.Map — containing a nested `acceptedAnswers` Y.Array and a nested `optionFeedback` structure — round-trips through `extractFieldData` / `createYJSFieldMap` / `serializeFieldToYMap` and survives duplicate, copy-to-page, reorder, and type-change. **Everything downstream depends on this.**
2. **Migration spike.** Determine how to write `grading` into a *live Hocuspocus document* for forms whose Y.doc is already materialized (§10.2). This is the plan's highest-risk unknown.
3. **Security test harness.** Land the `formSchemaPublic` no-`grading` assertion before any `grading` code exists, so it fails loudly the moment someone forgets the strip.

### Phase 1 — MVP: parity + instant scoring

**Goal:** a form owner can mark correct answers on choice/text/number questions and respondents see their score immediately.

Types (`packages/types/`)
- [ ] New `src/quiz.ts` with `FieldGrading`, `GradingMode`, `QuizSettings`, `QuestionGradeResult`, `RespondentGradeView` + Zod sanitizers (mirror `sanitizeConditions`)
- [ ] `grading?: FieldGrading` on `FillableFormField`; handle in `deserializeFormField` for every fillable case
- [ ] `QuizSettings` on `FormSettings`; re-export from `src/index.ts`

Backend
- [ ] `services/quiz/gradingEngine.ts` (pure) + unit tests per mode
- [ ] `ResponseGrade` model + checked-in migration + `pnpm db:generate && db:push`
- [ ] `services/quiz/gradingService.ts` — persist, read, per-policy projection
- [ ] `resolvers/responses.ts` — grade inline in `submitResponse`; extend `SubmitResponsePayload` with `grade`
- [ ] **`resolvers/forms.ts:126` — strip `grading` in `formSchemaPublic`** ← security-critical
- [ ] Expose the public projection of `QuizSettings` in `schema.ts`
- [ ] Grade fields in the `emitFormSubmitted` payload (for automations)

UI package (`packages/ui/`)
- [ ] `renderers/QuizResultScreen.tsx`; `gradeResult` prop on `FormRenderer` → thank-you slot

Form app
- [ ] `form-settings/QuizSettings.tsx` + sidebar entry + `FormSettingsContainer` case
- [ ] `field-settings-v2/GradingSettings.tsx`, composed into the four type-specific settings components
- [ ] `useFieldEditor.ts` — `extractFieldData` / `handleSave` must carry `grading`
- [ ] `store/helpers/fieldHelpers.ts` — `createFormField`, `createYJSFieldMap`, `serializeFieldToYMap`
- [ ] `store/collaboration/CollaborationManager.ts` — `FieldData.grading` + `extractFieldData`
- [ ] Points badge + answer-key affordance on `PageBuilderFieldCard.tsx`
- [ ] Score/Status columns in `createResponsesColumns.tsx`; native grade drawer
- [ ] i18n `quizSettings`, `quizGrading`, `quizResults` (en + ta), registered in `locales/index.ts`

Form viewer
- [ ] Pass `grade` from the mutation result into `FormRenderer`

Export
- [ ] Native gradebook columns in `unifiedExportService.ts` (Score, Max, %, Pass/Fail, Status, + per-question points behind a toggle), replacing `plugins/quiz/export.ts`

Tests
- [ ] Engine unit tests (every mode, edge cases: empty answer, conditional-hidden question, 0-point question)
- [ ] Integration: submit → grade → payload shape under each `gradeRelease`
- [ ] **Security: `formSchemaPublic` never contains `grading`**
- [ ] E2E (`test/e2e/`): build a quiz, submit as respondent, see the score

### Phase 2 — Grading depth

- [ ] Partial credit for `set` mode; wrong-selection penalty
- [ ] Text normalization + multiple accepted answers + guarded regex (anchored, length-capped, step-budgeted)
- [ ] Number tolerance / range
- [ ] `manual` mode + `NEEDS_REVIEW` status
- [ ] Grading queue UI + per-question override + grader comment + audit trail
- [ ] Feedback authoring (correct / incorrect / general) and rendering
- [ ] Per-option feedback
- [ ] `regradeResponses` mutation + job, modeled on `plugins/core/backfill.ts`
- [ ] Scheduled grade release (`releaseAt`)

### Phase 3 — Assessment analytics & integrity

- [ ] `services/quiz/itemAnalysis.ts` — difficulty index, discrimination index (top/bottom 27%), distractor efficiency, KR-20
- [ ] Quiz Analytics tab: score distribution, cohort stats, per-question table with interpretation bands, negative-discrimination warnings
- [ ] Shuffle questions / options with a server-issued per-session seed
- [ ] Timer + auto-submit + server-side deadline enforcement against a recorded attempt start
- [ ] Attempt limits + `best`/`latest`/`first` scoring (gated on `requireSignIn`)
- [ ] Integrity signals: focus-loss count, per-question dwell time, paste events → `ResponseGrade.integrity`; **labeled in the UI as deterrents, not proctoring**
- [ ] `__quiz.percentage` as a condition source for score-based branching
- [ ] Grade fields available in the automation condition editor

### Phase 4 — Scale & education

- [ ] Certificates: `{{quiz.score}}` / `{{quiz.percentage}}` / `{{quiz.passed}}` bindings in the PDF designer; pass-condition filter on `PdfGenerator`; attach on `responseCopy`
- [ ] Question pools (pick N of M) — **see the §11 warning**
- [ ] Section / category sub-scores
- [ ] Gradebook CSV export shaped for LMS import
- [ ] Practice mode via a `gradeAnswer` mutation (per-question instant feedback)
- [ ] Leaderboard (opt-in, respects `accessControl`)

### Phase 5 — Optional

- [ ] Outcome / personality quizzes. Requires **multiple endings**, which the platform does not have (`FormLayout.thankYouContent` is singular). Treat "multiple endings" as its own initiative and revisit outcome quizzes afterward. Note Typeform's mistake: keep scored and outcome paths composable, not mutually exclusive.

### Cross-cutting checklist (per CLAUDE.md field-type rules)

Adding `grading` to `FillableFormField` touches the standard field-system chain. Every item below must be done or explicitly waived:
`packages/types/src/index.ts` (class + deserialize) → `validation.ts` (grading Zod schema) → `packages/ui/src/renderers/FormFieldRenderer.tsx` (no change expected — verify) → `field-settings-v2/` → `useFieldEditor.ts` → `store/helpers/fieldHelpers.ts` (4 functions) → `store/collaboration/CollaborationManager.ts` → `apps/backend/src/scripts/seed-templates.ts` (add a quiz template) → i18n en+ta.

---

## 10. Migration & deprecation

### 10.1 Sequencing

| Release | Plugin | Native |
|---|---|---|
| R1 | Still functional; gallery card marked **Deprecated**; new instances blocked | Phase 1 ships; migration tool available |
| R2 | Read-only — existing scores still render, config is not editable | Phases 2–3 |
| R3 | Code deleted; legacy `Response.metadata['quiz-grading*']` still readable in exports | — |

Never silently drop historical scores. A teacher's gradebook from last term must keep rendering.

### 10.2 The migration itself

For each `FormPlugin` where `type = 'quiz-grading'`:

1. Resolve the live schema (Hocuspocus first, DB column fallback — the same helper `submitResponse` uses).
2. For each `quizFields[]` entry, find the field by `fieldId`. **Report, don't guess,** when the field is missing or its `correctAnswer` is no longer one of its options — that's limitation #5 materializing, and it needs a human.
3. Write `grading` onto matched fields: `mode: 'exact'`, `pointValue: marks`, `acceptedAnswers: [correctAnswer]`.
4. Write `Form.settings.quiz`: `enabled: true`, `passThresholdPercent: passThreshold`, `gradeRelease: 'never'` — **deliberately conservative**, because the old plugin showed respondents nothing and silently starting to reveal scores on live forms would be a nasty surprise. The migration report tells owners to opt in.
5. **The hard part: writing into the Y.doc.** For forms with a materialized `CollaborativeDocument` row, updating only the `Form.formSchema` column is not enough — the next builder session will load the Y.doc and overwrite it. Options, in order of preference: (a) a headless Hocuspocus client that connects and applies the change through the normal path; (b) a server-side Y.js transaction applied to the stored state vector and persisted back. **Both need the Phase 0 spike.** Do not start the migration until this is settled.
6. Disable the plugin instance and record `migratedToNativeAt` in its config.

Ship a `--dry-run` mode that emits the full report (matched / unmatched / ambiguous fields per form) before anything is written. For a form with multiple quiz plugin instances (limitation #8), migrate the first enabled one and flag the rest for manual review — merging conflicting keys automatically would be guessing.

### 10.3 Responses table during transition

The score column reads `ResponseGrade` first, falling back to legacy `metadata['quiz-grading*']` when absent, so a form migrated mid-term shows a continuous column rather than a half-empty one.

---

## 11. Risks & open questions

| Risk | Severity | Mitigation |
|---|---|---|
| **Answer key leaks via `formSchemaPublic`** | **Critical** | Strip in the resolver; assertion test landed in Phase 0, before any grading code exists |
| **Y.doc migration corrupts live collaborative documents** | **High** | Phase 0 spike; dry-run; per-form backup of the Y state before write; migrate in small batches |
| Nested `grading` doesn't survive Y.js duplicate / type-change / copy-to-page | High | Phase 0 spike; explicit tests for all four field operations |
| Grading throws and blocks a submission | High | Grade in a try/catch; save the response regardless; `NEEDS_REVIEW` on failure |
| ReDoS via author-supplied regex | Med | Anchored compile, 200-char cap, step budget, authoring-time validation |
| Score denominators differ between respondents under conditional logic | Med | Grade post-strip; show "8/10 (of the questions you saw)" in the UI; document it |
| Analytics cost on large forms | Med | Item analysis is O(responses × questions) — compute on demand with a cache, not on every submit |
| Question pools break the fixed-schema assumption | **High** | See below |
| Users toggle quiz mode off and lose keys | Med | Never delete `grading` on toggle-off; warn |
| Scope creep into a full LMS | Med | The non-goals in §4 are load-bearing; re-scope after Phase 3 usage data |

**On question pools specifically:** every part of the platform assumes a response's keys are a subset of a known, fixed field set — the responses table, field analytics, response filters, exports, PDF bindings, and conditional logic all rely on it. Pools break that: two respondents answer different questions, so exports go sparse and per-field analytics get incomparable denominators. If pools are built, the minimum viable shape is a **pool page** that draws N of M from a declared set, with the drawn field ids recorded in `ResponseGrade.integrity`, and analytics that report per-question stats normalized by *exposure count* rather than total responses. Budget it as XL and treat the sparse-export problem as a first-class deliverable, not an afterthought.

### Open questions for the team

1. **Who is the primary user?** Educators (→ prioritize item analysis, gradebook, manual grading) or businesses running training/certification (→ prioritize certificates, attempt limits, pass gating)? The Phase 3/4 ordering flips depending on the answer.
2. ~~**Is quiz mode a paid feature?**~~ **Decided: no — quiz is free on every plan, including `free`.** No entitlement, no quiz usage counter, no `planLimits.ts` change. Graded submissions are already counted by the existing submissions limit, which is the only limit that applies. Revisit only as a deliberate monetization decision; building the gate speculatively would be dead code with a live failure mode.
3. **Do we need multiple endings** in the near term for reasons beyond quizzes? If yes, Phase 5 gets much cheaper and may be worth pulling forward.
4. **Manual grading permissions** — should a `VIEWER` on a form be able to grade? Probably a new `GRADER` capability rather than overloading `EDITOR`, but that's a permission-model change worth deciding early.
5. **Does the AI form builder generate answer keys?** Replacing the `PROPOSE_CREATE_PLUGIN` quiz branch with a native `setFieldGrading` tool would let "make this a quiz about the water cycle" produce a fully keyed quiz in one shot. Strong demo value; needs its own prompt-safety pass since the model would be authoring correctness.

---

## 12. Success metrics

**Adoption** — forms with `settings.quiz.enabled`; graded submissions/week; median questions keyed per quiz.
**Quality** — share of graded responses needing manual review; regrade rate (high = confusing key authoring); count of questions flagged with negative discrimination (proves item analysis is finding real problems).
**Migration health** — % of plugin instances migrated cleanly; count of unmatched `fieldId`s (this number *is* the measure of how badly limitation #5 was hurting people).
**Differentiation** — quiz analytics tab views per quiz owner; certificates issued.

---

## Sources

- [Create & grade quizzes with Google Forms — Google Docs Editors Help](https://support.google.com/docs/answer/7032287?hl=en)
- [Set up quiz grading options — Google Forms API](https://developers.google.com/workspace/forms/api/guides/setup-grading)
- [Create a quiz with Google Forms — Google Workspace Learning Center](https://support.google.com/a/users/answer/13344425?hl=en)
- [Google Forms Quiz Settings Explained: Answer Key, Points, Feedback, and Grading — Formswrite](https://formswrite.com/blog/where-is-the-answer-key-on-google-forms)
- [Google Forms vs Microsoft Forms: Which Is Better in 2026? — Paperform](https://paperform.co/form-builders/google-forms-vs-microsoft-forms/)
- [Microsoft Forms vs Google Forms — Coursebox AI](https://www.coursebox.ai/blog/microsoft-forms-vs-google-forms)
- [Google Forms Time Limit Per Question: Section Timers and Auto-Submit — Qualtir](https://qualtir.com/blog/google-forms-time-limit-per-question)
- [Using Google Forms as a randomised question bank — Google Docs Editors Community](https://support.google.com/docs/thread/251535384/using-google-forms-as-a-randomised-question-bank-for-quizzes?hl=en)
- [Quiz and scoring: Outcome quiz vs Score quiz — Typeform Help Center](https://help.typeform.com/hc/en-us/articles/19027676820884-Quiz-and-scoring-what-s-the-difference-between-Outcome-quiz-and-Score-quiz)
- [Build a quiz with multiple scores — Typeform Help Center](https://help.typeform.com/hc/en-us/articles/4410816726804-Build-a-quiz-with-multiple-scores)
- [Intuitive Exam Settings — ClassMarker](https://www.classmarker.com/online-testing/how-to-create-online-quiz/essentials/)
- [The best quiz maker for business in 2026 — ClassMarker Blog](https://www.classmarker.com/online-testing/blog/The-best-quiz-maker-for-business-in-2026)
- [Item analysis: the impact of distractor efficiency on the difficulty index and discrimination power of multiple-choice items — BMC Medical Education](https://link.springer.com/article/10.1186/s12909-024-05433-y)
- [Understanding Multiple Choice Test Item Analysis Report — Conestoga Faculty Learning Hub](https://tlconestoga.ca/understanding-multiple-choice-test-item-analysis-report-from-datalink/)
