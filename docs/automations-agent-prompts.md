# Form Automations — Coding-Agent Prompts

One copy-paste prompt per ticket of Epic [#191](https://github.com/dculussoftwares/dculus-forms/issues/191) (Form Automations). Run them **in order** — each prompt assumes its dependency PRs are merged into `main`.

**Execution order**: #202 → #192 ∥ #193 → #194 → #195 → #196 → #197 → #198 ∥ #199 → #200 → #201
(∥ = can run in parallel.)

Every prompt below already instructs the agent to: read the GitHub issue + epic, read `docs/automations-strategy.md`, work on a feature branch, and open a PR. After each PR merges, tick the matching checkbox in epic #191.

---

## 1 · Issue #202 — Prisma models + migration

```text
Implement GitHub issue #202 of this repo (run: gh issue view 202 — follow it as the spec).
Context first: read the epic body (gh issue view 191) for locked architecture decisions and
docs/automations-strategy.md §4 (data model ER diagram).

Task: add the Automation, AutomationRun, AutomationStepRun models to
apps/backend/prisma/schema.prisma exactly as specified in the issue, plus the
`automations Automation[]` relation on Form. Follow the naming/@@map/index style of the
existing FormPlugin/PluginDelivery models.

Mandatory repo conventions:
- Committed migration in apps/backend/prisma/migrations/<timestamp>_add_automation_models/
  with CREATE TABLE IF NOT EXISTS guards (deploys run db:migrate:deploy; dev DBs may already
  have tables via db push).
- Run pnpm db:generate and pnpm db:push locally.

Verify: pnpm db:generate succeeds, pnpm type-check passes, migration SQL applies cleanly.
Scope: models + migration only — no engine/resolver code.

When done: create branch feat/automations-prisma-models, commit (no .env/secrets staged),
push, and open a PR titled "Automations: Prisma models + migration" with body "Closes #202".
```

## 2 · Issue #192 — pg-boss engine + node executors

```text
Implement GitHub issue #192 of this repo (run: gh issue view 192 — follow it as the spec).
Context first: read the epic body (gh issue view 191) and docs/automations-strategy.md
(§3 diagrams, §6 engine design — queue shape, idempotency, retry and state-machine rules).
Requires issue #202 merged (Prisma models present).

Task: add pg-boss and build the automation engine per the issue:
- apps/backend/src/services/automation/boss.ts — getBoss() singleton on the DIRECT_URL
  connection (pg-boss is incompatible with PgBouncer transaction pooling), schema 'pgboss',
  started/stopped from apps/backend/src/index.ts.
- apps/backend/src/services/automation/engine.ts — worker for queue 'automation-step',
  jobs { runId, nodeId }: delay nodes (startAfter, 30-day cap), action nodes (call
  getPluginHandler(actionType) from plugins/core/registry.ts with FormPlugin-shaped config,
  substituteMentions from @dculus/utils, Automation still ACTIVE check), condition nodes
  (stub evaluateCondition interface if #193 not merged), end nodes; AutomationStepRun logging;
  retryLimit 3 with backoff; singletonKey + SUCCESS-step idempotency check; Sentry capture
  mirroring plugins/core/executor.ts; export enqueueFirstStep(run).

Verify: vitest unit tests per the issue's acceptance list (mock pg-boss + prisma following
apps/backend/src/plugins/core/__tests__ patterns); pnpm type-check, pnpm lint,
pnpm test:unit all pass; backend boots without DIRECT_URL by logging + disabling the engine.

When done: branch feat/automations-engine, PR "Automations: pg-boss engine + node executors",
body "Closes #192".
```

## 3 · Issue #193 — Condition evaluator + graph validator

```text
Implement GitHub issue #193 of this repo (run: gh issue view 193 — follow it as the spec).
Context first: read the epic body (gh issue view 191) and docs/automations-strategy.md §5–6.
Requires issue #202 merged. Can run in parallel with #192.

Task: two pure modules under apps/backend/src/services/automation/:
1. conditionEvaluator.ts — evaluateCondition(rules, combinator, responseData): boolean,
   reusing the EXACT semantics of the 22 operators in
   apps/backend/src/services/responseFilterService.ts. Preferred: refactor the per-value
   comparison logic into one shared pure function both call; otherwise add a parity test
   matrix comparing both implementations.
2. graphValidator.ts — validateAutomationGraph(graph, { pluginTypes }) with zod, enforcing
   every rule in the issue (single trigger, DAG, no orphans, condition handles, delay caps,
   registered actionType + per-type config schemas for email/webhook/slack, stable error
   codes like GRAPH_CYCLE / MISSING_TRIGGER / INVALID_ACTION_CONFIG).

Verify: vitest covers every operator (null/array/date edge cases), both combinators, and one
fixture per validator error code; existing responseFilterService tests still pass;
pnpm type-check, pnpm lint, pnpm test:unit pass.

When done: branch feat/automations-evaluator-validator, PR "Automations: condition evaluator
+ graph validator", body "Closes #193".
```

## 4 · Issue #194 — Trigger service (form.submitted tap-in)

```text
Implement GitHub issue #194 of this repo (run: gh issue view 194 — follow it as the spec).
Context first: read the epic body (gh issue view 191) and docs/automations-strategy.md §6.2.
Requires issues #202 and #192 merged.

Task: apps/backend/src/services/automation/triggerService.ts with
initializeAutomationTriggers(): subscribe to getEventEmitter() from
apps/backend/src/plugins/core/events.ts on 'plugin:event' for form.submitted (do NOT touch
the existing plugin executor listener); for each ACTIVE matching automation create an
AutomationRun (graphSnapshot, automationVersion, context = trigger payload) and call
enqueueFirstStep. All async + try/caught — errors to pino logger + Sentry, never thrown into
the emitter. Skip isPreview submissions (extend the emitFormSubmitted payload in
apps/backend/src/graphql/resolvers/responses.ts if the flag isn't carried yet). Export
cancelRunsForAutomation(automationId, reason). Initialize from index.ts next to
initializePluginEvents().

Verify: vitest per the issue's acceptance list; existing plugins/core tests unaffected; one
cucumber integration test (test/integration) proving a submission drives a single-action
automation run to COMPLETED; pnpm type-check, pnpm lint, pnpm test:unit pass.

When done: branch feat/automations-trigger-service, PR "Automations: trigger service",
body "Closes #194".
```

## 5 · Issue #195 — GraphQL resolver

```text
Implement GitHub issue #195 of this repo (run: gh issue view 195 — follow it as the spec).
Context first: read the epic body (gh issue view 191) and docs/automations-strategy.md §7.
Requires issues #202 and #193 merged; #194 should be merged too (cancellation hooks).

Task: automations GraphQL API following apps/backend/src/graphql/resolvers/plugins.ts
conventions — schema types + queries (formAutomations, automation, automationRuns,
automationRun) and mutations (createAutomation, updateAutomation with version bump,
setAutomationStatus with validateAutomationGraph gate, deleteAutomation cancelling runs,
testAutomation with fast-forwarded delays, cancelAutomationRun) exactly as the issue
specifies. Auth on every resolver: requireAuth + requireOrganizationMembership + form
permission (EDITOR/OWNER for mutations, VIEWER+ for queries). Add AUTOMATION_NOT_FOUND and
AUTOMATION_INVALID_GRAPH to GRAPHQL_ERROR_CODES in packages/types (validation errors in
extensions.validationErrors). Register the module in graphql/resolvers.ts.

Verify: vitest permission matrix + activation-blocked + version-bump + delete-cancels tests;
cucumber integration CRUD lifecycle; pnpm type-check, pnpm lint, pnpm test:unit pass.

When done: branch feat/automations-graphql, PR "Automations: GraphQL resolver",
body "Closes #195".
```

## 6 · Issue #196 — List page, routing, nav + i18n

```text
Implement GitHub issue #196 of this repo (run: gh issue view 196 — follow it as the spec).
Context first: read the epic body (gh issue view 191) and docs/automations-strategy.md §8.
Requires issue #195 merged (GraphQL API). Frontend only (apps/form-app).

Task: Automations list page + routing + nav per the issue: routes matching the existing
form-dashboard path pattern (verify how Plugins/Responses routes are declared in
App.tsx and mirror them), "Automations" nav entry beside Plugins, Automations.tsx list page
(cards with status badges, create dialog -> createAutomation -> navigate to builder-shell
route, rename/activate/pause/delete with confirm), Apollo documents following
Plugins.tsx patterns, VIEWER read-only via useFormPermissions.

Mandatory: every string through useTranslation('automations') with BOTH
locales/en/automations.json and locales/ta/automations.json registered in locales/index.ts
(enTranslations AND taTranslations) — hardcoded strings fail review. Components only from
@dculus/ui, toasts via toastSuccess/toastError, icon-in-card pattern per CLAUDE.md.

Verify manually against a running backend (pnpm dev) — list/create/rename/activate/pause/
delete round-trip; pnpm type-check and pnpm lint pass.

When done: branch feat/automations-list-page, PR "Automations: list page + routing + i18n",
body "Closes #196".
```

## 7 · Issue #197 — React Flow builder canvas

```text
Implement GitHub issue #197 of this repo (run: gh issue view 197 — follow it as the spec).
Context first: read the epic body (gh issue view 191), docs/automations-strategy.md §8, and
the Typeform reference screenshots in the screenshot/ folder — match that look and UX.
Requires issue #196 merged. Frontend only (apps/form-app).

Task: the visual builder per the issue: add @xyflow/react (React Flow v12) + @dagrejs/dagre;
components/automations/builder/ with AutomationCanvas (controlled nodes/edges from a new
zustand automationBuilderSlice, dagre TB auto-layout after every change, nodes not
draggable), custom TriggerNode/DelayNode/ActionNode/EndNode cards, AddStepEdge with a `+`
button opening a Rules/Actions popover (actions from the @dculus/plugins manifests: email,
webhook, slack, google-sheets, microsoft-sheets; Condition disabled "coming soon"),
NodeConfigPanel reusing the existing plugin dialog form bodies (EXTRACT the inner forms from
components/plugins/dialogs/* into shared components — keep the Plugins page dialogs working;
config shape must equal FormPlugin.config), Save + Activate header mapping
AUTOMATION_INVALID_GRAPH extensions.validationErrors to per-node red outlines/tooltips.
Full i18n en + ta in the automations namespace.

Verify: create -> add delay + email action -> configure -> Save -> Activate round-trips and
survives reload; invalid config shows node badges; VIEWER gets a read-only canvas;
pnpm type-check and pnpm lint pass.

When done: branch feat/automations-builder-canvas, PR "Automations: React Flow builder
canvas", body "Closes #197".
```

## 8 · Issue #198 — Run history UI + test mode

```text
Implement GitHub issue #198 of this repo (run: gh issue view 198 — follow it as the spec).
Context first: read the epic body (gh issue view 191) and docs/automations-strategy.md §8.
Requires issues #195 and #196 merged (#197 helpful, not required). Frontend only.

Task: runs view (table of automationRuns with status badges, response link, duration,
pagination, refresh while RUNNING/WAITING), run-detail step timeline styled after
components/plugins/shared/PluginDeliveryLog.tsx (expandable output/error JSON), Cancel run
(EDITOR+, confirm), and a "Test automation" button calling the testAutomation mutation and
opening the created run live (Test chip, fast-forwarded delays; disabled with tooltip when
the form has no responses). Full i18n en + ta; @dculus/ui components; toasts on
cancel/test.

Verify: with a seeded automation + submissions the list and drill-down render real engine
data; VIEWER can view but not cancel/test; pnpm type-check and pnpm lint pass.

When done: branch feat/automations-run-history, PR "Automations: run history + test mode",
body "Closes #198".
```

## 9 · Issue #199 — E2E happy path

```text
Implement GitHub issue #199 of this repo (run: gh issue view 199 — follow it as the spec).
Requires issues #197 and #194 merged (builder + trigger wiring live).

Before writing anything, analyze the existing E2E infrastructure — test/e2e configs,
world/hooks, step-definition style, tag conventions, and the CI wiring in
.github/workflows/ — and follow those patterns exactly. Do not break existing scenarios.

Task: a @automations-tagged Playwright + Cucumber scenario per the issue: sign in (existing
auth steps), create a form, build + activate a webhook-action automation in the builder
(negative check: Activate blocked while unconfigured), submit via the public form-viewer
URL, then assert the run reaches COMPLETED with SUCCESS steps in the runs view (generous
polling timeout). Ensure the E2E backend bootstrap sets DIRECT_URL so the engine runs —
adjust test env config if needed and document it in the PR. Respect test-credential env
conventions (no hardcoding); add data-testid attributes only if the suite's convention
allows.

Verify: pnpm test:e2e -- --tags "@automations" passes locally AND the full existing suite
still passes; wire the tag into CI if suites are tag-partitioned.

When done: branch feat/automations-e2e, PR "Automations: E2E linear happy path",
body "Closes #199".
```

## 10 · Issue #200 — Condition node builder UI

```text
Implement GitHub issue #200 of this repo (run: gh issue view 200 — follow it as the spec).
Context first: read the epic body (gh issue view 191) and docs/automations-strategy.md.
Requires issues #193 and #197 merged (evaluator/validator + canvas; engine routing from
#192 already supports condition edges).

Task: end-to-end if/else branching per the issue: enable "Condition" in the + popover;
ConditionNode with true/false source handles and labeled Yes/No branch edges (inserting on
an edge attaches the previous successor to the true branch, false branch goes to End);
config panel with rule rows — field picker from the form schema, operator dropdown filtered
by field type the same way the Responses filter UI does it, type-appropriate value inputs,
AND/OR toggle — persisting { rules, combinator } exactly as evaluateCondition consumes;
dagre fan-out/fan-in layout; documented branch-keep convention on delete; server validation
codes surfaced on nodes; i18n en + ta including operator display names.

Verify: trigger -> condition -> (true: email / false: end) builds, saves, activates, and
matching vs non-matching submissions route down the correct branch (check the condition
step output in run history); builder-slice unit tests for insert/delete/reconnect;
pnpm type-check, pnpm lint, pnpm test:unit pass.

When done: branch feat/automations-condition-node, PR "Automations: condition node UI",
body "Closes #200".
```

## 11 · Issue #201 — response.edited + scheduled triggers

```text
Implement GitHub issue #201 of this repo (run: gh issue view 201 — follow it as the spec).
Context first: read the epic body (gh issue view 191) and docs/automations-strategy.md §6.
Requires issues #194 and #195 merged (#196 for the UI touchpoints).

Task per the issue:
1. response.edited — emit on the shared plugin emitter from the response-update path that
   already invokes responseEditTrackingService (find it in graphql/resolvers/responses.ts);
   extend the PluginEvent type union; prove existing plugins are unaffected (they declare
   their events); trigger service handles it like form.submitted; loop guard via
   sourceRunId suppression.
2. schedule — triggerConfig { cron, timezone }; validate cron server-side on save/activate;
   boss.schedule with per-automation name automation-cron:{id} (upsert = multi-instance
   safe), boss.unschedule on pause/delete; cron worker re-checks ACTIVE then creates a run
   with responseId null; extend graphValidator to reject response-dependent actions on
   scheduled automations (add triggerType input).
3. UI — trigger-type picker gains "Response edited" and "Schedule" with cron presets
   (daily/weekly/monthly + custom) and human-readable cron on the TriggerNode; i18n en + ta.

Verify: vitest for emission/matching/loop-suppression/schedule-lifecycle/validator rules;
integration test that editing a response fires a run; existing plugin behavior unchanged;
pnpm type-check, pnpm lint, pnpm test:unit pass.

When done: branch feat/automations-more-triggers, PR "Automations: response.edited +
scheduled triggers", body "Closes #201".
```

---

## After each PR merges

1. Tick the ticket's checkbox in epic #191 (`gh issue edit 191` or the GitHub UI).
2. Pull `main` and run `pnpm db:generate && pnpm db:push` if the PR touched `schema.prisma`.
3. Start the next prompt in the order listed at the top.
