import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/10-plans-usage-billing.md`.
 *
 * Two inbound paths converge on the Subscription row — webhooks from Chargebee,
 * and in-process usage events — then two enforcement points read back out of it.
 * AI usage hangs off its own store rather than the Subscription columns, which
 * is the visual form of the "three different reset clocks" point.
 */
export const billing: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'webhook',
      data: {
        label: 'Chargebee webhook',
        kind: 'entry',
        file: 'apps/backend/src/routes/chargebee-webhooks.ts',
        line: 60,
        does: 'Eight lifecycle events — created, changed, renewed, cancelled, paused, reactivated, payment succeeded and failed.',
        note: 'The organization id is recovered by stripping an org_ prefix from the Chargebee customer id. That naming convention is load-bearing.',
      },
    },
    {
      id: 'usageEvent',
      data: {
        label: 'Usage events',
        kind: 'entry',
        file: 'apps/backend/src/subscriptions/events.ts',
        line: 134,
        does: 'FORM_VIEWED and FORM_SUBMITTED on an in-process emitter, separate from the plugin one.',
      },
    },
    {
      id: 'sync',
      data: {
        label: 'Sync from Chargebee',
        kind: 'effect',
        file: 'apps/backend/src/services/chargebeeService.ts',
        line: 749,
        does: 'Mirrors plan, status and period into Postgres. On renewal it also resets the views and submissions counters.',
        note: 'Chargebee is the source of truth and Postgres is a cache — except for enterprise, whose limits are admin-set on the row and never re-derived.',
      },
    },
    {
      id: 'track',
      data: {
        label: 'Track usage',
        kind: 'effect',
        file: 'apps/backend/src/subscriptions/usageService.ts',
        line: 72,
        does: 'Increments the cached counter, then emits a warning at 80% and an exceeded event at 100%.',
        note: 'These events are informational. Nothing is actually blocked here — enforcement lives in checkUsageExceeded.',
      },
    },
    {
      id: 'subscription',
      data: {
        label: 'Subscription',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 667,
        does: 'Plan, status, billing period, and the cached views/submissions counters and limits.',
        note: 'Even the free plan has a real $0 Chargebee subscription, so every org has a billing period for the reset clocks to key off.',
        shared: 'Read by pricing, admin app and usage UI',
      },
    },
    {
      id: 'enforce',
      data: {
        label: 'checkUsageExceeded',
        kind: 'gate',
        file: 'apps/backend/src/subscriptions/usageService.ts',
        does: 'Rejects a submission outright when the organization is over its plan limit.',
        note: 'A hard stop, unlike the 80% warning. Cancelled and expired orgs fall back to free-tier limits rather than keeping their last paid tier.',
        shared: 'Called by submitResponse',
      },
    },
    {
      id: 'aiBudget',
      data: {
        label: 'checkAITokenBudget',
        kind: 'gate',
        file: 'apps/backend/src/services/aiUsageService.ts',
        line: 207,
        does: 'Returns 402 when the org is over its AI credit budget, or when the subscription is past_due.',
        note: 'A soft pre-check that can be beaten by concurrency — reserving atomically would serialise every AI request in the organization.',
      },
    },
    {
      id: 'aiUsage',
      data: {
        label: 'AIUsage',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 726,
        does: 'One row per organization per billing period, in milli-credits at 1x for nano and 3.75x for mini.',
        note: 'Never reset. A new period simply gets a new row, which is why AI credits roll over correctly even when a renewal webhook is missed and the other counters go stale.',
      },
    },
  ],
  edges: [
    { source: 'webhook', target: 'sync' },
    { source: 'usageEvent', target: 'track', async: true },
    { source: 'sync', target: 'subscription' },
    { source: 'track', target: 'subscription' },
    { source: 'subscription', target: 'enforce' },
    { source: 'subscription', target: 'aiBudget', label: 'period + limit' },
    { source: 'aiBudget', target: 'aiUsage' },
  ],
};
