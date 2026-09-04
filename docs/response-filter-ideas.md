# Response Filter Ideas — Beyond Form Fields

Applies to: Responses table, Automations (condition rules / digest filters), PDF Generator filters — all consume `ResponseFilter[]` via `responseFilterService.ts` / `responseQueryBuilder.ts`.

Legend: **P0** = do first (high value, low effort) · **P1** = next · **P2** = nice to have · **P3** = low priority / speculative

Fill in `Pick: [ ]` → `[x]` as you decide.

---

## A. Already built in the backend, not yet in any UI

### 1. Native Quiz grade filters
**Priority: P0**
Pick: [X ]

- Score / percentage (`ResponseGrade.percentage`, SQL-indexed)
- Passed / failed (`ResponseGrade.passed`)
- Grading status: `AUTO_GRADED` / `NEEDS_REVIEW` / `REVIEWED` / `RELEASED`
- Attempt number (`ResponseGrade.attemptNumber`, for retakes)

Why P0: filter operators (`__gradePercentage`, `__gradePassed`, `__gradeStatus`) and SQL JOIN are already implemented and tested in `responseFilterService.ts` / `responseQueryBuilder.ts`. Zero backend work — just wire into `FilterRow.tsx`, `ConditionRulesEditor.tsx`, `DigestFiltersEditor.tsx`, and PDF generator filter UI. Only applies to quiz-type forms (needs a "is this a quiz form" check to conditionally show).

---

## B. Submission analytics (`FormSubmissionAnalytics`, 1:1 with each Response)

### 2. Completion time
**Priority: P1**
Pick: [x ]

- `completionTimeSeconds` — e.g. "took longer than 5 min" / "under 10 sec" (rushed/bot heuristic)

### 3. Device / browser / OS
**Priority: P2**
Pick: [x ]

- `operatingSystem`, `browser` — isolate a broken-browser cohort

### 4. Geography
**Priority: P2**
Pick: [ x]

- `countryCode`/`countryAlpha2`, `region`, `city`

### 5. Language / locale
**Priority: P3**
Pick: [ ]

- `language` (e.g. `en-US`, `ta-IN`)

### 6. Timezone
**Priority: P3**
Pick: [ ]

- `timezone` (IANA)

### 7. Embed source
**Priority: P2**
Pick: [ ]

- `embedContext` (direct/inline/lightbox/iframe), `embedHost` — "came from embed on domain X" vs. direct link

Why B is lower than A: mostly duplicates what `FormAnalytics` charts already visualize; value here is being able to *segment the response list itself* by these dimensions, not just view aggregate charts.

---

## C. Response identity / lifecycle (on `Response` itself)

### 8. Respondent identity
**Priority: P1**
Pick: [ x]

- `respondentUserId` is/isn't null → anonymous vs. authenticated respondent
- `respondentEmail` — exact match / contains (account-gated forms)

### 9. Soft-delete state
**Priority: P3**
Pick: [ ]

- `deletedAt` — trashed vs. active (only relevant if/when Responses table gets a trash view)

---

## D. Edit history (`ResponseEditHistory` / `ResponseFieldChange`)

### 10. Was edited at all
**Priority: P1**
Pick: [ ]

- Has any `ResponseEditHistory` row — surfaces manually-corrected submissions

### 11. Edit count
**Priority: P2**
Pick: [ ]

- `totalChanges`, or count of edit-history rows — "edited more than once"

### 12. Edit type
**Priority: P2**
Pick: [ ]

- `MANUAL` / `SYSTEM` / `BULK`

### 13. Last edited by / at
**Priority: P2**
Pick: [ X]

- `editedById`, `editedAt`

### 14. Specific field was changed
**Priority: P3**
Pick: [ ]

- Join on `ResponseFieldChange.fieldId` — "email field was corrected post-submission" (highest effort of this group — needs a join + per-field picker)

---

## E. Plugin delivery status (`PluginDelivery`)

### 15. Delivery succeeded / failed
**Priority: P1**
Pick: [ ]

- Per plugin (webhook/email), `status = success|failed` — triage view for "which responses failed to deliver"

### 16. Plugin ran vs. skipped
**Priority: P3**
Pick: [ ]

---

## F. PDF generation (`PdfGenerationResult`)

### 17. Has a generated PDF / generation failed
**Priority: P2**
Pick: [ X]

- Per `PdfGenerator` — "show responses missing a generated PDF" (useful for re-run workflows)

---

## G. Automation linkage (`AutomationRun.responseId`)

### 18. Was processed by automation X
**Priority: P2**
Pick: [ ]

- Plus run status (`COMPLETED`/`FAILED`/`WAITING`) — "which responses never triggered my webhook automation"

---

## H. Derived / computed (no schema change — computed at query time)

### 19. Response completeness %
**Priority: P2**
Pick: [ X]

- filled fields ÷ total fillable fields — spot partial/abandoned-feeling submissions

### 20. Has file upload attachment(s)
**Priority: P3**
Pick: [ ]

- For forms with file fields — "only show responses with an attachment"

### 21. Response age bucket
**Priority: P3**
Pick: [ ]

- Sugar over existing `__submittedAt` (last 24h / 7d / 30d) — mostly redundant with `DATE_LAST_N_DAYS` already supported

### 22. Duplicate detection
**Priority: P3**
Pick: [x ]

- Same `respondentEmail` submitted more than once — higher effort (needs a window/count query), edge-case value

---

## Suggested rollout order (if tackling multiple)

1. **Quiz grade filters** (A) — wire existing backend into all 3 UIs
2. **Completion time + respondent identity + "was edited"** (B.2, C.8, D.10) — high-signal triage filters, all single-column reads
3. **Plugin delivery status** (E.15) — operational triage value
4. **Everything else** — pull in as specific use cases come up
