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
- [ ] Task 2: Frontend dual-format instant parser
- [ ] Task 3: Backend enforcement — dual-format parsing
- [ ] Task 4: Submission Limits UI — date + time inputs
- [ ] Task 5: Local-timezone hint translation strings
- [ ] Task 6: Manual verification (checklist, no commit)

Task 1: complete (commits 44b7fa95..ca080c87, review clean — Minor: unrelated S3_KEY_PATTERN regex escape cleanup bundled in, verified no-op, not blocking)
