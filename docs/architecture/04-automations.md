# Automations: From Graph to Run

A user drags boxes onto a canvas — *when a response comes in, wait two hours,
check whether they picked "Enterprise", then send a Slack message.* That canvas
is stored as JSON. This page is about what turns that JSON into something that
actually runs two hours later, survives a deploy in the middle, and doesn't send
the message twice.

Two things here surprise most people:

- **An automation action is a plugin handler.** There is no separate "action"
  abstraction. The engine calls `getPluginHandler(actionType)` — the same
  registry the Integrations feature uses.
- **Every run carries its own frozen copy of the graph.** Editing an automation
  never disturbs runs already in flight.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/services/automation/engine.ts:executeAutomationStep` |
| **Trigger** | A `form.submitted` / `response.edited` event, or a pg-boss cron tick |
| **Execution** | Asynchronous, durable — one pg-boss job per node |
| **Outcome** | An `AutomationRun` with one `AutomationStepRun` per node executed |
| **Fails loudly?** | Not to the respondent. Failures land in the run history |

## The flow

```
  form.submitted / response.edited          schedule (cron tick)
              │                                      │
              └──────────────┬───────────────────────┘
                             ▼
                 ┌───────────────────────┐
                 │  Create AutomationRun │  ← graph frozen here
                 └───────────┬───────────┘
                             ▼
                 ┌───────────────────────┐
                 │  pg-boss job          │  key: runId:nodeId
                 │  queue automation-step│
                 └───────────┬───────────┘
                             ▼
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          ┌───────┐    ┌───────────┐   ┌────────┐
          │ delay │    │ condition │   │ action │ → plugin handler
          └───┬───┘    └─────┬─────┘   └───┬────┘
              └──────────────┼─────────────┘
                             ▼
                 ┌───────────────────────┐
                 │ Record AutomationStep │
                 │ Run, enqueue successor│ ──┐
                 └───────────┬───────────┘   │ loops back to the queue
                             ▼               │ until a node has no successor
                       run COMPLETED  ◀──────┘
```

## Walkthrough

### Before it can run: validation

`graphValidator.ts` gates activation. An automation can only go `ACTIVE` if its
graph passes:

- **No cycles.** Detected explicitly, with the offending path named in the error.
- **No orphans.** Every node must be reachable from the trigger.
- **A reachable end** — at least one node with no outgoing edges.
- **Total delay along every path ≤ 30 days.**
- **Every action type is a registered plugin type**, and its config validates
  against that type's Zod schema.

That last rule is the first hint that actions and plugins are the same thing.

### Creating a run

Two paths in, both landing in `automationRepository.createRun`:

**Event-triggered** — `triggerService.ts:23` listens on the shared plugin event
emitter (see [One Event, Three Listeners](./02-event-fanout.md)) and matches
active automations on `(formId, triggerType)`.

**Schedule-triggered** — a pg-boss cron tick on the shared `automation-cron`
queue. Each automation gets a schedule keyed by its own id rather than its own
queue, because `boss.schedule` upserts by `(queue, key)` — idempotent across a
multi-instance deploy, and no per-automation worker registration.

Either way, the run stores `graphSnapshot` (the graph as it is right now) and
`automationVersion`. From this moment the live `Automation.graph` is irrelevant
to this run.

`enqueueFirstStep` then finds the trigger node, follows its outgoing edge, and
enqueues whatever comes next. The trigger node itself never executes — it's a
marker.

### One job per node

Every node execution is a separate pg-boss job carrying `{ runId, nodeId }`, with:

- **`singletonKey: runId:nodeId`** — the same step can never be queued twice.
- **`retryLimit: 3` with backoff, for action nodes only.** Delays and conditions
  are pure and cheap; actions talk to the outside world.

### The node handlers

**Delay** — `handleDelayNode`

Computes `delayUntil`, capped at 30 days, records a `SUCCESS` step, sets the run
to `WAITING`, and re-enqueues the successor with pg-boss's `startAfter`. The
process doesn't hold anything in memory — a two-week delay survives any number of
restarts because it lives in the database as a scheduled job.

Test runs (the `testAutomation` mutation) fast-forward instead: the step is
recorded `SKIPPED` with `fastForwarded: true` so the user sees end-to-end results
immediately. See **Test runs** below for what else test mode changes.

**Condition** — `handleConditionNode`

Evaluates the rules against `context.triggerData` and follows the edge whose
`sourceHandle` is `'true'` or `'false'`. The branch taken is written into the
step's `output`, which matters for crash recovery below.

**Digest / "Filter Responses"** — `handleDigestNode`

Queries responses in the window `(Automation.lastDigestedAt, run.startedAt]` and
merges a bounded summary into `context.triggerData` under reserved `__digest*`
keys.

`lastDigestedAt` is an explicit watermark, not something derived from run history:

- **Seeded at activation** to the moment the automation is switched on, so a first
  tick covers only what arrives afterwards. Without this, activating a weekly
  digest on an established form processes — and with a per-response email action,
  emails — every response the form has ever received. A node can opt out via
  `includeExistingResponses`, which leaves it unset so the first run covers
  everything.
- **Held whenever a step delivered nothing** (a `SKIPPED` action — no recipient
  resolvable, email quota reached) and on every test run, so the next tick
  re-covers the window. Nothing went out, so nothing can go out twice.
- **Advanced on a `PARTIAL` step**, because part of that batch *did* reach people
  and re-covering the window would send it to all of them again — there is no
  per-response idempotency to retry against. The shortfall is reported on the run
  instead of being silently re-blasted.

On a test run the node ignores the watermark entirely and takes the ten most
recent responses instead, flagged `sampled: true`.

**Action** — `handleActionNode`

1. Refuses to run if the automation is no longer `ACTIVE`, marking the step
   `SKIPPED` and the run `CANCELLED`. A paused automation stops mid-flight.
   **Test runs are exempt** — every automation starts as `DRAFT`, so gating them
   here would make it impossible to rehearse a flow before switching it on.
2. Rewrites the config for test mode (`applyTestModeConfig`), redirecting email
   to whoever pressed Test.
3. Substitutes field mentions in the config against the trigger data, so
   `Hi @{name}` becomes the respondent's actual answer.
4. Looks up `getPluginHandler(actionType)` and calls it with a synthetic plugin
   id of `runId:nodeId` — there is no `FormPlugin` row behind an action node.
5. Classifies the result (`classifyHandlerResult`) and records the step as
   `SUCCESS`, `PARTIAL`, `SKIPPED`, or `FAILED`, merges the result into
   `context.stepOutputs`, and enqueues the successor.

**Handlers report failure two ways.** Some throw; some *return* a result saying
so — the webhook handler returns `{ success: false, statusCode }` for any non-2xx,
and the email handler returns `{ skipped: true, skipReason }` or per-response
`{ sentCount, skippedCount, failedCount }`. Both paths converge on the same step
statuses, so a failed delivery can never be filed as a success. A returned
`FAILED` retries exactly like a thrown one; `PARTIAL` does not, because there is
no per-response idempotency to retry against.

### Test runs

`testAutomation` starts a real run through the real graph, made safe rather than
simulated. Test mode is carried on the run context (`test: true`, plus the
initiating user's `testUserEmail`) and changes five things:

| | |
|---|---|
| Delay nodes | Fast-forwarded, recorded `SKIPPED` with `fastForwarded: true` |
| The `ACTIVE` gate | Waived, so a `DRAFT` automation can be rehearsed before going live |
| Email actions | Redirected to `testUserEmail`, subject prefixed `[Test]`, per-response batches collapsed to one message. No address means the send is `SKIPPED`, never sent to the configured recipient |
| Other actions | Executed normally against the customer's own endpoint/spreadsheet, with `__isTest: true` on `event.data` so a receiver can tell |
| Digest nodes | Sample the ten most recent responses; the watermark is never advanced |

A schedule automation is tested with no triggering response at all, matching what
a real cron tick does — so it is testable on a form that has never been submitted.

### Where an action's config gets written back

Some handlers need to persist config as a side effect — Google Sheets creates a
spreadsheet on first run and must reuse it afterwards; OAuth tokens get refreshed.
Handlers do this through `context.updatePluginConfig`, and for automations that
writes to **two** places inside one transaction:

- `AutomationRun.graphSnapshot` for *this* run, so a retry after a transient
  network failure reuses the spreadsheet that was already created instead of
  making a second one.
- `Automation.graph`, the live graph, so the *next* run — which snapshots fresh
  from that column — reuses it too.

This is why `updatePluginConfig` exists as a context method rather than handlers
writing to `prisma.formPlugin` directly: an action node has no `FormPlugin` row,
and a handler that assumed one would throw "record not found" the moment it ran
inside an automation.

### Surviving a crash mid-step

pg-boss redelivers jobs. If the process died after a step's `SUCCESS` row was
written but before its successor was enqueued, naively skipping the redelivered
job would strand the run forever.

So before treating a redelivery as a no-op, `reconcileSuccessStep` **verifies**
the successor exists rather than assuming it. It reconstructs the successor
decision from the persisted step output — the branch a condition already took,
the `delayUntil` a delay already computed — and never re-derives it by
re-evaluating anything. The outcome that already happened is the one that counts.

If the successor has no step run of its own, it gets re-enqueued;
`singletonKey` makes that a no-op if it's already pending.

## Invariants & design decisions

- **The run's graph is frozen at trigger time.** Editing or deleting an
  automation cannot corrupt a run already executing. `automationVersion` records
  which version produced it.
- **Actions are plugin handlers, deliberately.** One registry, one handler
  signature, one place to add an integration. Adding a Slack action and adding a
  Slack plugin are the same work.
- **Never re-derive a decision that was already recorded.** Recovery replays from
  `AutomationStepRun.output`, never by re-running a handler or re-evaluating a
  condition.
- **Only action nodes retry.** Delays and conditions are deterministic; retrying
  them buys nothing and risks duplicate step rows.
- **A paused automation stops mid-flight.** The `status !== 'ACTIVE'` check sits
  inside the action handler, not just at trigger time — except for test runs,
  which are allowed to execute a `DRAFT` automation's actions.
- **A test run can never reach a real respondent.** Email actions are redirected
  to the tester, the digest node samples instead of draining its window, and the
  watermark is never advanced.
- **A window is never marked processed when nothing was delivered.** The digest
  watermark is held on a test run and on any step that delivered nothing; it
  advances on a partial delivery, which is reported rather than retried.
- **The engine degrades to off, not to broken.** With no `DIRECT_URL`, pg-boss
  never starts and every enqueue logs a warning instead of throwing.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `enqueueFirstStep` | `triggerService.ts` (both trigger paths) | Takes `{ id, graphSnapshot }` | The run shape changes |
| `AUTOMATION_QUEUE` / `AUTOMATION_CRON_QUEUE` | Engine, trigger service, cancellation | Stable queue names | Renamed without draining existing jobs |
| `AutomationRun` / `AutomationStepRun` | The Runs UI in form-app | `status` and `nodeType` string unions | A new status is added without updating the UI |
| `isAutomationEngineEnabled()` | Boot sequence, resolvers | Returns false rather than throwing | It starts throwing on missing config |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| `getPluginHandler` | `plugins/core/registry.ts` | Every action node is a plugin handler |
| `createPluginContext` | `plugins/core/context.ts` | Supplies the automation-specific `updatePluginConfig` |
| The `plugin:event` emitter | `plugins/core/events.ts` | Event-triggered runs |
| `substituteMentions` | `@dculus/utils` | Field mentions inside action config |
| `DIRECT_URL` | Environment | pg-boss cannot use the PgBouncer-pooled connection |

## Data touched

| Model | Access |
|---|---|
| `Automation` | RW — read at trigger, written by `updatePluginConfig` and the digest watermark |
| `AutomationRun` | RW |
| `AutomationStepRun` | W |
| `pgboss.*` schema | RW |

## Failure & retry behavior

| Situation | What happens |
|---|---|
| Action handler throws, attempts remain | `FAILED` step recorded, error rethrown so pg-boss retries with backoff |
| Action handler *returns* a failure (non-2xx webhook, batch that delivered nothing) | Same as throwing: `FAILED` step, retried |
| Action handler returns a partial batch (some sent, some failed) | `PARTIAL` step, run settles `PARTIAL`, not retried, watermark advances |
| Action handler returns `skipped` (no recipient, email quota reached) | `SKIPPED` step, run settles `PARTIAL`, watermark held for the next tick |
| Action handler throws on the final attempt | `FAILED` step recorded, run marked `FAILED`, no rethrow |
| Node id missing from the snapshot | `FAILED` step + `FAILED` run, written in one transaction so redelivery can't duplicate it |
| Automation no longer `ACTIVE` | Step `SKIPPED`, run `CANCELLED` |
| Run already terminal | Job returns immediately |
| Process crashed mid-step | Redelivery reconciles from persisted step output |

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `DIRECT_URL` | Environment | Unset disables the whole engine |
| `ACTION_RETRY_LIMIT = 3` | `engine.ts` | Retries per action node |
| `MAX_DELAY_MS` = 30 days | `engine.ts` | Per-delay cap |
| `MAX_DELAY_DAYS = 30` | `graphValidator.ts` | Cap on total delay along any path |
| `DIGEST_TEST_SAMPLE_SIZE = 10` | `engine.ts` | Responses a digest node samples on a test run |
| `includeExistingResponses` | Per digest node | Opt in to covering responses that predate activation |
| Automation `status` | Per automation | `DRAFT` / `ACTIVE` / `PAUSED` |

## Related pages

- [One Event, Three Listeners](./02-event-fanout.md) — how an event becomes a run,
  and why the trigger listener is separate from the plugin listener.
- [The Plugin Pipeline](./05-plugin-pipeline.md) — the registry and handler
  contract that action nodes borrow.

## Gotchas

- **pg-boss cannot use `DATABASE_URL`.** It needs a session-pinned connection for
  `LISTEN`/`NOTIFY` and advisory locks, which PgBouncer transaction pooling
  doesn't provide. Hence `DIRECT_URL`, and hence "automations silently do nothing"
  as the failure mode in an environment that only sets the pooled URL.
- **The trigger node never executes.** It's a graph marker. `enqueueFirstStep`
  skips straight past it.
- **A synthetic plugin id reaches handlers as `runId:nodeId`.** A handler that
  tries to load a `FormPlugin` by that id will not find one — that's what
  `context.updatePluginConfig` is for.
- **Schedule automations get empty trigger data.** `graphValidator` rejects
  response-dependent conditions and actions on them at activation time, so every
  reachable action must tolerate `{}`.
