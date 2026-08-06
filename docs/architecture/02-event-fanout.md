# One Event, Three Listeners

Three of the product's biggest features — Integrations, Automations, and
automatic PDF generation — all start from the same single line of code. None of
them know about each other. None of them are wired into the submission resolver.
They just listen.

This is the most useful thing to understand about the backend, and the hardest to
discover by reading it, because the connection is made at runtime by an
`EventEmitter` rather than by any import you can follow.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/plugins/core/events.ts:28` — `emitFormSubmitted` |
| **Trigger** | Called by `submitResponse` after the response row is written |
| **Execution** | Asynchronous, in-process, fire-and-forget |
| **Outcome** | Plugin deliveries, automation runs, generated PDFs — independently |
| **Fails loudly?** | No. Each listener catches its own errors |

## The flow

```
   submitResponse
         │
         │  emitFormSubmitted(formId, orgId, data)
         ▼
   ┌───────────────────────────────────┐
   │   pluginEventEmitter              │
   │   (a plain Node EventEmitter,     │
   │    one shared instance)           │
   └───┬───────────┬───────────────┬───┘
       │           │               │
       ▼           ▼               ▼
  ┌─────────┐ ┌──────────┐  ┌──────────────┐
  │ Plugin  │ │Automation│  │ PDF generator│
  │executor │ │ triggers │  │  auto-run    │
  └────┬────┘ └────┬─────┘  └──────┬───────┘
       │           │               │
       ▼           ▼               ▼
  PluginDelivery  AutomationRun   PdfGenerationResult
   rows            + pg-boss jobs   + file in private R2
```

All three registered during boot. None of them appear anywhere near
`submitResponse`.

## Walkthrough

**The emitter** — `plugins/core/events.ts:6`

One module-level `EventEmitter`, max listeners raised to 100. Everything travels
on a single channel named `plugin:event`; the event's own `type` field
distinguishes `form.submitted` from `response.edited` and `plugin.test`.

**Listener 1: the plugin executor** — registered by `initializePluginEvents()`

Loads every enabled plugin on the form whose `events` array contains this event
type, and runs them. Covered in detail on the Plugin Pipeline page.

**Listener 2: automation triggers** — registered by `initializeAutomationTriggers()`
in `services/automation/triggerService.ts:23`

Deliberately a *second, separate* listener on the same emitter rather than a
call from inside the first one. The comment in that file is explicit about why:
automations must not be able to change the behaviour or the latency of the
existing plugin path. Each listener stands alone.

It handles `form.submitted` and `response.edited`, ignores everything else, and
for each matching active automation creates an `AutomationRun` — snapshotting the
graph — then enqueues the first step onto pg-boss.

**Listener 3: PDF generator auto-run** — registered by
`initializePdfGeneratorAutoRun()` in `plugins/core/pdfGeneratorAutoRun.ts`

Finds PDF generators on the form with `autoRunOnSubmit` enabled and generates a
document for the new response.

**Registration** — `plugins/index.ts`

```
initializePluginSystem()
  ├── initializePluginEvents()
  └── initializePdfGeneratorAutoRun()
```

with `initializeAutomationTriggers()` called separately during backend startup.
Miss any of these during a refactor of `index.ts` and the corresponding feature
silently stops working — no error, no log, it just never runs.

## Invariants & design decisions

- **Listeners are peers, never chained.** Adding a fourth consumer means adding a
  fourth listener, not calling it from inside one of the existing three. Chaining
  would let one feature's failure or slowness affect another's.
- **The emitter is in-process and non-durable.** If the backend restarts between
  the emit and a listener finishing, that work is lost. Listeners that need
  durability get it themselves — automations by enqueuing to pg-boss immediately,
  plugins by recording every attempt in `PluginDelivery`.
- **`isPreview` is checked by each listener that cares.** The automation trigger
  service skips preview submissions so testing a form doesn't fire real
  automations. The emitter itself doesn't filter — it's the listener's call.
- **Loop guard on `response.edited`.** If an automation action ever edits a
  response, that edit carries `sourceRunId`, and the trigger service refuses to
  create a new run from it. Without this, an automation that edits responses
  would trigger itself forever. No action does this today; the guard exists so
  the first one that does is safe.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `getEventEmitter()` | `automation/triggerService.ts` | A stable, shared singleton emitter | You create a second emitter, or scope one per request |
| `emitFormSubmitted` | `resolvers/responses.ts` | Fire-and-forget, never throws | It starts awaiting listeners |
| `emitResponseEdited` | `services/responseService.ts` | Same shape as submitted, plus `editType` | The payload diverges from the submitted shape |
| `emitPluginTest` | `resolvers/plugins.ts` | Reaches only plugin handlers | Automations stop ignoring non-submit event types |
| The `plugin:event` channel name | All three listeners | String literal `'plugin:event'` | You rename it in one place only |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| `executePluginsForForm` | `plugins/core/executor.ts` | Listener 1's body |
| `automationRepository` | `repositories/automationRepository.ts` | Listener 2 creates runs |
| pg-boss | `services/automation/boss.ts` | Listener 2's durability |

## Data touched

| Model | Access | By |
|---|---|---|
| `FormPlugin` | R | Listener 1 |
| `PluginDelivery` | W | Listener 1 |
| `Automation` | R | Listener 2 |
| `AutomationRun` | W | Listener 2 |
| `PdfGenerator` / `PdfGenerationResult` | RW | Listener 3 |

## Failure & retry behavior

Each listener wraps its own body in try/catch and reports to Sentry. A thrown
error in one listener does not stop the others — Node's `EventEmitter` calls
listeners in sequence, and an uncaught throw would break that, which is exactly
why all three catch.

Retry is per-listener and happens downstream:

- **Plugins** — no automatic retry; failures land in `PluginDelivery` with
  `status: 'failed'` for manual inspection.
- **Automations** — pg-boss retries action steps 3 times with backoff.
- **PDF auto-run** — no retry; the generator can be re-run manually.

## Related pages

- [The Life of a Submission](./01-submission-lifecycle.md) — where the event
  comes from, and why it's emitted after the write rather than before.
- **Automations: From Graph to Run** *(not yet written)* — what listener 2 does
  with the run it creates.
- **The Plugin Pipeline** *(not yet written)* — what listener 1 does.

## Gotchas

- **The name collision, again.** `plugins/core/events.ts` and
  `subscriptions/events.ts` both export `emitFormSubmitted`. This page is about
  the first. The second only counts usage for billing and has no listeners
  besides the usage service. The comment at `pdfGeneratorAutoRun.ts:18` exists
  purely because someone will eventually import the wrong one.
- **Adding a listener is invisible in the submission code.** If you're wondering
  why something happens on submit and can't find the call, grep for
  `getEventEmitter` and `plugin:event` rather than reading `responses.ts`.
- **A new event type reaches existing plugins only if they opt in.**
  `executePluginsForForm` filters on `events: { has: event.type }`, so adding a
  new type is additive and safe — but it also means a plugin won't receive it
  until its `events` array is updated.
