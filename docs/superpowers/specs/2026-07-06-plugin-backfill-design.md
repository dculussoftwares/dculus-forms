# Plugin Backfill for Existing Responses — Design

**Date:** 2026-07-06
**Status:** Approved, ready for implementation planning

## Problem

Plugins (`webhook`, `email`, `quiz-grading`, `google-sheets`, `microsoft-sheets`, `ai-tagger`) only run against responses submitted *after* the plugin was created and enabled on a form (via the `form.submitted` event). If a user enables a plugin on a form that already has responses, or a new plugin type is created weeks/months from now, there is currently no way to run it against the responses that already exist. This needs to work for every plugin type, including ones that don't exist yet, without bespoke per-plugin work.

## Goals

- A form owner can trigger a plugin to process responses that existed before it was set up (or that it otherwise missed).
- Works identically for every plugin type — no plugin-specific backfill code.
- Safe to re-run: skips responses the plugin has already successfully processed.
- Doesn't overwhelm external services (webhook endpoints, SMTP) or the shared Postgres connection pool (see root `CLAUDE.md` — B1ms server, tight PgBouncer budget) with a burst of calls.
- Future plugins get this capability automatically with zero scaffolding changes.

## Non-Goals

- No new job queue infrastructure (BullMQ/Redis/etc.) — none exists in this codebase today and current/expected volumes (≤100k responses, the advanced-plan submission cap) don't justify introducing one.
- No durability across backend process restarts. A restart mid-backfill leaves the job stuck; this is handled with stale-job detection at read-time (see below), not a resumable job queue.
- No plugin-specific backfill logic or per-plugin UI. It's entirely generic.

## Confirmed Product Decisions

1. **Side effects fire for real.** Backfilling `webhook`/`email` sends real requests/emails for historical responses — the same handler runs, unconditionally. (No dry-run or side-effect gating in v1.)
2. **Manual trigger only.** No auto-run on plugin creation. The user clicks a "Backfill" button explicitly.
3. **Idempotent by default.** Backfill targets responses the plugin hasn't successfully processed yet (tracked via `PluginDelivery`, see below) — re-clicking "Backfill" only fills gaps, never reprocesses.
4. **Throttled execution.** Batches of 20 responses, ~500ms delay between batches.
5. **Live progress + cancel.** A polling status query drives a progress bar with a cancel button.

## Data Model Changes

### `PluginDelivery` — add `responseId`

Today `PluginDelivery` has no queryable link to the response it was delivered for (only an unindexed JSON `payload` blob). This is required to know "has response X already been processed by plugin Y" — needed for idempotent backfill, and useful generally (e.g. a future per-response "resend" action).

```prisma
model PluginDelivery {
  id           String   @id @default(cuid())
  pluginId     String
  responseId   String?               // NEW — nullable because plugin.test events have no response
  eventType    String
  status       String
  payload      Json
  response     Json?
  errorMessage String?
  deliveredAt  DateTime @default(now())

  plugin FormPlugin @relation(fields: [pluginId], references: [id], onDelete: Cascade)

  @@index([pluginId])
  @@index([pluginId, responseId])    // NEW
  @@index([eventType])
  @@index([status])
}
```

`executor.ts`'s `executePlugin` already receives `event.data.responseId` for `form.submitted` events today (confirmed at `graphql/resolvers/responses.ts:338-342`, which sets `responseId: savedResponse.id` when emitting). The only change needed is threading `event.data?.responseId ?? null` through to both `prisma.pluginDelivery.create(...)` calls (success and failure paths) in `executor.ts`. No handler code changes required.

### New model: `PluginBackfillJob`

One row per backfill run; tracks progress for the polling UI.

```prisma
model PluginBackfillJob {
  id             String    @id @default(cuid())
  pluginId       String
  formId         String
  status         String    // "running" | "cancelling" | "cancelled" | "completed" | "failed"
  totalCount     Int
  processedCount Int       @default(0)
  succeededCount Int       @default(0)
  failedCount    Int       @default(0)
  errorMessage   String?
  startedAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt   // doubles as a heartbeat for stalled-job detection
  completedAt    DateTime?

  plugin FormPlugin @relation(fields: [pluginId], references: [id], onDelete: Cascade)

  @@index([pluginId])
  @@index([formId])
}
```

`FormPlugin` gains `backfillJobs PluginBackfillJob[]`. Only one active job (`status` in `running`/`cancelling`) is allowed per plugin at a time — enforced in service logic, not a DB constraint.

## Backend Service Logic

New module: `apps/backend/src/plugins/core/backfill.ts`.

### `startBackfill(pluginId): Promise<PluginBackfillJob>`

1. Load the `FormPlugin`; must exist and be `enabled` (else throw via `createGraphQLError` + `GRAPHQL_ERROR_CODES`).
2. Reject if an active job (`running`/`cancelling`) already exists for this plugin — one job at a time per plugin.
3. Count eligible responses: `Response` rows for the plugin's `formId` (`deletedAt: null`) with **no successful `PluginDelivery`** for this `pluginId`. Use a `NOT EXISTS` correlated query (not a materialized `NOT IN` id list) so this stays efficient up to the ~100k-response advanced-plan ceiling.
4. Create the `PluginBackfillJob` row (`status: 'running'`, `totalCount` from step 3).
5. Kick off the runner as an un-awaited async function (fire-and-forget relative to the mutation) and return the job row immediately — the mutation must not block on the full backfill.

### Runner loop

- Repeatedly fetch the next batch of 20 still-unprocessed responses (same eligibility query as step 3), ordered by `submittedAt` ascending. Re-querying per batch (rather than snapshotting the full list upfront) means any response the live `form.submitted` flow processes concurrently is naturally excluded — no double-processing races.
- For each response in the batch, synthesize a `PluginEvent`:
  ```ts
  {
    type: 'form.submitted',
    formId,
    organizationId,        // from the Form record
    data: { responseId: response.id, submittedAt: response.submittedAt.toISOString(), ...response.data },
    timestamp: new Date(),
  }
  ```
  and call the existing `executePlugin(pluginId, event)` unmodified. This is the key reuse point — no new execution path, so every current and future plugin handler works without changes.
- After each batch completes: update `processedCount`/`succeededCount`/`failedCount` on the job row in a single write (batches DB writes, respecting the PgBouncer connection budget), then re-fetch `status` — if it has been flipped to `'cancelling'` (by the cancel mutation), stop, set `status: 'cancelled'`, `completedAt: new Date()`.
- Wait ~500ms between batches (throttles external calls to webhook endpoints / SMTP).
- When no unprocessed responses remain: `status: 'completed'`, `completedAt: new Date()`.
- Any unexpected error in the loop itself (not an individual plugin failure, which `executePlugin` already handles and counts under `failedCount`): caught, `status: 'failed'`, `errorMessage` set. Never crashes the server process.

### `cancelBackfill(jobId)`

Sets `status: 'cancelling'` only if current status is `'running'`. The runner observes this at the next batch boundary (so cancellation is not instant, but bounded by one batch + delay).

### Stalled-job detection

No queue infra means no durability across backend restarts. Rather than building resumable job persistence, the `pluginBackfillStatus` query resolver treats a `running` job whose `updatedAt` is more than 5 minutes stale as failed: it persists `status: 'failed'`, `errorMessage: 'Job appears stalled, possibly due to a server restart. Click Backfill again to retry.'` at read-time, then returns it. Retrying is always safe because eligibility is re-derived from `PluginDelivery` on every run — nothing already delivered gets reprocessed.

## GraphQL API

Added to `graphql/resolvers/plugins.ts` and `schema.ts`, following the same `requireAuth` + `requireOrganizationMembership` + OWNER-permission pattern as `createFormPlugin`:

```graphql
type PluginBackfillJob {
  id: ID!
  pluginId: ID!
  formId: ID!
  status: String!
  totalCount: Int!
  processedCount: Int!
  succeededCount: Int!
  failedCount: Int!
  errorMessage: String
  startedAt: String!
  completedAt: String
}

extend type Mutation {
  startPluginBackfill(pluginId: ID!): PluginBackfillJob!
  cancelPluginBackfill(jobId: ID!): PluginBackfillJob!
}

extend type Query {
  pluginBackfillStatus(pluginId: ID!): PluginBackfillJob
}
```

`pluginBackfillStatus` returns the most recent job for the plugin (by `startedAt`), or `null` if none has ever run.

## Frontend UI

All changes live in the **existing generic** `apps/form-app/src/components/plugins/PluginDashboardModal.tsx` (Configure tab), which every plugin type already renders through — no per-plugin frontend files are touched, now or for future plugins.

New section placed between `OverviewSummary` and "Recent activity", titled **"Existing Responses"**:

- **Idle** (`pluginBackfillStatus` is `null`, or terminal state and not currently polling): a button "Backfill existing responses" (icon: `PlayCircle`, matching the existing footer button style) that calls `startPluginBackfill`.
- **Running/cancelling**: a progress bar (`processedCount / totalCount`), inline succeeded/failed counts, and a "Cancel" button calling `cancelPluginBackfill`. Poll `pluginBackfillStatus` every 3s via `useQuery(..., { pollInterval: 3000, skip: !open })`, matching the modal's existing `skip: !open` convention.
- **Terminal** (`completed`/`cancelled`/`failed`): a compact one-line summary (e.g. "✓ 842 succeeded, 3 failed") with the button reappearing to run again — clicking it re-evaluates eligibility, so it only affects newly-unprocessed responses.
- All new strings added to the existing `pluginDashboard` i18n namespace (`en` + `ta`), per the mandatory i18n rule in `CLAUDE.md`.

## Consequence for the Plugin Generator Agent

Because backfill lives entirely in the generic `PluginDashboardModal.tsx` and the generic `executePlugin` path, **no change to `.claude/agents/plugin-generator.md`'s scaffold checklist is needed** — every plugin created after this ships (and every existing one) gets backfill for free. This will be recorded in the plugin-generator agent's memory so it doesn't attempt to re-scaffold something already generic.

## Testing Approach

- Unit tests for `backfill.ts`: eligibility query correctness (excludes responses with successful deliveries, includes failed/never-attempted ones), single-active-job enforcement, cancellation transition, stalled-job detection in the status resolver.
- Unit test for the `executor.ts` change: `responseId` is persisted on both success and failure `PluginDelivery` rows.
- Integration/resolver test: `startPluginBackfill` permission enforcement (OWNER-only), `pluginBackfillStatus` returns the latest job.
- Existing plugin handler tests (webhook/email/quiz/etc.) are unaffected — they already exercise `executePlugin` via a `PluginEvent`, which is unchanged in shape.

## Open Follow-Ups (not blocking this design)

- If a form's plugin ever needs to backfill well beyond 100k responses, the fire-and-forget in-process runner may need to move to a real queue — out of scope until that need materializes.
- No dry-run mode for side-effecting plugins (e.g. "preview 5 emails before sending 5,000") — could be a follow-up if users ask for it.
