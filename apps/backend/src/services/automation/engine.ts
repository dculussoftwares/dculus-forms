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
// A digest node's very first tick has no prior completed run to be incremental against. Rather
// than defaulting to automation.createdAt (which excludes every response that existed before the
// automation itself was created — the common case, since automations are normally built against
// forms that already have data), the first run has no lower bound at all: it matches everything
// currently satisfying the node's filters, exactly once. Every run after that IS anchored on the
// previous completed run's startedAt (see handleDigestNode below), so it stays incremental and
// never reprocesses the same response twice.
const DIGEST_EPOCH_START = new Date(0);
/** Node types whose job gets pg-boss retries — both make a DB/network call that can transiently fail. */
const RETRYABLE_NODE_TYPES = new Set(['action', 'digest']);

type AutomationStepJobData = { runId: string; nodeId: string };

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

async function completeRun(runId: string): Promise<void> {
  await automationRepository.updateRun(runId, { status: 'COMPLETED', completedAt: new Date() });
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
    data: context.triggerData ?? {},
    timestamp: run.startedAt,
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
 * Pages through `getResponsesByFormId` (reusing the existing __submittedAt/DATE_AFTER filter —
 * indexed via Response's @@index([formId, submittedAt]), zero new SQL) to collect up to
 * `maxResponses` responses submitted since `since` AND matching every rule in `extraFilters`
 * (ANDed — see AutomationDigestNode's data doc comment in types.ts for why only AND is
 * supported), oldest-first. Uses a fixed page size across calls (required for correct
 * skip/page-number math) and slices the final page down to `maxResponses` rather than shrinking
 * the page size, which would break pagination. `total` comes from the first page's DB-computed
 * count — accurate even when the result is truncated, so no separate COUNT query is needed.
 */
async function fetchDigestResponses(
  formId: string,
  since: Date,
  maxResponses: number,
  extraFilters: ConditionRule[] = []
): Promise<{ responses: DigestResponseSummary[]; total: number }> {
  const responses: DigestResponseSummary[] = [];
  let total = 0;
  let page = 1;
  const filters: ResponseFilter[] = [
    { fieldId: '__submittedAt', operator: 'DATE_AFTER', value: since.toISOString() },
    ...extraFilters,
  ];

  while (responses.length < maxResponses) {
    const pageResult = await getResponsesByFormId(
      formId,
      page,
      DIGEST_PAGE_SIZE,
      'submittedAt',
      'asc',
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

  return { responses, total };
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
  run: { id: string; context: unknown },
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
      await completeRun(run.id);
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
    await completeRun(run.id);
    return;
  }

  await automationRepository.updateRun(run.id, { status: 'WAITING', currentNodeId: nextNodeId });
  await enqueueStep(run.id, nextNodeId, graph, delayUntil);
}

async function handleConditionNode(
  run: { id: string; context: unknown },
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
    await completeRun(run.id);
    return;
  }

  await automationRepository.updateRun(run.id, { currentNodeId: nextNodeId });
  await enqueueStep(run.id, nextNodeId, graph);
}

/**
 * Filter Responses node: queries responses matching this node's filters — since the automation's
 * last COMPLETED run on every tick after the first (graphValidator guarantees this node is the
 * trigger's sole successor on a schedule-triggerType automation — see that file for the "must
 * follow trigger directly" rule), or with no lower bound at all on the very first tick (see
 * DIGEST_EPOCH_START above) — and merges a bounded summary into context for downstream
 * condition/action nodes. Gets pg-boss retries like action nodes (RETRYABLE_NODE_TYPES) since
 * the query is a real DB call that can transiently fail.
 */
async function handleDigestNode(
  run: {
    id: string;
    context: unknown;
    automation: { id: string; formId: string };
  },
  node: Extract<AutomationNode, { type: 'digest' }>,
  graph: AutomationGraph,
  job: JobWithMetadata<AutomationStepJobData>
): Promise<void> {
  const maxResponses = Math.min(
    node.data.maxResponses ?? DIGEST_RESPONSE_SAFETY_CEILING,
    DIGEST_RESPONSE_SAFETY_CEILING
  );
  const attempt = job.retryCount + 1;

  try {
    const lastCompletedRun = await automationRepository.findLastCompletedRun(run.automation.id);
    const since = lastCompletedRun?.startedAt ?? DIGEST_EPOCH_START;
    const until = new Date();

    const { responses, total } = await fetchDigestResponses(
      run.automation.formId,
      since,
      maxResponses,
      node.data.filters ?? []
    );

    const output: DigestNodeOutput = {
      count: total,
      since: since.toISOString(),
      until: until.toISOString(),
      truncated: total > responses.length,
      responses,
    };

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

    await automationRepository.updateRun(run.id, {
      context: mergeStepOutput(mergeDigestIntoTriggerData(run.context, output), node.id, output),
    });

    const nextNodeId = findNextNodeId(graph, node.id);
    if (!nextNodeId) {
      await completeRun(run.id);
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
  run: { id: string },
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
  await completeRun(run.id);
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

  if (run.automation.status !== 'ACTIVE') {
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

  const event = buildPluginEvent(run.automation, run);
  // A digest-downstream email action with recipientFieldId set sends once PER matched response
  // (email/handler.ts's per-response loop), each substituting {{field}} mentions against that
  // response's own data — substituteMentions() replaces any UNMATCHED key with a "[label]"
  // fallback (packages/utils/src/mentionSubstitution.ts), so pre-substituting here against the
  // aggregate event.data (which has no real field values, only __digest* scalars) would destroy
  // the {{field}} placeholders before the handler ever gets a chance to fill them in per response.
  const isPerResponseEmailAction =
    actionType === 'email' && Boolean(config.recipientFieldId) && Array.isArray(event.data.__digestResponses);
  const substitutedConfig = isPerResponseEmailAction
    ? (config as PluginConfig)
    : (substituteConfigMentions(config, event.data) as PluginConfig);

  try {
    const handler = getPluginHandler(actionType);
    if (!handler) {
      throw new Error(`No handler registered for action type: ${actionType}`);
    }

    const result = await handler(
      { id: `${run.id}:${node.id}`, config: substitutedConfig },
      event,
      createPluginContext((newConfig) =>
        updateAutomationNodeConfig(run.automation.id, run.id, node.id, newConfig)
      )
    );

    await automationRepository.createStepRun({
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType,
      status: 'SUCCESS',
      output: result ?? {},
      attempt,
      finishedAt: new Date(),
    });

    await automationRepository.updateRun(run.id, {
      context: mergeStepOutput(run.context, node.id, result),
    });

    const nextNodeId = findNextNodeId(graph, node.id);
    if (!nextNodeId) {
      await completeRun(run.id);
      return;
    }
    await enqueueStep(run.id, nextNodeId, graph);
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[Automation Engine] Action step failed: run=${run.id} node=${node.id}`, error);

    await automationRepository.createStepRun({
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType,
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

    // Rethrow so pg-boss schedules the retry per the job's retryLimit/retryBackoff.
    throw error;
  }
}

/**
 * Advances past a node whose SUCCESS AutomationStepRun is already on record, verifying (rather
 * than assuming) that the successor was actually enqueued before redelivery is allowed to be a
 * no-op. Reconstructs the successor decision from the persisted step output — never re-derives
 * it (e.g. re-evaluating a condition or re-running a handler), since the recorded outcome is the
 * one that already happened.
 */
async function reconcileSuccessor(
  run: { id: string; status: string },
  nextNodeId: string | null,
  graph: AutomationGraph,
  startAfter?: Date
): Promise<void> {
  if (!nextNodeId) {
    if (run.status !== 'COMPLETED') {
      await completeRun(run.id);
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
  run: { id: string; status: string; context: unknown },
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
      if (output && context.triggerData?.__digestCount === undefined) {
        await automationRepository.updateRun(run.id, {
          context: mergeStepOutput(mergeDigestIntoTriggerData(run.context, output), node.id, output),
        });
      }
      await reconcileSuccessor(run, findNextNodeId(graph, node.id), graph);
      return;
    }
    case 'end':
      if (run.status !== 'COMPLETED') {
        await completeRun(run.id);
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

  const existingSuccess = await automationRepository.findSuccessStepRun(runId, nodeId);

  const run = await automationRepository.findRunByIdWithAutomation(runId);
  if (!run) {
    logger.error(`[Automation Engine] Run ${runId} not found — dropping job`);
    return;
  }

  if (run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELLED') {
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
      `[Automation Engine] Step ${nodeId} for run ${runId} already succeeded — verifying the successor was enqueued before skipping redelivery`
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
