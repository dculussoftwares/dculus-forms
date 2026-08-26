# Automations — Business Flow Gap Analysis

> Review date: 2026-08-26 · **P0 items A–D fixed 2026-08-26** (see each section's Status line) · Scope: `apps/backend/src/services/automation/*`, `automationService.ts`,
> `graphql/resolvers/automations.ts`, `repositories/automationRepository.ts`,
> `apps/form-app/src/{pages,components,store}/**/automation*`, plus the plugin handlers automations call.
> The P1–P3 sections below are analysis only. The four P0 sections record what was found
> *and* what shipped to fix it.

---

## 0. What exists today (baseline)

The engine itself is well built. Durability, crash recovery, and graph-snapshot isolation are
genuinely strong — better than most v1 workflow engines:

- One pg-boss job per node (`singletonKey: runId:nodeId`), delays survive deploys via `startAfter`.
- Every run freezes its own `graphSnapshot`, so editing an automation can't corrupt in-flight runs.
- `reconcileSuccessStep` **verifies** a successor exists rather than assuming it, and replays
  decisions from persisted step output instead of re-deriving them.
- Activation-time graph validation (cycles, orphans, reachable end, delay cap, per-action Zod configs)
  with human-readable, i18n'd error copy.
- Actions *are* plugin handlers — one registry, so every new integration is automatically an action.

The gaps below are almost entirely **above** the engine: the product flow around it — testing,
first-run safety, failure visibility, portability, monetisation, and lifecycle.

**Current surface**: 3 triggers (`form.submitted`, `response.edited`, `schedule`) ·
5 node types (trigger, delay, condition, digest/"Filter Responses", action, end) ·
5 action types offered, 4 of which actually work (Slack has no handler).

---

## Severity summary

| # | Gap | Severity | Area | Status |
|---|---|---|---|---|
| A | You cannot test an automation before going live | **P0** | Flow / UX | ✅ Fixed |
| B | "Test" runs send for real and corrupt the digest window | **P0** | Correctness | ✅ Fixed |
| C | First scheduled tick can email the entire response history | **P0** | Business risk | ✅ Fixed |
| D | Partial delivery failure is recorded as SUCCESS | **P0** | Correctness | ✅ Fixed |
| E | Retries have no idempotency — duplicate sends | P1 | Correctness | Open |
| F | Overlapping / replayed scheduled runs duplicate work | P1 | Correctness | Open |
| G | Nobody is notified when an automation fails | P1 | Trust | Open |
| H | No way to retry or replay a failed run | P1 | Recovery | Open |
| I | Automations are per-form and non-portable (lost on duplicate) | P1 | Growth | Open |
| J | Trigger type is immutable after creation | P2 | UX | Open |
| K | Conditions can't read step outputs, only the trigger response | P2 | Capability | Open |
| L | Action catalog is thin; one entry is a dead end | P2 | Capability | Open |
| M | No plan gating, no run metering, no caps | P2 | Monetisation | Open |
| N | Run history grows forever and stores full PII payloads | P2 | Ops / compliance | Open |
| O | Engine silently disables itself; no operator visibility | P2 | Ops | Open |
| P | Builder & run-history UX friction (8 smaller items) | P3 | UX | Open |

---

## P0 — Fix before this feature gets real usage

### A. You cannot test an automation before going live

**What happens.** Every new automation is created as `DRAFT`
(`automationService.ts:126`). `handleActionNode` refuses to execute unless the automation is
`ACTIVE`, marking the step `SKIPPED` and the run `CANCELLED`:

```ts
// engine.ts:485
if (run.automation.status !== 'ACTIVE') { … status: 'SKIPPED', … run CANCELLED }
```

There is no `context.test` exemption — only delay nodes check it (`engine.ts:278`). So the
intended flow *build → test → activate* is impossible: pressing **Test automation** on a draft
produces a cancelled run with `"Automation is DRAFT, not ACTIVE"` at the first action node.
The unit test for this branch only covers `PAUSED` (`engine.test.ts:657`), so the DRAFT case
was never considered.

The Test button is offered prominently in three places (list card, builder header, runs page)
and is only disabled when the form has **zero responses** — never for status. The user's only
path to verifying anything is to activate the automation against live respondents first.

**Why it matters.** This is the single biggest adoption blocker. Nobody ships an email-sending
workflow they were never allowed to rehearse.

**Status: ✅ fixed.**
1. `handleActionNode` now waives the `ACTIVE` gate when `context.test === true`; the gate is
   untouched for real runs, where it is what stops an in-flight run on pause.
2. Test-mode deliveries are made safe rather than blocked — see B.
3. `testAutomation` no longer demands a response for a `schedule` automation (its data comes from
   the digest node, and graphValidator already bans response-dependent steps there), so the Test
   button is enabled for those even on a form with no submissions.

---

### B. "Test" runs send for real, and corrupt the digest window

Two distinct problems behind one button.

**B1 — Test deliveries are real deliveries.** There is no dry-run anywhere in the action path.
`handleActionNode` calls the live plugin handler with the live config
(`engine.ts:521`). A test run sends real emails to real respondents, POSTs real webhooks, and
appends real rows to the customer's Google Sheet. The `Test` chip in run history
(`AutomationRuns.tsx:186`) is purely cosmetic. The plugin system already has a `plugin.test`
event concept (`plugins/core/events.ts`) — automations don't use it.

**B2 — A test run silently advances the digest watermark.** The digest window anchor is:

```ts
// automationRepository.ts:93 — no test-run exclusion
findFirst({ where: { automationId, status: 'COMPLETED' }, orderBy: { startedAt: 'desc' } })
```

A completed **test** run therefore becomes the anchor. Every response submitted between the last
real run and the test is skipped by the next real tick — permanently, with no error and nothing in
the UI. And because the digest node runs for real in test mode (`handleDigestNode` has no `test`
check), a single click of **Test** on an active weekly-digest automation both blasts the whole
pending batch *and* erases the window it came from.

**Status: ✅ fixed.**
- **B1**: the resolver threads the caller's address into the run context as `testUserEmail`, and
  `applyTestModeConfig` redirects every email action there, prefixes the subject `[Test]`, and
  clears `recipientFieldId`/`sendToSubmitter` — which also collapses a per-response digest batch
  to a single message. With no address available the send is recorded `SKIPPED`, never delivered
  to the configured recipient. Webhook and Sheets actions still execute (they hit the customer's
  own endpoint or spreadsheet, exactly as the standalone Plugins "Test" button already does) but
  now carry `__isTest: true` on `event.data` so a receiver can tell.
- **B2**: the run-derived anchor is gone. `Automation.lastDigestedAt` is an explicit watermark
  advanced only by a clean, non-test `COMPLETED` run, so a test can no longer move it. A test run
  also samples the ten most recent responses rather than draining the pending window.
- Migration `20260826120000_add_automation_digest_watermark` backfills the column from each
  automation's last completed run, so live automations keep their current window.

---

### C. The first scheduled tick can email your entire response history

**What happens.** A digest node's first tick has no lower bound at all:

```ts
// engine.ts:43
const DIGEST_EPOCH_START = new Date(0);
```

The comment explains the reasoning (anchoring on `automation.createdAt` would exclude pre-existing
responses) and it is defensible in the abstract — but combined with the per-response email mode
(`engine.ts:509`, `email/handler.ts` per-response loop), activating a "weekly digest" on a form
that already has 4,000 responses emails **all 4,000 people immediately**, capped only by
`DIGEST_RESPONSE_SAFETY_CEILING = 5000` (`graphValidator.ts:120`) and the org's email quota.

The `maxResponses` control was deliberately removed from the builder UI, so the user has no lever
at all, and nothing in the activation flow states how many responses the first run will touch.

**Why it matters.** This is the classic "we accidentally emailed our entire customer list" incident.
It is silent, irreversible, and one click away.

**Status: ✅ fixed.** The default is now "start from now", which is what "digest" means to a user:
activating a schedule automation that has a digest node seeds `Automation.lastDigestedAt` to that
moment (`automationService.resolveActivationDigestWatermark`), so the first tick covers only what
arrives afterwards. Backfill is still available, but as a deliberate opt-in: a
`includeExistingResponses` checkbox on the digest node, unchecked by default, which leaves the
watermark unset. Ticking it swaps the panel's hint for a warning spelling out that every matching
response will be processed — including, if a step below emails each response, emailing all of them.

The node's existing live match count sits directly above that checkbox, so the number is on screen
when the choice is made. Seeding is set-if-null, so pausing and reactivating never rewinds or skips
a window an already-running automation was working through.

*Correction to the original finding:* the digest panel did already show a live "N responses
currently match these filters" count. It is an all-time count in the node config, not a preview of
the first run in the activation flow — so the blast was still unannounced, but "no preview at all"
overstated it.

---

### D. Partial delivery failure is recorded as SUCCESS

**What happens.** The digest email handler catches per-response failures inside its loop and
**returns** rather than throws:

```ts
// email/handler.ts (digest path)
return { success: false, failedCount, sentCount, skippedCount, error: `${failedCount} of N emails failed…` }
```

`handleActionNode` only treats *thrown* errors as failures (`engine.ts:550`). A returned
`success: false` is stored as the step's `output` but the step is recorded **SUCCESS**
(`engine.ts:529`) and the run **COMPLETED**. Consequences:

- The run history shows a green tick for a batch where 400 of 500 emails failed.
- Because the run completed, the digest watermark advances past those responses — the failures are
  never retried and are now unrecoverable.
- The email-quota-exhausted path (`skipped: true`, `skippedCount: N`) has exactly the same problem:
  responses skipped for quota are permanently skipped, silently.

**Also affects webhooks**, which turned out to be the more common case: `sendWebhook` returns
`{ success: false, statusCode }` for *any* non-2xx without throwing, so a webhook action against a
receiver returning 500 was recorded SUCCESS and never retried.

**Status: ✅ fixed.** `classifyHandlerResult` maps a returned result onto a real step status:

| Result shape | Step status |
|---|---|
| `failedCount > 0`, `sentCount > 0` | `PARTIAL` |
| `failedCount > 0`, nothing sent | `FAILED` (retried like a thrown error) |
| `skippedCount > 0`, nothing sent, or `skipped: true` | `SKIPPED` |
| `success: false` with no counts | `FAILED` (retried) |

A returned `FAILED` now takes the same path as a thrown one, retries included — so a 500 from a
webhook receiver actually gets its three attempts. `PARTIAL` deliberately does not retry: there is
no per-response idempotency to retry against (gap E), so a retry would re-send to everyone the
first attempt reached.

The run itself settles `PARTIAL` rather than `COMPLETED` whenever any step failed, partly
delivered, or skipped a delivery — rendered as an amber "Partly delivered" badge in both the runs
list and the step timeline, with the reason (`"400 of 500 emails failed…"`, `"reached its email
sending limit"`) shown inline instead of buried in the output JSON.

The watermark rule splits on whether anything actually went out. A step that delivered **nothing**
(SKIPPED — no recipient, quota reached) holds the window, so the next tick re-covers it and nothing
is lost; since nothing was sent, nothing can be sent twice. A **partial** batch advances the
window, because re-covering it would re-send to everyone the first attempt reached (there is no
per-response idempotency — gap E). The shortfall is reported loudly rather than silently retried,
which is the honest trade until per-response tracking exists.

Still open from this finding: `sentCount / skippedCount / failedCount` are shown via the step's
output JSON rather than as first-class fields, and quota exhaustion has no upgrade prompt of its
own (it reads as a skipped delivery).

---

## P1 — Correctness and trust

### E. Retries have no idempotency

Action and digest nodes retry 3× with backoff (`engine.ts:33`, `:89`). Nothing makes a handler
retry-safe:

- A webhook that timed out *after* the receiver processed it is re-POSTed, up to 3×. No
  idempotency key is sent.
- A digest email batch that throws mid-loop (e.g. the SMTP connection drops on response 300 of 500)
  restarts from response #1 on retry — the first 300 people get a second email.

The engine's own doc explicitly promises "never re-derive a decision that was already recorded" —
that principle is honoured at the graph level but not *inside* an action.

**Fix.** Pass a stable idempotency key into `PluginContext` (`${runId}:${nodeId}` is already the
synthetic plugin id — reuse it). Webhook handler sends it as `X-Dculus-Idempotency-Key`; the digest
email loop persists per-response progress into the step output and resumes from it on retry.

### F. Overlapping and replayed scheduled runs duplicate work

- **Overlap**: nothing prevents tick *N+1* from starting while tick *N* is still `RUNNING`. A
  3,000-email digest loop easily outlasts a 15-minute cron. Both runs resolve `since` to the same
  last *completed* run, so both process the same window — everyone gets two emails.
- **Failed-run replay**: a `FAILED` run deliberately doesn't advance the window
  (`automationRepository.ts:89`), which is right for "nothing was sent" but wrong for "300 of 500
  were sent then it failed" — the next tick re-sends those 300.

**Fix.** Skip a scheduled tick when an active (`RUNNING`/`WAITING`) run exists for that automation,
and record the skip as a visible run so the user understands the gap. Longer term, a per-response
watermark (`digestedAt`, or a join table) removes the whole class of problem that a run-level
timestamp creates.

### G. Nobody is told when an automation fails

Failures go to `AutomationRun` + Sentry. There is no email, no in-app notification, no failure badge
on the automation card (`AutomationCard.tsx` shows status and updatedAt only), no failure count in
the list query, and no health indicator on the form dashboard. A customer's expired Google OAuth
token means every run fails silently until someone happens to open the runs page.

**Fix.** In order of value:
1. Add `lastRunStatus` + `failedRunCount` to `formAutomations` and badge the card in red.
2. Email the automation owner on the first failure of an active automation (debounced), with a
   deep link to the failed run — the deep-link route already exists (`?runId=`).
3. Auto-pause after N consecutive failures and notify. Every mature iPaaS does this; it prevents a
   broken automation from burning quota and retries for weeks.

### H. No way to retry or replay a failed run

`cancelAutomationRun` is the only run-level mutation. After 3 attempts against a receiver that was
down for an hour, the run is dead forever — the only recovery is to re-submit the response.

**Fix.** `retryAutomationRun(runId)` re-enqueuing the failed node against the existing frozen
snapshot (the snapshot makes this safe and cheap), plus a **Retry** button in `AutomationRunDetail`.
A bulk "retry all failed runs since X" is the natural follow-up for outage recovery.

### I. Automations are per-form and non-portable

- `duplicateForm` (`formService.ts:190`) copies schema, settings, and background assets — **not
  automations**. A customer who builds a 6-step onboarding flow and clones the form for next
  quarter loses all of it, silently.
- There is no "Duplicate automation" action, no copy-to-another-form, and no templates. The create
  dialog (`CreateAutomationDialog.tsx`) offers a name box, a trigger dropdown, and then an empty
  canvas — the highest-friction possible start.
- Automations live only inside one form's builder tab. There is no org-level view answering
  "what automations exist across my 40 forms, and which are failing?"

**Fix**, in value order:
1. **Starter templates** in the create dialog — "Send a confirmation email", "Weekly digest to me",
   "Notify Slack on new response", "Follow up 3 days later if no purchase". This is the cheapest
   activation lever available and needs no engine work.
2. Copy automations in `duplicateForm` as `DRAFT`, stripping externally-bound config
   (`spreadsheetId`, OAuth-derived ids) so a copy can never write into the original's sheet.
3. Duplicate / copy-to-form in the card menu; an org-level automations list.

---

## P2 — Capability, monetisation, and operations

### J. Trigger type is immutable

`createAutomation` takes `triggerType`; `updateAutomation` does not (`automationService.ts:141`).
Choosing "On submission" when you wanted "Schedule" means deleting and rebuilding the entire graph.
Allow changing it while not `ACTIVE`, re-running validation and swapping the default digest node
in/out (`buildDefaultGraph` already knows the schedule shape).

### K. Conditions can only read the trigger response

`handleConditionNode` evaluates against `context.triggerData` only (`engine.ts:332`) even though
every action result is merged into `context.stepOutputs` (`engine.ts:540`). So none of these are
expressible today:

- "If the webhook returned a 4xx, email me."
- "If the AI tagger classified this as *urgent*, notify the team; otherwise wait 2 days."
- "If the digest found 0 new responses, skip the email entirely." *(This one is especially notable —
  a weekly digest currently sends an empty email every week on a quiet form, unless the user
  manually adds a `__digestCount > 0` condition, which nothing prompts them to do.)*

**Fix.** Let condition rules reference `stepOutputs.<nodeId>.<key>`. The evaluator already does flat
key lookups; the work is exposing a curated key list per node type in the field picker.

### L. Action catalog is thin, and one entry is a dead end

Five action types are offered (`actionCatalog.ts:24`), of which **Slack has no backend handler** and
renders permanently disabled with a "coming soon" badge — its Zod config schema is already written
(`graphValidator.ts:177`), so it advertises a capability that cannot be delivered.

There are **no internal actions at all**: nothing that updates a response, adds a tag, assigns to a
teammate, generates a PDF, or notifies someone in-app. Every action leaves the product.

Highest-leverage additions given what already exists in this codebase:

| Action | Why it's cheap here |
|---|---|
| **Slack** (finish it) | Config schema + manifest already exist; only the handler is missing |
| **Notify a teammate / assign** | Org membership + `emailService` already exist |
| **Generate PDF from a PDF Template** | `pdfTemplateService` already does per-response generation |
| **Add tag / update response** | Tags feature already exists; enables triage workflows |
| **AI summarise / classify** | `ai-tagger` handler is registered but excluded from automations |

### M. No plan gating, no run metering, no caps

The strategy doc named run-creation as the billing choke point (§6.3, "Billing (future)"). It was
never wired. Today:

- `handlePluginEvent` and `handleScheduledTick` create runs with **no plan check**.
- There is no `automationRuns` usage counter — `chargebeeService` tracks views, submissions, emails,
  and AI credits only.
- **Only emails are metered.** Webhooks, Sheets writes, and cron ticks are unlimited on every plan,
  free included.
- No cap on automations per form (the strategy doc's own open item #2 proposed ~20), no cap on
  concurrent runs per org, and no per-org fairness on the single shared `automation-step` queue —
  one org's 5,000-response digest delays every other org's confirmation emails.

**Fix.** Meter `automation_runs` at the two run-creation sites; add plan limits (e.g. free: 1
automation / 100 runs; starter: 5 / 10k; advanced: unlimited); cap automations per form; and gate
webhook + Sheets actions to paid plans. Automations are the most obvious upgrade lever in the
product and they are currently free and uncapped.

### N. Run history grows forever, with full PII inside

Every run stores a full `graphSnapshot` plus a `context` containing the entire response payload; a
digest run additionally embeds **up to 5,000 complete responses** in its step output JSON. There is
no archival job, no TTL, no trimming on completion. This is the strategy doc's open item #3, still
open — and it is a GDPR/retention exposure as much as a storage one, since deleting a response does
not remove its copy inside `AutomationRun.context` (there is deliberately no FK).

**Fix.** Nightly cleanup (keep 90 days or the last N runs per automation); trim
`context.triggerData` and `__digestResponses` on terminal runs, keeping only ids; and include
automation runs in the response-deletion path.

### O. The engine silently disables itself

`isAutomationEngineEnabled()` returns false whenever `DIRECT_URL` is unset, and every enqueue
degrades to a log warning (`boss.ts:21`, `engine.ts:77`). In that state the UI still lets a user
build, save, **activate**, and see a green ACTIVE badge — while nothing ever runs and nothing
anywhere says so. Related:

- `/health` reports nothing about the engine, queue depth, or oldest pending job — both were
  promised in the strategy doc (§10) and neither exists. There is no dead-letter monitoring.
- There is **no boot-time reconciliation** between `ACTIVE` schedule automations and pg-boss
  schedules. An automation activated while the engine was down stays `ACTIVE` forever with no cron
  registered — permanently, silently inert.

**Fix.** Expose engine status via GraphQL and show a banner + block activation when disabled;
add queue depth and oldest-pending-job age to `/health`; reconcile ACTIVE schedule automations
against pg-boss schedules on boot.

---

## P3 — Builder and run-history UX friction

1. **Save and Activate are two steps**, and Activate is disabled while dirty
   (`AutomationBuilder.tsx:277`). The reasoning is sound (never activate a stale graph) but the
   result is a confusing two-click ritual. Consider a single **Save & activate** primary action.
2. **No live validation.** Node config errors only surface after a server round-trip on
   Save/Activate; `validation.ts` only maps server errors back to nodes. Run the same Zod schemas
   client-side as the user types.
3. **Deleting a condition node silently discards its entire false branch** by convention
   (`automationBuilderSlice.ts:324`) with no confirmation dialog and no undo — the delete button is
   a bare icon on the node (`ConditionNode.tsx:40`). Add a confirm naming what will be lost.
4. **No undo/redo** anywhere on the canvas.
5. **Runs table has no filtering** — no status filter, no date range, no search by response, no
   export. On a busy automation, finding yesterday's failures means paging 20 at a time.
6. **No reverse link.** Runs link to their response (`AutomationRuns.tsx:193`), but a response has
   no link to the automation runs it triggered. Support answering *"I never got my confirmation
   email"* has to work backwards by timestamp.
7. **Test always uses the latest response.** The `testAutomation` mutation accepts a `responseId`,
   but `useTestAutomation` never passes one. Add a response picker — and a synthetic sample response
   so a brand-new form can be tested at all (today Test is hard-disabled at zero responses).
8. **A digest automation with no matches still runs the whole flow.** With no `__digestCount > 0`
   condition, the weekly email goes out empty. Either default the generated graph to include that
   condition, or short-circuit a zero-count digest to `COMPLETED` with a clear "nothing to send" step.

---

## Suggested sequencing

**~~Ship first~~ Shipped 2026-08-26 (safety)**
~~A (test on DRAFT) → B (dry-run + watermark) → C (first-run choice) → D (partial failure)~~ ✅

**Ship next (trust)**
G (failure notification) — the remaining half of "safe to recommend": failures are now recorded
honestly, but still nobody is *told* about them.

**Then (recovery + growth)**
H (retry) → I (templates + duplicate) → E/F (idempotency + overlap guard) → L (Slack + one internal action)

E is now the sharpest remaining correctness gap, and it is what bounds the D fix: without
per-response idempotency, a partly-delivered digest window has to be written off (advanced and
reported) rather than re-covered, because re-covering would duplicate everything that did arrive.
Per-response tracking would let a partial batch retry exactly the responses that failed.

**Then (business + ops)**
M (metering and plan gating) → N (retention) → O (engine visibility) → K (step-output conditions)

**Backlog**
J, P1–P8, and the strategy doc's own Phase 4 items (approvals / human-in-the-loop, parallel branches).

---

## Notable strengths worth preserving

Called out so a refactor doesn't undo them:

- `reconcileSuccessStep` verifying rather than assuming successor enqueue — a subtle bug class most
  engines get wrong.
- The frozen `graphSnapshot` per run.
- `updateAutomationNodeConfig` writing to both the run snapshot and the live graph in one
  transaction, so an auto-created spreadsheet is never duplicated on retry.
- The digest query's half-open `(since, until]` window with `until` fixed at run-creation time —
  correctly closes both the duplicate-send race and the offset-pagination shift hazard.
- Validation error copy written in plain language with no internal identifiers, i18n'd across en/ta.
