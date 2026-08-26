import type { PgBoss, JobWithMetadata } from 'pg-boss';
import * as Sentry from '@sentry/node';
import { generateId, substituteMentions } from '@dculus/utils';
import { prisma } from '../../lib/prisma.js';
import { automationRepository, createAutomationRepository } from '../../repositories/index.js';
import { withPrisma } from '../../repositories/baseRepository.js';
import { logger } from '../../lib/logger.js';
import { getPluginHandler } from '../../plugins/core/registry.js';
import { createPluginContext } from '../../plugins/core/context.js';
import type { PluginConfig, PluginEvent } from '../../plugins/core/types.js';
import { getResponsesByFormId } from '../responseService.js';
import type { ResponseFilter } from '../responseFilterService.js';
import { AUTOMATION_QUEUE, getBoss, startAutomationBoss, stopAutomationBoss } from './boss.js';
import { evaluateCondition } from './conditionEvaluator.js';
import { DIGEST_RESPONSE_SAFETY_CEILING } from './graphValidator.js';
import type {
  AutomationEdge,
  AutomationGraph,
  AutomationNode,
  AutomationRunContext,
  ConditionRule,
  DigestNodeOutput,
  DigestResponseSummary,
} from './types.js';

const DELAY_UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 60 * 60_000,
  days: 24 * 60 * 60_000,
};

const MAX_DELAY_MS = 30 * DELAY_UNIT_MS.days;
export const ACTION_RETRY_LIMIT = 3;

const DIGEST_PAGE_SIZE = 100;
/**
 * Lower bound used when a digest node has no watermark to be incremental against — i.e. the whole
 * form history. Reached in exactly two cases, both deliberate:
 *  - the node opted into `includeExistingResponses`, so activation left `lastDigestedAt` unset;
 *  - a test run, which ignores the watermark and samples recent responses instead.
 * The default path never lands here: `setAutomationStatus` seeds `lastDigestedAt` at activation
 * so a first tick only covers responses submitted after the automation went live.
 */
const DIGEST_EPOCH_START = new Date(0);
/**
 * How many responses a digest node embeds on a TEST run. A test exists to show the user what the
 * flow does, not to drain the pending window, so it takes a small recent slice regardless of the
 * node's own limit.
 */
const DIGEST_TEST_SAMPLE_SIZE = 10;
/** Node types whose job gets pg-boss retries — both make a DB/network call that can transiently fail. */
const RETRYABLE_NODE_TYPES = new Set(['action', 'digest']);
/**
 * Run statuses no further step may execute from. PARTIAL is terminal like COMPLETED — every step
 * ran, but at least one did not fully deliver (see classifyHandlerResult). SKIPPED is a scheduled
 * tick that never started, because the previous run was still in flight (see triggerService).
 */
const TERMINAL_RUN_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'SKIPPED']);

type AutomationStepJobData = { runId: string; nodeId: string };

/**
 * The slice of a loaded run (`findRunByIdWithAutomation`) that every node handler needs in order
 * to settle the run: its id, its accumulated context, and the automation the watermark hangs off.
 * Handlers that mutate context pass a copy carrying the updated value rather than the stale one
 * they were called with — `completeRun` reads `context` to decide whether a digest window closed.
 */
type SettleableRun = {
  id: string;
  context: unknown;
  automation: { id: string };
};

function findNode(graph: AutomationGraph, nodeId: string): AutomationNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

function findNextNodeId(
  graph: AutomationGraph,
  nodeId: string,
  sourceHandle?: 'true' | 'false'
): string | null {
  const edge = graph.edges.find(
    (e: AutomationEdge) =>
      e.source === nodeId && (sourceHandle === undefined || e.sourceHandle === sourceHandle)
  );
  return edge?.target ?? null;
}

/**
 * Settles a run that reached the end of its graph, deciding two things from the same set of
 * imperfect steps.
 *
 * **The run's status.** COMPLETED only when every step cleanly succeeded; otherwise PARTIAL.
 * Several handlers report failure by *returning* rather than throwing (a non-2xx webhook, a digest
 * batch where some emails bounced, an email skipped because the org hit its quota), and filing
 * those runs as COMPLETED is what made the runs list show a green tick over undelivered work.
 * A SKIPPED delay step doesn't count — that's a test run fast-forwarding the wait, not a defect.
 *
 * **Whether the digest window closes.** Held open only when a step delivered *nothing* at all
 * (SKIPPED action), so the next tick re-covers the window and nothing is lost — and since nothing
 * went out, nothing can go out twice. A PARTIAL step still advances the watermark: part of that
 * batch did reach people, and re-covering the window would send it to all of them again (there is
 * no per-response idempotency to retry against). The shortfall is reported rather than silently
 * retried — which is the honest trade until per-response tracking exists.
 */
async function completeRun(run: SettleableRun): Promise<void> {
  const { blemishes, undelivered } = await summarizeRunOutcome(run.id);

  const status = blemishes.length > 0 ? 'PARTIAL' : 'COMPLETED';
  await automationRepository.updateRun(run.id, { status, completedAt: new Date() });

  if (blemishes.length > 0) {
    logger.warn(
      `[Automation Engine] Run ${run.id} finished with ${blemishes.length} step(s) that did not fully succeed — marking PARTIAL`
    );
  }

  if (undelivered.length > 0) {
    logger.warn(
      `[Automation Engine] Run ${run.id} had ${undelivered.length} step(s) that delivered nothing — holding the digest watermark so the next run re-covers this window`
    );
    return;
  }

  await advanceDigestWatermark(run);
}

/**
 * Resolves a run's step rows down to one outcome per node, then splits those into the two sets
 * `completeRun` needs: nodes that fell short of a clean success, and nodes that delivered nothing.
 *
 * **One outcome per node, not per row.** A retried action writes a row per attempt, so a node that
 * failed once and succeeded on the retry has both a `FAILED` and a `SUCCESS` row. Only the final
 * attempt counts — reading every row would file a run as `PARTIAL` because of a failure the retry
 * already made good. A node stops executing the moment it reaches a non-`FAILED` conclusion
 * (`findExecutedStepRun` is the redelivery guard), so "the non-`FAILED` row if there is one,
 * otherwise `FAILED`" is exactly the final attempt.
 *
 * A `SKIPPED` delay is excluded from both sets: that is a test run fast-forwarding the wait, not a
 * step falling short. Only an action has a delivery it can skip.
 */
async function summarizeRunOutcome(
  runId: string
): Promise<{ blemishes: string[]; undelivered: string[] }> {
  const stepRows = await automationRepository.listStepOutcomes(runId);

  const finalOutcomeByNode = new Map<string, { nodeType: string; status: string }>();
  for (const row of stepRows) {
    const recorded = finalOutcomeByNode.get(row.nodeId);
    if (!recorded || recorded.status === 'FAILED') {
      finalOutcomeByNode.set(row.nodeId, { nodeType: row.nodeType, status: row.status });
    }
  }

  const blemishes: string[] = [];
  const undelivered: string[] = [];

  for (const [nodeId, { nodeType, status }] of finalOutcomeByNode) {
    if (status === 'SUCCESS') continue;
    if (status === 'SKIPPED' && !nodeType.startsWith('action:')) continue;

    blemishes.push(nodeId);
    // FAILED and SKIPPED both mean this step put nothing out the door; PARTIAL means some of it
    // did, which is what makes re-covering the window unsafe.
    if (status !== 'PARTIAL') undelivered.push(nodeId);
  }

  return { blemishes, undelivered };
}

/**
 * Moves the automation's digest watermark to the upper bound of the window this run processed, so
 * the next tick starts exactly where this one stopped.
 *
 * Two guards, both load-bearing:
 *  - **test runs never advance it.** A test run that counted as the window anchor used to make the
 *    next real tick skip every response submitted before the test.
 *  - **no `__digestUntil` means no digest node ran**, so there is no window to close.
 * The clean-steps requirement lives in `completeRun`, which is this function's only caller.
 */
async function advanceDigestWatermark(run: SettleableRun): Promise<void> {
  const context = (run.context as AutomationRunContext) ?? {};
  if (context.test === true) return;

  const until = context.triggerData?.__digestUntil;
  if (typeof until !== 'string') return;

  const untilDate = new Date(until);
  if (Number.isNaN(untilDate.getTime())) return;

  await automationRepository.advanceDigestWatermark(run.automation.id, untilDate);
}

async function enqueueStep(
  runId: string,
  nodeId: string,
  graph: AutomationGraph,
  startAfter?: Date
): Promise<void> {
  const boss = getBoss();
  if (!boss) {
    logger.warn(`[Automation Engine] Cannot enqueue step ${nodeId} for run ${runId} — engine disabled`);
    return;
  }

  const isRetryable = RETRYABLE_NODE_TYPES.has(findNode(graph, nodeId)?.type ?? '');

  await boss.send(
    AUTOMATION_QUEUE,
    { runId, nodeId },
    {
      singletonKey: `${runId}:${nodeId}`,
      ...(startAfter ? { startAfter } : {}),
      ...(isRetryable ? { retryLimit: ACTION_RETRY_LIMIT, retryBackoff: true } : {}),
    }
  );
}

/** Trigger service (#194) entry point — enqueues the node reachable from the graph's trigger node. */
export async function enqueueFirstStep(run: { id: string; graphSnapshot: unknown }): Promise<void> {
  const graph = run.graphSnapshot as unknown as AutomationGraph;
  const triggerNode = graph.nodes.find((n) => n.type === 'trigger');
  const firstNodeId = triggerNode ? findNextNodeId(graph, triggerNode.id) : graph.nodes[0]?.id ?? null;

  if (!firstNodeId) {
    logger.warn(`[Automation Engine] Run ${run.id} has no steps to execute`);
    return;
  }

  await enqueueStep(run.id, firstNodeId, graph);
}

function buildPluginEvent(
  automation: { formId: string; organizationId: string; triggerType: string },
  run: { startedAt: Date; context: unknown }
): PluginEvent {
  const context = (run.context as AutomationRunContext) ?? {};
  return {
    // automation.triggerType is a plain `string` at the DB/type level (Automation.triggerType),
    // while PluginEvent['type'] is the closed union of values it's actually allowed to hold —
    // the cast just bridges that, it's not widening anything at runtime.
    type: automation.triggerType as PluginEvent['type'],
    formId: automation.formId,
    organizationId: automation.organizationId,
    data: {
      ...(context.triggerData ?? {}),
      // Reserved scalar (same channel as the __digest* keys) marking a test run, so a receiver on
      // the far end of a webhook can tell a rehearsal from a real submission and decline to act
      // on it. `event.type` deliberately stays the automation's real trigger type — handlers
      // branch on it for delivery semantics, not for test-ness.
      ...(context.test === true ? { __isTest: true } : {}),
    },
    timestamp: run.startedAt,
  };
}

/**
 * How a handler reported its outcome *without throwing*. Several do: the webhook handler returns
 * `{ success: false, statusCode }` for any non-2xx, and the email handler returns
 * `{ skipped: true, skipReason }` (no recipient resolvable, or the org's email quota reached) or,
 * for a per-response digest batch, `{ sentCount, skippedCount, failedCount }`.
 *
 * Every one of those used to be recorded as a SUCCESS step, which is how a batch where 400 of 500
 * emails failed showed a green tick and let the digest watermark advance past the 400 that never
 * arrived. Mapping them onto real step statuses is what makes both the run history and the
 * watermark honest.
 */
export function classifyHandlerResult(result: unknown): 'SUCCESS' | 'PARTIAL' | 'SKIPPED' | 'FAILED' {
  if (!result || typeof result !== 'object') return 'SUCCESS';
  const record = result as Record<string, unknown>;

  const toCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

  const sent = toCount(record.sentCount);
  const failed = toCount(record.failedCount);
  const skipped = toCount(record.skippedCount);

  // Batch results first: they carry per-item counts, which say more than the coarse `success`
  // boolean the same result also sets (a batch with any failure reports success: false, even
  // when most of it was delivered).
  if (failed > 0 || skipped > 0) {
    if (sent > 0) return 'PARTIAL';
    return failed > 0 ? 'FAILED' : 'SKIPPED';
  }

  if (record.skipped === true) return 'SKIPPED';
  if (record.success === false) return 'FAILED';
  return 'SUCCESS';
}

/** Best available human-readable reason from a handler result that didn't fully succeed. */
function describeHandlerFailure(result: unknown): string {
  if (!result || typeof result !== 'object') return 'The action reported a failure';
  const record = result as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error) return record.error;
  if (typeof record.skipReason === 'string' && record.skipReason) return record.skipReason;
  if (typeof record.statusCode === 'number') return `Request failed with status ${record.statusCode}`;
  return 'The action reported a failure';
}

/**
 * Rewrites an action's config for a TEST run so a rehearsal can never reach a real respondent.
 *
 * Only email is rewritten, and deliberately so: a webhook or Sheets action delivers into the
 * customer's *own* endpoint or spreadsheet (and the standalone Plugins "Test" button already fires
 * those for real), whereas an email action's recipient is typically the person who filled in the
 * form. So email is redirected to whoever pressed Test, and the subject is marked, while
 * everything else executes normally with `__isTest` set on the event.
 *
 * Clearing `recipientFieldId` also collapses per-response digest mode (email/handler.ts sends one
 * email per matched response when it is set) down to a single message — a test should show what
 * the email looks like, not send one to each of a batch.
 *
 * Returns `null` when there is no address to redirect to, which the caller turns into a SKIPPED
 * step: silently falling back to the configured recipient is exactly the accident this prevents.
 */
function applyTestModeConfig(
  actionType: string,
  config: Record<string, any>,
  testUserEmail: string | undefined
): Record<string, any> | null {
  if (actionType !== 'email') return config;
  if (!testUserEmail) return null;

  return {
    ...config,
    recipientEmail: testUserEmail,
    recipientFieldId: undefined,
    recipientFieldLabel: undefined,
    sendToSubmitter: false,
    subject: `[Test] ${config.subject ?? ''}`.trim(),
  };
}

function substituteConfigMentions(
  config: Record<string, any>,
  responses: Record<string, any>
): Record<string, any> {
  const substitute = (value: any): any => {
    if (typeof value === 'string') return substituteMentions(value, responses);
    if (Array.isArray(value)) return value.map(substitute);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v)]));
    }
    return value;
  };
  return substitute(config);
}

function mergeStepOutput(context: unknown, nodeId: string, output: any): AutomationRunContext {
  const ctx = (context && typeof context === 'object' ? context : {}) as AutomationRunContext;
  return {
    ...ctx,
    stepOutputs: { ...(ctx.stepOutputs ?? {}), [nodeId]: output ?? null },
  };
}

/**
 * Merges a digest node's output into `context.triggerData` under reserved `__digest*` keys —
 * the ONLY channel `buildPluginEvent` forwards to downstream action handlers as `event.data`
 * (it never reads `context.stepOutputs`). `__digestCount`/`__digestSince`/`__digestUntil`/
 * `__digestTruncated` are flat scalars, safe for both `{{mention}}` substitution and
 * condition-rule comparisons (both do plain `record[key]` lookups). `__digestResponses` is a
 * bounded array — never exposed as a mention token (graphValidator enforces this), only read
 * programmatically by the webhook/email-table/sheets-batch handlers.
 */
function mergeDigestIntoTriggerData(
  context: unknown,
  output: DigestNodeOutput
): AutomationRunContext {
  const ctx = (context && typeof context === 'object' ? context : {}) as AutomationRunContext;
  return {
    ...ctx,
    triggerData: {
      ...(ctx.triggerData ?? {}),
      __digestCount: output.count,
      __digestSince: output.since,
      __digestUntil: output.until,
      __digestTruncated: output.truncated,
      __digestResponses: output.responses,
    },
  };
}

/**
 * Pages through `getResponsesByFormId` (reusing the existing __submittedAt/DATE_AFTER +
 * DATE_BEFORE filters — indexed via Response's @@index([formId, submittedAt]), zero new SQL) to
 * collect up to `maxResponses` responses submitted in the HALF-OPEN window `(since, until]`
 * matching every rule in `extraFilters` (ANDed — see AutomationDigestNode's data doc comment in
 * types.ts for why only AND is supported), oldest-first.
 *
 * The `until` upper bound is load-bearing, not optional polish — it's `run.startedAt`, a
 * timestamp fixed BEFORE this query (or any of its pages) ever runs. Two problems it closes at
 * once: (1) without it, a response submitted while THIS run's query is still executing would
 * satisfy `submittedAt > since` on BOTH this run and the next (since the next run's `since` is
 * this run's `startedAt`, which is earlier than that response's submittedAt) — a duplicate
 * send/row. (2) it also makes the underlying result set for this call immutable for the whole
 * paginated loop below: Postgres timestamps only move forward, so no row with
 * `submittedAt <= until` can be inserted AFTER this query starts — the classic "new rows shift
 * offset-pagination pages" hazard can't occur when the page boundary is provably static.
 *
 * Uses a fixed page size across calls (required for correct skip/page-number math) and slices
 * the final page down to `maxResponses` rather than shrinking the page size, which would break
 * pagination. `total` comes from the first page's DB-computed count — accurate even when the
 * result is truncated, so no separate COUNT query is needed.
 *
 * `order` exists for test runs, which want the most RECENT few responses rather than the oldest
 * few of an unbounded window; the returned array is always oldest-first regardless, so downstream
 * consumers (the digest email table, per-response sends) read chronologically either way. The
 * immutability argument above holds for both directions, since it rests on the fixed `until`
 * bound rather than on the sort.
 */
async function fetchDigestResponses(
  formId: string,
  since: Date,
  until: Date,
  maxResponses: number,
  extraFilters: ConditionRule[] = [],
  order: 'asc' | 'desc' = 'asc'
): Promise<{ responses: DigestResponseSummary[]; total: number }> {
  const responses: DigestResponseSummary[] = [];
  let total = 0;
  let page = 1;
  const filters: ResponseFilter[] = [
    { fieldId: '__submittedAt', operator: 'DATE_AFTER', value: since.toISOString() },
    { fieldId: '__submittedAt', operator: 'DATE_BEFORE', value: until.toISOString() },
    ...extraFilters,
  ];

  while (responses.length < maxResponses) {
    const pageResult = await getResponsesByFormId(
      formId,
      page,
      DIGEST_PAGE_SIZE,
      'submittedAt',
      order,
      filters
    );
    total = pageResult.total;

    const remaining = maxResponses - responses.length;
    for (const r of pageResult.data.slice(0, remaining)) {
      responses.push({ id: r.id, submittedAt: r.submittedAt.toISOString(), data: r.data });
    }

    if (pageResult.data.length < DIGEST_PAGE_SIZE || page >= pageResult.totalPages) break;
    page += 1;
  }

  return { responses: order === 'desc' ? responses.reverse() : responses, total };
}

/**
 * Persists an action-node handler's updated config (auto-created spreadsheet/workbook ID,
 * refreshed OAuth token, etc.) for the Automations system — see `PluginContext.updatePluginConfig`
 * for why handlers can't just write to a `FormPlugin` row here.
 *
 * Writes to two places, both inside one Prisma transaction so they can't diverge if one
 * write fails after the other succeeds:
 *  - `AutomationRun.graphSnapshot` for THIS run, so a retry after a transient failure (e.g.
 *    the workbook was created but the network dropped before this write) sees the
 *    already-created workbook/spreadsheet instead of creating a duplicate.
 *  - `Automation.graph`, the live graph, so the NEXT run — which snapshots fresh from this
 *    column — reuses the same workbook/spreadsheet and refreshed token too.
 *
 * Uses the callback-style `prisma.$transaction(async (tx) => ...)` form (rather than
 * array-style batching) so both writes share one interactive transaction via a
 * transaction-scoped repository, per the standard convention — see formService.ts
 * `createForm()`.
 */
async function updateAutomationNodeConfig(
  automationId: string,
  runId: string,
  nodeId: string,
  config: PluginConfig
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const txRepo = createAutomationRepository(withPrisma(tx as any));
    await txRepo.setNodeConfigInGraph(automationId, nodeId, config as any);
    await txRepo.setNodeConfigInRunSnapshot(runId, nodeId, config as any);
  });
}

async function handleDelayNode(
  run: SettleableRun,
  node: Extract<AutomationNode, { type: 'delay' }>,
  graph: AutomationGraph
): Promise<void> {
  const { amount, unit } = node.data;
  const requestedMs = amount * (DELAY_UNIT_MS[unit] ?? DELAY_UNIT_MS.minutes);
  const delayMs = Math.min(requestedMs, MAX_DELAY_MS);
  const delayUntil = new Date(Date.now() + delayMs);

  const context = (run.context as AutomationRunContext) ?? {};
  const isTest = context.test === true;

  const nextNodeId = findNextNodeId(graph, node.id);

  if (isTest) {
    // Test runs (testAutomation mutation, #195) fast-forward delay nodes instead of
    // scheduling with startAfter, so the user sees end-to-end results immediately.
    await automationRepository.createStepRun({
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType: 'delay',
      status: 'SKIPPED',
      output: { fastForwarded: true, requestedDelayMs: requestedMs },
      attempt: 1,
      finishedAt: new Date(),
    });

    if (!nextNodeId) {
      await completeRun(run);
      return;
    }

    await automationRepository.updateRun(run.id, { currentNodeId: nextNodeId });
    await enqueueStep(run.id, nextNodeId, graph);
    return;
  }

  await automationRepository.createStepRun({
    id: generateId(),
    runId: run.id,
    nodeId: node.id,
    nodeType: 'delay',
    status: 'SUCCESS',
    output: { delayUntil: delayUntil.toISOString(), capped: delayMs < requestedMs },
    attempt: 1,
    finishedAt: new Date(),
  });

  if (!nextNodeId) {
    await completeRun(run);
    return;
  }

  await automationRepository.updateRun(run.id, { status: 'WAITING', currentNodeId: nextNodeId });
  await enqueueStep(run.id, nextNodeId, graph, delayUntil);
}

async function handleConditionNode(
  run: SettleableRun,
  node: Extract<AutomationNode, { type: 'condition' }>,
  graph: AutomationGraph
): Promise<void> {
  const context = (run.context as AutomationRunContext) ?? {};
  const result = evaluateCondition(node.data.rules, node.data.combinator, context.triggerData ?? {});
  const branch: 'true' | 'false' = result ? 'true' : 'false';
  const nextNodeId = findNextNodeId(graph, node.id, branch);

  await automationRepository.createStepRun({
    id: generateId(),
    runId: run.id,
    nodeId: node.id,
    nodeType: 'condition',
    status: 'SUCCESS',
    output: { result, branch: nextNodeId ? branch : 'end' },
    attempt: 1,
    finishedAt: new Date(),
  });

  if (!nextNodeId) {
    await completeRun(run);
    return;
  }

  await automationRepository.updateRun(run.id, { currentNodeId: nextNodeId });
  await enqueueStep(run.id, nextNodeId, graph);
}

/**
 * Filter Responses node: queries responses matching this node's filters within the window
 * `(lastDigestedAt, run.startedAt]` and merges a bounded summary into context for downstream
 * condition/action nodes. graphValidator guarantees this node is the trigger's sole successor on a
 * schedule-triggerType automation (see that file's "must follow trigger directly" rule), so
 * nothing can execute between the tick firing and this query. Gets pg-boss retries like action
 * nodes (RETRYABLE_NODE_TYPES) since the query is a real DB call that can transiently fail.
 *
 * The lower bound is `Automation.lastDigestedAt`, an explicit watermark seeded at activation and
 * advanced only by a clean, non-test run (see completeRun/advanceDigestWatermark). It is unset
 * only when the node opted into `includeExistingResponses`, in which case the first tick
 * deliberately covers the form's whole history.
 *
 * A TEST run ignores the watermark entirely and takes the most recent DIGEST_TEST_SAMPLE_SIZE
 * responses instead. Testing a schedule automation should show the user what their flow does with
 * real-looking data — not drain the pending batch for real (the watermark stays put either way),
 * and not report an empty window just because the automation happens to be up to date.
 */
async function handleDigestNode(
  run: {
    id: string;
    context: unknown;
    startedAt: Date;
    automation: { id: string; formId: string; lastDigestedAt?: Date | null };
  },
  node: Extract<AutomationNode, { type: 'digest' }>,
  graph: AutomationGraph,
  job: JobWithMetadata<AutomationStepJobData>
): Promise<void> {
  const attempt = job.retryCount + 1;
  const isTest = ((run.context as AutomationRunContext) ?? {}).test === true;

  const maxResponses = isTest
    ? DIGEST_TEST_SAMPLE_SIZE
    : Math.min(node.data.maxResponses ?? DIGEST_RESPONSE_SAFETY_CEILING, DIGEST_RESPONSE_SAFETY_CEILING);

  try {
    const since = isTest ? DIGEST_EPOCH_START : run.automation.lastDigestedAt ?? DIGEST_EPOCH_START;
    // Fixed at run-creation time, BEFORE this query (or any of its pages) runs — see
    // fetchDigestResponses's doc comment for why this must be a stable timestamp captured
    // before querying, not `new Date()` evaluated here (which would race against responses
    // submitted while the query itself is still executing).
    const until = run.startedAt;

    const { responses, total } = await fetchDigestResponses(
      run.automation.formId,
      since,
      until,
      maxResponses,
      node.data.filters ?? [],
      isTest ? 'desc' : 'asc'
    );

    const output: DigestNodeOutput = {
      // On a test run `count` describes the sample actually taken, not the whole form: it feeds
      // `__digestCount`, which downstream conditions branch on ("only continue if there are new
      // responses"), and an all-time total would make that branch mean something different in a
      // test than it does in a real run.
      count: isTest ? responses.length : total,
      since: since.toISOString(),
      until: until.toISOString(),
      truncated: total > responses.length,
      responses,
      ...(isTest ? { sampled: true } : {}),
    };

    const nextContext = mergeStepOutput(
      mergeDigestIntoTriggerData(run.context, output),
      node.id,
      output
    );

    await automationRepository.createStepRun({
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType: 'digest',
      status: 'SUCCESS',
      output: output as any,
      attempt,
      finishedAt: new Date(),
    });

    await automationRepository.updateRun(run.id, { context: nextContext });

    const nextNodeId = findNextNodeId(graph, node.id);
    if (!nextNodeId) {
      // Settle against the merged context, not the stale one this handler was called with —
      // completeRun reads `__digestUntil` off it to decide whether a window just closed.
      await completeRun({ ...run, context: nextContext });
      return;
    }
    await enqueueStep(run.id, nextNodeId, graph);
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[Automation Engine] Digest step failed: run=${run.id} node=${node.id}`, error);

    await automationRepository.createStepRun({
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType: 'digest',
      status: 'FAILED',
      errorMessage: error?.message || 'Unknown error',
      attempt,
      finishedAt: new Date(),
    });

    const isFinalAttempt = job.retryLimit <= job.retryCount;
    if (isFinalAttempt) {
      await automationRepository.updateRun(run.id, { status: 'FAILED', completedAt: new Date() });
      return;
    }

    // Rethrow so pg-boss schedules the retry per enqueueStep's retryLimit/retryBackoff.
    throw error;
  }
}

async function handleEndNode(
  run: SettleableRun,
  node: Extract<AutomationNode, { type: 'end' }>
): Promise<void> {
  await automationRepository.createStepRun({
    id: generateId(),
    runId: run.id,
    nodeId: node.id,
    nodeType: 'end',
    status: 'SUCCESS',
    attempt: 1,
    finishedAt: new Date(),
  });
  await completeRun(run);
}

async function handleActionNode(
  run: {
    id: string;
    context: unknown;
    startedAt: Date;
    automation: { id: string; status: string; formId: string; organizationId: string; triggerType: string };
  },
  node: Extract<AutomationNode, { type: 'action' }>,
  graph: AutomationGraph,
  job: JobWithMetadata<AutomationStepJobData>
): Promise<void> {
  const { actionType, config } = node.data;
  const nodeType = `action:${actionType}`;
  const attempt = job.retryCount + 1;
  const runContext = (run.context as AutomationRunContext) ?? {};
  const isTest = runContext.test === true;

  // A test run executes its actions whatever the automation's status. Every automation starts as
  // DRAFT, so gating test runs on ACTIVE made "build it, test it, then switch it on" impossible —
  // the test died at the first action and the only way to see an automation work was to point it
  // at real respondents first. Test-mode deliveries are made safe by applyTestModeConfig below,
  // not by refusing to run. The ACTIVE gate still stands for real runs: it is what stops an
  // in-flight run the moment someone pauses the automation.
  if (!isTest && run.automation.status !== 'ACTIVE') {
    await automationRepository.createStepRun({
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType,
      status: 'SKIPPED',
      errorMessage: `Automation is ${run.automation.status}, not ACTIVE`,
      attempt: 1,
      finishedAt: new Date(),
    });
    await automationRepository.updateRun(run.id, { status: 'CANCELLED', completedAt: new Date() });
    return;
  }

  await automationRepository.updateRun(run.id, { status: 'RUNNING', currentNodeId: node.id });

  const effectiveConfig = isTest ? applyTestModeConfig(actionType, config, runContext.testUserEmail) : config;

  if (effectiveConfig === null) {
    // Test mode with nowhere safe to send. Skipping is the only correct outcome — falling back to
    // the configured recipient would email a real respondent from a rehearsal.
    await automationRepository.createStepRun({
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType,
      status: 'SKIPPED',
      errorMessage:
        'Test run: this email was not sent because no address was available to redirect it to. Re-run the test from the automation builder.',
      attempt: 1,
      finishedAt: new Date(),
    });
    const nextNodeId = findNextNodeId(graph, node.id);
    if (!nextNodeId) {
      await completeRun(run);
      return;
    }
    await enqueueStep(run.id, nextNodeId, graph);
    return;
  }

  const event = buildPluginEvent(run.automation, run);
  // A digest-downstream email action with recipientFieldId set sends once PER matched response
  // (email/handler.ts's per-response loop), each substituting {{field}} mentions against that
  // response's own data — substituteMentions() replaces any UNMATCHED key with a "[label]"
  // fallback (packages/utils/src/mentionSubstitution.ts), so pre-substituting here against the
  // aggregate event.data (which has no real field values, only __digest* scalars) would destroy
  // the {{field}} placeholders before the handler ever gets a chance to fill them in per response.
  // Reads effectiveConfig, not the raw config: in test mode recipientFieldId has been cleared,
  // which collapses the batch to one redirected email — that path pre-substitutes like any other.
  const isPerResponseEmailAction =
    actionType === 'email' &&
    Boolean(effectiveConfig.recipientFieldId) &&
    Array.isArray(event.data.__digestResponses);
  const substitutedConfig = isPerResponseEmailAction
    ? (effectiveConfig as PluginConfig)
    : (substituteConfigMentions(effectiveConfig, event.data) as PluginConfig);

  let result: unknown;
  try {
    const handler = getPluginHandler(actionType);
    if (!handler) {
      throw new Error(`No handler registered for action type: ${actionType}`);
    }

    result = await handler(
      { id: `${run.id}:${node.id}`, config: substitutedConfig },
      event,
      createPluginContext(
        (newConfig) => updateAutomationNodeConfig(run.automation.id, run.id, node.id, newConfig),
        // Same value as the synthetic plugin id above, and stable for the same reason: `runId`
        // and `nodeId` both survive a retry, so every attempt at this delivery carries one key
        // while a different node or run gets its own.
        `${run.id}:${node.id}`
      )
    );
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[Automation Engine] Action step failed: run=${run.id} node=${node.id}`, error);
    await failActionStep(run, node, nodeType, attempt, job, error?.message || 'Unknown error', undefined, error);
    return;
  }

  // Handlers report failure two different ways: by throwing (caught above) and by returning a
  // result that says so. Both must land in the same place, or a non-2xx webhook and a digest batch
  // that delivered nothing get filed as successes.
  const outcome = classifyHandlerResult(result);

  if (outcome === 'FAILED') {
    const message = describeHandlerFailure(result);
    logger.error(
      `[Automation Engine] Action step reported failure without throwing: run=${run.id} node=${node.id} — ${message}`
    );
    await failActionStep(run, node, nodeType, attempt, job, message, result);
    return;
  }

  await automationRepository.createStepRun({
    id: generateId(),
    runId: run.id,
    nodeId: node.id,
    nodeType,
    status: outcome,
    output: (result ?? {}) as any,
    // PARTIAL/SKIPPED carry their reason here so the run detail can show it inline, the same way
    // a FAILED step does, instead of burying it in the output JSON.
    ...(outcome === 'SUCCESS' ? {} : { errorMessage: describeHandlerFailure(result) }),
    attempt,
    finishedAt: new Date(),
  });

  const nextContext = mergeStepOutput(run.context, node.id, result);
  await automationRepository.updateRun(run.id, { context: nextContext });

  const nextNodeId = findNextNodeId(graph, node.id);
  if (!nextNodeId) {
    await completeRun({ ...run, context: nextContext });
    return;
  }
  await enqueueStep(run.id, nextNodeId, graph);
}

/**
 * Records a FAILED action step and then either lets pg-boss retry (by rethrowing) or, on the final
 * attempt, settles the run as FAILED. Shared by the thrown-error path and the
 * handler-returned-failure path so the two behave identically — including retries, which a non-2xx
 * webhook genuinely wants and never used to get.
 */
async function failActionStep(
  run: { id: string },
  node: AutomationNode,
  nodeType: string,
  attempt: number,
  job: JobWithMetadata<AutomationStepJobData>,
  message: string,
  output?: unknown,
  /** The original error, when the handler threw — rethrown as-is so its stack survives the retry. */
  cause?: unknown
): Promise<void> {
  const stepRun = {
    id: generateId(),
    runId: run.id,
    nodeId: node.id,
    nodeType,
    status: 'FAILED',
    errorMessage: message,
    ...(output === undefined ? {} : { output: output as any }),
    attempt,
    finishedAt: new Date(),
  };

  const isFinalAttempt = job.retryLimit <= job.retryCount;
  if (isFinalAttempt) {
    // One transaction, for the same reason recordUnhandleableStepFailure uses one: a crash
    // between these two writes leaves the run non-terminal, and since FAILED is deliberately not
    // a redelivery guard (`findExecutedStepRun` excludes it, so retries can re-run the node), the
    // redelivered job would call the handler again — delivering the same email or webhook twice.
    await prisma.$transaction(async (tx) => {
      const txRepo = createAutomationRepository(withPrisma(tx as any));
      await txRepo.createStepRun(stepRun);
      await txRepo.updateRun(run.id, { status: 'FAILED', completedAt: new Date() });
    });
    return;
  }

  await automationRepository.createStepRun(stepRun);

  // Throw so pg-boss schedules the retry per the job's retryLimit/retryBackoff.
  throw cause ?? new Error(message);
}

/**
 * Advances past a node whose step run is already on record, verifying (rather than assuming) that
 * the successor was actually enqueued before redelivery is allowed to be a no-op. Reconstructs the
 * successor decision from the persisted step output — never re-derives it (e.g. re-evaluating a
 * condition or re-running a handler), since the recorded outcome is the one that already happened.
 */
async function reconcileSuccessor(
  run: SettleableRun & { status: string },
  nextNodeId: string | null,
  graph: AutomationGraph,
  startAfter?: Date
): Promise<void> {
  if (!nextNodeId) {
    if (!TERMINAL_RUN_STATUSES.has(run.status)) {
      await completeRun(run);
    }
    return;
  }

  // If the successor already has its own step run, it has executed (or progressed further) —
  // the crash window has already closed safely and re-enqueuing now would risk a duplicate
  // execution once pg-boss's singletonKey slot has freed up behind a completed job.
  const successorStarted = await automationRepository.findStepRunByNode(run.id, nextNodeId);
  if (successorStarted) {
    return;
  }

  logger.warn(
    `[Automation Engine] Run ${run.id}: successor ${nextNodeId} was never recorded after its predecessor succeeded — re-enqueuing (singletonKey makes this a no-op if it is already pending)`
  );
  await enqueueStep(run.id, nextNodeId, graph, startAfter);
}

async function reconcileSuccessStep(
  run: SettleableRun & { status: string },
  node: AutomationNode,
  graph: AutomationGraph,
  existingSuccess: { output: unknown }
): Promise<void> {
  switch (node.type) {
    case 'delay': {
      const output = (existingSuccess.output as { delayUntil?: string } | null) ?? {};
      const startAfter = output.delayUntil ? new Date(output.delayUntil) : undefined;
      await reconcileSuccessor(run, findNextNodeId(graph, node.id), graph, startAfter);
      return;
    }
    case 'condition': {
      const output = (existingSuccess.output as { result?: boolean } | null) ?? {};
      const branch: 'true' | 'false' = output.result ? 'true' : 'false';
      await reconcileSuccessor(run, findNextNodeId(graph, node.id, branch), graph);
      return;
    }
    case 'action': {
      // Close the equivalent gap between the SUCCESS step write and the stepOutputs merge: if
      // the context update was lost to the same crash window, replay it from the persisted
      // step output rather than the (unavailable) live handler result.
      const context = (run.context as AutomationRunContext) ?? {};
      if (!(node.id in (context.stepOutputs ?? {}))) {
        await automationRepository.updateRun(run.id, {
          context: mergeStepOutput(run.context, node.id, existingSuccess.output),
        });
      }
      await reconcileSuccessor(run, findNextNodeId(graph, node.id), graph);
      return;
    }
    case 'digest': {
      // Same gap as 'action': if the triggerData/stepOutputs merge was lost to the crash window,
      // replay it from the persisted step output — never re-query, since a redelivered digest
      // query could return a different response set (new submissions since the crash) than the
      // one that actually ran, breaking idempotency.
      const context = (run.context as AutomationRunContext) ?? {};
      const output = existingSuccess.output as DigestNodeOutput | null;
      let reconciledRun = run;
      if (output && context.triggerData?.__digestCount === undefined) {
        const nextContext = mergeStepOutput(
          mergeDigestIntoTriggerData(run.context, output),
          node.id,
          output
        );
        await automationRepository.updateRun(run.id, { context: nextContext });
        // Carry the replayed context forward: if this node has no successor, reconcileSuccessor
        // settles the run straight away and completeRun needs `__digestUntil` to be present to
        // close the window this run already processed.
        reconciledRun = { ...run, context: nextContext };
      }
      await reconcileSuccessor(reconciledRun, findNextNodeId(graph, node.id), graph);
      return;
    }
    case 'end':
      if (!TERMINAL_RUN_STATUSES.has(run.status)) {
        await completeRun(run);
      }
      return;
    default:
      // Trigger nodes never record a SUCCESS step run, so this is unreachable in practice.
      return;
  }
}

async function recordUnhandleableStepFailure(
  runId: string,
  nodeId: string,
  nodeType: string,
  message: string,
  attempt: number
): Promise<void> {
  logger.error(`[Automation Engine] ${message}`);
  Sentry.captureException(new Error(message));
  // Single transaction: a crash between these two writes would otherwise leave the run
  // non-terminal, causing redelivery to hit this same branch again and insert a duplicate
  // FAILED step run for the same node.
  await prisma.$transaction(async (tx) => {
    const txRepo = createAutomationRepository(withPrisma(tx as any));
    await txRepo.createStepRun({
      id: generateId(),
      runId,
      nodeId,
      nodeType,
      status: 'FAILED',
      errorMessage: message,
      attempt,
      finishedAt: new Date(),
    });
    await txRepo.updateRun(runId, { status: 'FAILED', completedAt: new Date() });
  });
}

export async function executeAutomationStep(job: JobWithMetadata<AutomationStepJobData>): Promise<void> {
  const { runId, nodeId } = job.data;

  const existingSuccess = await automationRepository.findExecutedStepRun(runId, nodeId);

  const run = await automationRepository.findRunByIdWithAutomation(runId);
  if (!run) {
    logger.error(`[Automation Engine] Run ${runId} not found — dropping job`);
    return;
  }

  if (TERMINAL_RUN_STATUSES.has(run.status)) {
    logger.info(`[Automation Engine] Run ${runId} already ${run.status} — skipping step ${nodeId}`);
    return;
  }

  const graph = run.graphSnapshot as unknown as AutomationGraph;
  const node = findNode(graph, nodeId);
  if (!node) {
    await recordUnhandleableStepFailure(
      runId,
      nodeId,
      'unknown',
      `Node ${nodeId} not found in run ${runId} graph snapshot`,
      job.retryCount + 1
    );
    return;
  }

  if (existingSuccess) {
    logger.info(
      `[Automation Engine] Step ${nodeId} for run ${runId} already ran (${existingSuccess.status}) — verifying the successor was enqueued before skipping redelivery`
    );
    return reconcileSuccessStep(run, node, graph, existingSuccess);
  }

  switch (node.type) {
    case 'delay':
      return handleDelayNode(run, node, graph);
    case 'condition':
      return handleConditionNode(run, node, graph);
    case 'action':
      return handleActionNode(run, node, graph, job);
    case 'digest':
      return handleDigestNode(run, node, graph, job);
    case 'end':
      return handleEndNode(run, node);
    default:
      return recordUnhandleableStepFailure(
        runId,
        nodeId,
        node.type,
        `Unexpected node type for node ${nodeId} in run ${runId}`,
        job.retryCount + 1
      );
  }
}

export async function registerAutomationWorker(boss: PgBoss): Promise<void> {
  await boss.work(
    AUTOMATION_QUEUE,
    { includeMetadata: true },
    async (jobs: JobWithMetadata<AutomationStepJobData>[]) => {
      for (const job of jobs) {
        await executeAutomationStep(job);
      }
    }
  );
}

export async function initializeAutomationEngine(): Promise<void> {
  const boss = await startAutomationBoss();
  if (!boss) return;
  await registerAutomationWorker(boss);
  logger.info(`[Automation Engine] Worker registered on queue: ${AUTOMATION_QUEUE}`);
}

export async function shutdownAutomationEngine(): Promise<void> {
  await stopAutomationBoss();
}
