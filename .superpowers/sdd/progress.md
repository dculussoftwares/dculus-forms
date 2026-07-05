# Submission Limits Time Window — SDD Progress Ledger

Plan: docs/superpowers/plans/2026-07-05-submission-limits-time-window-datetime.md
Worktree branch: worktree-submission-limits-time-window

## Pre-flight decisions (human-approved, 2026-07-05)
- Task 2's duplication of the 3-line local-midnight parse (instead of importing
  `parseLocalDate` from `@dculus/utils`) is intentional — form-app's Jest config
  cannot execute `@dculus/utils`'s compiled ESM dist output (pre-existing on
  `main`, unrelated to this feature). If a task reviewer flags this as
  duplication, the ruling stands: keep it, do not "fix" by importing.
- Task 1 (move formatTimeForInput/combineDateAndTime into @dculus/utils) has no
  new automated test — no test harness exists for packages/ui or packages/utils
  today, and this is a behavior-identical move. If a task reviewer flags missing
  test coverage for this task, the ruling stands: verify via build/type-check
  only, do not add a new test harness.

## Tasks
- [x] Task 1: Move formatTimeForInput/combineDateAndTime into @dculus/utils
- [x] Task 2: Frontend dual-format instant parser
- [x] Task 3: Backend enforcement — dual-format parsing
- [x] Task 4: Submission Limits UI — date + time inputs
- [x] Task 5: Local-timezone hint translation strings
- [ ] Task 6: Manual verification (checklist, no commit)

Task 1: complete (commits 44b7fa95..ca080c87, review clean — Minor: unrelated S3_KEY_PATTERN regex escape cleanup bundled in, verified no-op, not blocking)

Task 2: complete (commits b422e9fe..45f5df36, review clean — Minor: JSDoc in timeWindowDateTime.ts:14 references brief's "step" prose, doc-polish only, deferred to final review)

Task 3: complete (commits 34d0dc19..c638829d, review clean — Minor: LEGACY_DATE_ONLY_RE recreated per-request (trivial hoist opportunity), no mirrored malformed-end test; deferred to final review)

Task 4: complete (commits 0866d501..b7eba2ed, review clean — notes for Task 6 manual verification: check clear-then-re-pick-start-date time-of-day carryover behavior, and check date+time input layout on narrow viewports)

Task 5: complete (commits 653992c8..f8ad16b5, review clean)
