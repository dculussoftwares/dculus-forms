# Native Quiz — Follow-up Coding-Agent Prompts (D9)

Two copy-paste prompts, one per ticket, for the post-ship follow-up to Epic [#289](https://github.com/dculussoftwares/dculus-forms/issues/289) (Native Quiz). Stories 01-15 (#290-#304) are all merged and live; this file covers **Story 16** ([#320](https://github.com/dculussoftwares/dculus-forms/issues/320)) and **Story 17** ([#321](https://github.com/dculussoftwares/dculus-forms/issues/321)), added under decision **D9** in the epic body. Design rationale: [`docs/native-quiz-strategy.md`](./native-quiz-strategy.md); original 15 prompts: [`docs/native-quiz-agent-prompts.md`](./native-quiz-agent-prompts.md).

## The gap this closes

`gradeRelease: 'afterReview'` / `'scheduled'` was shipped in Story 06/12, but nothing was ever built to let a respondent retrieve a grade once it *is* released. `FormResponse.grade` is computed once, inline, inside `submitResponse` and never recomputed; the only other read path (`FormResponse.responseGrade`) requires form `VIEWER+` permission, which a respondent never has. A deferred grade was — and until #320 ships, still is — permanently unreachable by the person who earned it.

**Execution order**: #321 → #320, or run them in parallel — there is no hard dependency either direction. #321 is the smaller guardrail (stops new forms from being saved with an unreachable-by-design release policy); #320 is the actual retrieval feature (lets a respondent on an already-correctly-configured, identity-gated form get their score back). Landing #321 first just means fewer forms get into the broken state while #320 is in flight — it is not required.

**One ordering rule that IS load-bearing:** neither ticket may build a second implementation of the release/visibility policy. Both must call `gradingService.toRespondentView` (Story 03/06's existing function) — never hand-roll a second projection. That was exactly the D5 mistake the epic already called out once for `formSchemaPublic`, and this follow-up must not repeat it for `myQuizResult`.

---

## Applies to both prompts

- **The additive guarantee still applies.** A form with `settings.quiz` absent or `enabled: false` must be completely unaffected by both tickets — no new query result, no new UI, no new validation.
- **Quiz is still a FREE feature** (D8). Nothing here touches `planLimits.ts` or `chargebeeService.ts`.
- **i18n is mandatory** for `form-app` and `form-viewer`: `en` **and** `ta`, registered per the existing locale conventions.
- **Gates**: `pnpm --filter backend exec tsc --noEmit`, `pnpm type-check`, `pnpm test:unit` must pass.
- **Working in a worktree?** Run `./scripts/setup-worktree.sh` first.
- **This repo is public.** Never stage `.env` files, keys, or credentials.

---

## 1 · Issue #320 — Respondent quiz-result retrieval for identity-gated forms

```text
Implement GitHub issue #320 of this repo (run: gh issue view 320 — follow it as the spec).
Context first: read the epic (gh issue view 289), decision D9. Stories 01, 03, 06 and 10 (#290, #292,
#295, #299) must already be merged (they are — this is a post-ship follow-up). No dependency on #321.

Background: FormResponse.grade is only ever computed once, inline, inside submitResponse — there is no
resolver for it, so nothing lets a respondent re-fetch it later. The only other read path,
FormResponse.responseGrade, requires form VIEWER+ permission (resolvers/responses.ts:911) — a
respondent does not have that. Today a deferred grade (gradeRelease: afterReview/scheduled) is
permanently unreachable.

The fix reuses identity that ALREADY EXISTS: forms with accessControl.enabled or collectRespondentEmail
already put respondents through a real sign-in (apps/form-viewer/src/lib/auth-client.ts, SignInGate),
persist the session token in localStorage on purpose so respondents "stay signed in across days and
tabs" (apps/form-viewer/src/lib/respondentAuth.ts), and already stamp respondentUserId onto the
Response row at submit time (resolvers/responses.ts:345-346), gated by the same
`requiresIdentity = !!accessControl?.enabled || !!collectRespondentEmail` expression used in
resolveAccessStatus (apps/backend/src/lib/accessControlEnforcement.ts). Nothing today reads that column
back — build that read path. No new auth system, no tokens, no email delivery.

Backend: add `myQuizResult(formId: ID!): ResponseGradeView` to schema.ts + a resolver in
resolvers/responses.ts. Only `requireAuth` — deliberately NO form-permission check, since this answers
"is this your own submission", not "do you manage this form". Return null if
form.settings?.quiz?.enabled is not true. Find Response rows where formId matches AND
respondentUserId === context.auth.user.id; none found -> null (not an error); more than one -> use the
most recent by submittedAt (v1 limitation, document it). Project the grade through
gradingService.toRespondentView — the SAME function Story 06 already uses in submitResponse. Do not
hand-roll a second release/visibility projection; that was exactly the D5 mistake the epic already
flagged once for formSchemaPublic.

form-viewer: add a "check your result" entry point. On the immediate post-submit screen, when
gradeRelease !== 'immediate' and the submission was identity-gated, show a persistent link to a results
route (investigate apps/form-viewer/src routing first — mirror the existing /f/:shortUrl | :shortUrl
dual-route pattern rather than inventing a new one). That route runs the existing SignInGate if needed,
calls myQuizResult(formId), and renders one of: not-submitted-yet, submitted-but-pending (reuse Story
10's neutral copy), or released (reuse QuizResultScreen from packages/ui — do not build a second result
UI). Add i18n strings (en + ta).

TESTS: different signed-in user never sees another respondent's grade; querying a form you never
submitted returns null, not an error; unauthenticated query is rejected; a form WITHOUT identity capture
returns null/no-match (respondentUserId is always null there) rather than accidentally matching an
unrelated response. Additive guarantee: a non-quiz form's query returns null immediately, no extra
queries, no new UI.

Run `pnpm --filter backend exec tsc --noEmit`, `pnpm type-check`, `pnpm test:unit`.

When done: branch feat/quiz-respondent-result-retrieval, commit (no secrets staged), push, open a PR
titled "Native Quiz: respondent result retrieval for identity-gated forms" with body "Closes #320".
```

## 2 · Issue #321 — Restrict deferred grade release to identity-gated forms

```text
Implement GitHub issue #321 of this repo (run: gh issue view 321 — follow it as the spec).
Context first: read the epic (gh issue view 289), decision D9. No dependency on #320 — independent,
can run in parallel or first.

Background: gradeRelease only controls what the RESPONDENT sees — the owner-side grading queue,
responseGrade resolver and export are already driven purely by GradeStatus and have zero gradeRelease
check (resolvers/responses.ts:911 only checks form permission). So on a form without
accessControl.enabled or collectRespondentEmail, 'afterReview'/'scheduled' can never be fulfilled for
anyone — there's no respondentUserId to look anything up by, even with #320 (respondent result
retrieval) shipped. Today the builder silently allows this broken combination.

Reuse the existing `requiresIdentity = !!accessControl?.enabled || !!collectRespondentEmail` expression
(already inline at resolvers/responses.ts:285, conceptually duplicated inside resolveAccessStatus in
apps/backend/src/lib/accessControlEnforcement.ts) — export it as a named helper from
accessControlEnforcement.ts instead of copy-pasting a third version.

Backend: resolvers/forms.ts already raises a validation error for invalid quiz settings ("Invalid quiz
settings: check the pass threshold, grade release, and (if scheduled) releaseAt" — around lines 275 and
524-533, both create and update paths). Extend that same check to also reject
`quiz.enabled && (gradeRelease === 'afterReview' || gradeRelease === 'scheduled') && !requiresIdentity`.
Keep this at the resolver level (it needs both quiz AND accessControl/collectRespondentEmail together) —
do not try to cram it into sanitizeQuizSettings in packages/types, which only sees the quiz slice alone.

Frontend: in apps/form-app/src/components/form-settings/QuizSettings.tsx, when requiresIdentity is
false for the current form, DISABLE (not hide) the afterReview/scheduled radio options with an inline
explanation, and either block turning identity capture off while one is selected or auto-downgrade
gradeRelease to 'immediate' with a toast — pick one and test it. Apply the same restriction in the quiz
step of apps/form-app/src/pages/CreateFormWizard.tsx (check what access-control affordances the wizard
already has before deciding how). Add i18n strings in en + ta, registered in
apps/form-app/src/locales/index.ts.

TESTS: server rejects the invalid combination from both create and update paths; the valid combination
(identity on) still saves fine; the settings-panel radios disable/enable live as identity capture is
toggled, no reload needed. Additive guarantee: a non-quiz form is completely unaffected — no new
validation runs, no new UI. Do NOT backfill or touch already-saved forms with the old, now-invalid
combination — this only gates new saves.

Run `pnpm --filter backend exec tsc --noEmit`, `pnpm type-check`, `pnpm test:unit`.

When done: branch feat/quiz-release-identity-guard, commit (no secrets staged), push, open a PR titled
"Native Quiz: restrict deferred grade release to identity-gated forms" with body "Closes #321".
```
