---
description: "Add a new form field type to the dculus-forms application"
mode: "agent"
---

# Add New Form Field Type

Adding a field type touches more than 100 places across `@dculus/types`, `@dculus/utils`, `@dculus/ui`, the form builder, the form viewer and the backend. Only two of them fail to compile when you miss them. The rest fail silently: the field vanishes on reload, its answers are dropped on submit, its settings are erased by a reorder, or the analytics page breaks.

Don't follow a shortened recipe. Follow the **`new-field-generator`** agent in [`.claude/agents/new-field-generator.md`](../../.claude/agents/new-field-generator.md). It holds the verified per-file checklist, the traps and the verification steps.

If the user hasn't described the field yet, ask which field to add. Then follow the agent's workflow:

1. **Recon.** Read the agent file and study the closest reference implementation: `git show --stat d2d30ef2` (Rating) or `git show --stat dc54330c` (Phone Number).
2. **Trait sheet.** Decide every trait:
   - kind: fillable, display or layout;
   - answer value shape, custom props and validation;
   - conditions, quiz and analytics;
   - filters and display formatting;
   - AI, templates, palette entry and PDF binding;
   - any new dependencies.
3. **Plan.** Mark every checkpoint "do" or "skip", with a reason.
4. **Gate.** Wait for approval before editing any file.
5. **Implement** in dependency order: types → utils → ui → backend → form-viewer → form-app → i18n (`en` + `ta`) → tests → docs.
6. **Verify:**
   - Rebuild the shared packages.
   - Run each package's tests. CI doesn't run form-app's jest suite, so run it yourself.
   - Keep the five golden snapshot suites unchanged.
   - Run the parity scan against Rating and Phone.
7. **Report:** changes, skipped checkpoints, rollout order and hand-offs (`e2e-test-writer` for E2E tests).
