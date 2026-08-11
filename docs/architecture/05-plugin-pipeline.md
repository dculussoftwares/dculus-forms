# The Plugin Pipeline

Plugins are how a form reaches the outside world: post to a webhook, send an
email, push a row to Google Sheets, grade a quiz, tag a response with AI. Six
types ship today, and adding a seventh is three files.

The architecture is smaller than it looks. A `Map` from type name to handler
function, a loop, and a table recording what happened. Almost everything
interesting is in the details of *when* it runs and *what a handler is allowed to
assume*.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/plugins/core/executor.ts:81` — `executePluginsForForm` |
| **Trigger** | A `plugin:event` from the shared emitter — `form.submitted`, `response.edited`, or `plugin.test` |
| **Execution** | Asynchronous, in-process, **sequential** across plugins |
| **Outcome** | One `PluginDelivery` row per plugin attempt, success or failure |
| **Fails loudly?** | No. A failed plugin is recorded, never surfaced to the respondent |

Registered types: `webhook`, `email`, `quiz`, `ai-tagger`, `google-sheets`,
`microsoft-sheets`.

## The flow

```
   plugin:event  ({ type, formId, organizationId, data, timestamp })
         │
         ▼
  ┌─────────────────────────────────────────┐
  │ executePluginsForForm                   │
  │   WHERE formId = ?                      │
  │     AND enabled = true                  │
  │     AND events HAS event.type           │
  └───────────────────┬─────────────────────┘
                      │  sequentially, never in parallel
                      ▼
             ┌──────────────────┐
             │ executePlugin    │
             │  · look up type  │
             │  · build context │
             └────────┬─────────┘
                      ▼
             ┌──────────────────┐        registry lookup
             │ handler(...)     │ ◀───── Map<type, PluginHandler>
             └────────┬─────────┘
                      ▼
             ┌──────────────────┐
             │ PluginDelivery   │  success | failed
             └──────────────────┘

   two side channels, both keyed on plugin type:

     exportRegistry  ──▶ extra columns in Excel / CSV export
     backfill job    ──▶ replay a new plugin over old responses
```

## Walkthrough

### The registry

`registry.ts` is a `Map<string, PluginHandler>` and five functions around it.
Registration happens as an import side effect — `plugins/index.ts` imports each
plugin's `index.ts`, which calls `registerPlugin(type, handler)`.

A handler is one signature, and that's the whole extension contract:

```ts
type PluginHandler = (
  plugin: { id: string; config: PluginConfig },
  event: PluginEvent,
  context: PluginContext
) => Promise<any>;
```

### Selecting which plugins run

`executePluginsForForm` queries on three conditions: the form, `enabled: true`,
and `events: { has: event.type }`. That last one is why adding a new event type
is always safe — existing plugins simply don't match it until someone adds the
type to their `events` array.

### Why sequential

Plugins run in a `for` loop, one after another, deliberately:

> Run plugins sequentially to prevent race conditions when multiple plugins of
> the same type (e.g. two quiz grading instances) read-modify-write the same
> `response.metadata` field concurrently.

`response.metadata` is a single JSON column that several plugin types write into,
keyed by plugin type. Running them in parallel means last-write-wins on a
document one of them never saw.

### The context

`createPluginContext` hands each handler a small, curated surface: `prisma`, a
few loaders (`getFormById`, `getResponseById`, `getResponsesByFormId`,
`getOrganization`, `getUserById`), `sendEmail`, a prefixed logger, and
`updatePluginConfig`.

That last one is the interesting one. Handlers that need to persist config as a
side effect — a refreshed OAuth token, an auto-created spreadsheet id — must go
through it rather than writing to `prisma.formPlugin` directly, because **the
same handler also runs as an automation action node, where no `FormPlugin` row
exists.** Each caller supplies the persistence strategy that matches how it
invoked the handler:

| Caller | `updatePluginConfig` writes to |
|---|---|
| `executor.ts` | The `FormPlugin.config` column |
| `automation/engine.ts` | Both `Automation.graph` and the run's `graphSnapshot` |

The default implementation throws with an explanatory message, so a caller that
forgets to supply one fails loudly rather than silently dropping a token refresh.

### Recording the outcome

Every attempt writes a `PluginDelivery` row — the payload sent, the handler's
return value or the error message, and `status: 'success' | 'failed'`. There is
no automatic retry. This table *is* the retry story: it's what the Integrations
delivery log reads, and what someone inspects when a webhook didn't arrive.

### Side channel 1: export columns

`exportRegistry.ts` lets a plugin type contribute columns to Excel and CSV
exports:

```ts
registerPluginExport({ pluginType, getColumns(), getValues(metadata) });
```

Column headers can also be derived from the plugin's stored config via the
optional `getColumnsWithConfig`, so a user-renamed column survives into the
export.

One wrinkle worth knowing: metadata keys come in two shapes. Legacy rows use a
bare type (`quiz-grading`), current rows use an instance-scoped key
(`quiz-grading:pluginId`) so two instances of the same plugin on one form don't
collide. `pluginTypeFromMetadataKey` splits on the first colon, and every lookup
goes through it.

### Side channel 2: backfill

Adding a plugin to a form with 10,000 existing responses raises an obvious
question: what about those? `backfill.ts` answers it with a `PluginBackfillJob`
that walks eligible responses in batches of 20 with a 500 ms pause between them,
updating `processedCount` / `succeededCount` / `failedCount` as it goes.

"Eligible" excludes responses that already have a successful `PluginDelivery` for
this plugin, so re-running a backfill doesn't double-deliver. Cancellation is
cooperative: the job status is set to `cancelling` and the loop notices at the
next batch boundary.

## Invariants & design decisions

- **Sequential execution is a correctness requirement, not a performance
  choice.** Anything that parallelises this loop reintroduces the
  `response.metadata` race.
- **A handler never knows how it was invoked.** The same function serves the
  Integrations feature and automation action nodes. Anything caller-specific goes
  through `PluginContext`.
- **Handlers must not write config directly.** `context.updatePluginConfig` or
  nothing — see the table above for why.
- **Every attempt is recorded, including failures.** Without a retry mechanism,
  `PluginDelivery` is the only evidence something was tried.
- **New event types are additive.** The `events has` filter means existing
  plugins ignore anything they haven't opted into.
- **Backfill excludes already-delivered responses.** Re-running is safe.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `getPluginHandler(type)` | `automation/engine.ts` | The three-argument handler signature | The signature changes, or registration becomes lazy |
| `registerPlugin(type, handler)` | Every plugin's `index.ts` | Called at import time | Registration moves to an explicit boot step some plugin forgets |
| `PluginContext` | Every handler | The loader set and `updatePluginConfig` | A field is removed that a handler already uses |
| `registerPluginExport` | `quiz`, `ai-tagger` | `getColumns()` / `getValues(metadata)` | Column keys change after exports are in the wild |
| `getActivePluginExports` | `unifiedExportService.ts` | Metadata-driven column selection | The metadata key convention changes |
| `PluginDelivery` rows | Integrations delivery log UI | `status` is `'success'` or `'failed'` | A third status appears |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| The `plugin:event` emitter | `plugins/core/events.ts` | The only trigger |
| `FormPlugin.enabled` + `events[]` | Integrations config UI | Decides which plugins match |
| `emailService`, `formService`, `responseService` | Services layer | Exposed to handlers through the context |

## Data touched

| Model | Access |
|---|---|
| `FormPlugin` | RW — read to select, written by `updatePluginConfig` |
| `PluginDelivery` | W |
| `PluginBackfillJob` | RW |
| `Response.metadata` | RW — by quiz grading and AI tagging |

## Failure & retry behavior

| Situation | What happens |
|---|---|
| Handler throws | `PluginDelivery` written with `status: 'failed'` and the message; Sentry captures it; the loop continues to the next plugin |
| Plugin disabled between select and execute | `executePlugin` re-checks and returns `{ success: false }` without a delivery row |
| No handler registered for the type | Throws, caught, recorded as a failed delivery |
| Backfill batch fails | Job marked `failed` with the error message; already-processed responses stay processed |

**There is no automatic retry anywhere in this pipeline.** A failed webhook stays
failed until someone re-triggers it.

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `FormPlugin.enabled` | Per plugin instance | Excluded from selection when false |
| `FormPlugin.events[]` | Per plugin instance | Which event types it receives |
| `BATCH_SIZE = 20` | `backfill.ts` | Responses per backfill batch |
| `BATCH_DELAY_MS = 500` | `backfill.ts` | Pause between batches |

## Related pages

- [One Event, Three Listeners](./02-event-fanout.md) — where the event comes from,
  and the two other listeners on the same emitter.
- [Automations: From Graph to Run](./04-automations.md) — the other caller of
  `getPluginHandler`, and why `updatePluginConfig` has two implementations.

## Gotchas

- **`registerPlugin` warns and overwrites on a duplicate type.** It doesn't
  throw. Two plugins registering the same type name means the second silently
  wins, with only a log line to show for it.
- **Registration is an import side effect.** If a plugin stops being imported by
  `plugins/index.ts`, its type disappears from the registry — and from the
  automation action catalog with it, since `graphValidator` checks action types
  against registered plugin types.
- **Metadata keys have two formats.** Always go through
  `pluginTypeFromMetadataKey` rather than comparing keys directly, or legacy rows
  will quietly stop matching.
- **The plugin id passed to a handler isn't always a `FormPlugin` id.** From an
  automation it's `runId:nodeId`. Handlers must not use it as a database key.
