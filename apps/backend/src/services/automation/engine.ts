import type { PgBoss, JobWithMetadata } from 'pg-boss';
import * as Sentry from '@sentry/node';
import { Prisma } from '#prisma-client';
import { generateId, substituteMentions } from '@dculus/utils';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { getPluginHandler } from '../../plugins/core/registry.js';
import { createPluginContext } from '../../plugins/core/context.js';
import type { PluginConfig, PluginEvent } from '../../plugins/core/types.js';
import { AUTOMATION_QUEUE, getBoss, startAutomationBoss, stopAutomationBoss } from './boss.js';
import { evaluateCondition } from './conditionEvaluator.js';
import type { AutomationEdge, AutomationGraph, AutomationNode, AutomationRunContext } from './types.js';

const DELAY_UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 60 * 60_000,
  days: 24 * 60 * 60_000,
};

const MAX_DELAY_MS = 30 * DELAY_UNIT_MS.days;
export const ACTION_RETRY_LIMIT = 3;

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
  await prisma.automationRun.update({
    where: { id: runId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
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

  const isAction = findNode(graph, nodeId)?.type === 'action';

  await boss.send(
    AUTOMATION_QUEUE,
    { runId, nodeId },
    {
      singletonKey: `${runId}:${nodeId}`,
      ...(startAfter ? { startAfter } : {}),
      ...(isAction ? { retryLimit: ACTION_RETRY_LIMIT, retryBackoff: true } : {}),
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
    // Trigger types beyond 'form.submitted' (response.edited, schedule — #194/#201) aren't
    // real PluginEvent variants yet; this cast preserves the "PluginEvent-shaped event"
    // contract from the issue without prematurely widening PluginEvent's own union.
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
 * Builds (without executing) an atomic UPDATE that replaces one node's `data.config` inside a
 * `{ nodes: [...], edges: [...] }` JSON column, leaving every other node untouched. Returns
 * the unresolved `$executeRaw` PrismaPromise so callers can batch it into `$transaction`.
 *
 * Because each single statement's `SET column = jsonb_set(column, ...)` re-reads the row's
 * latest *committed* value at execution time — not a value cached in application memory —
 * two concurrent writes targeting DIFFERENT nodes in the same graph correctly compose:
 * Postgres serializes the two UPDATEs (the second waits for the first to commit, then
 * evaluates against its result), so neither writer's change is lost to the other.
 *
 * This does NOT protect two concurrent *runs* writing to the SAME node from each other. Each
 * run computes its own full replacement `data.config` from whatever it read when its own
 * execution started; if two runs of the same automation both reach the "auto-create
 * spreadsheet/workbook" branch for the same action node before either has persisted an
 * id, each creates its own resource and whichever write lands last wins — the other run's
 * newly created spreadsheet/workbook is silently orphaned (created, but never referenced
 * again). Accepted as a narrow edge case for now: it can only surface on an action's very
 * first-ever execution, and no response data is lost (every run's row still lands in *some*
 * spreadsheet). Closing it fully would mean serializing the auto-create branch itself — e.g.
 * a per-node advisory lock or `SELECT ... FOR UPDATE` before that branch runs — not just this
 * config write.
 */
function jsonSetNodeConfigQuery(
  table: 'automation' | 'automation_run',
  column: 'graph' | 'graphSnapshot',
  rowId: string,
  nodeId: string,
  config: PluginConfig
) {
  const tableIdent = Prisma.raw(`"${table}"`);
  const columnIdent = Prisma.raw(`"${column}"`);
  const configJson = JSON.stringify(config);

  return prisma.$executeRaw(Prisma.sql`
    UPDATE ${tableIdent}
    SET ${columnIdent} = jsonb_set(
      ${columnIdent},
      '{nodes}',
      (
        SELECT COALESCE(jsonb_agg(
          CASE WHEN elem->>'id' = ${nodeId}
            THEN jsonb_set(elem, '{data,config}', ${configJson}::jsonb, true)
            ELSE elem
          END
        ), '[]'::jsonb)
        FROM jsonb_array_elements(${columnIdent}->'nodes') AS elem
      )
    )
    WHERE id = ${rowId}
  `);
}

/**
 * Persists an action-node handler's updated config (auto-created spreadsheet/workbook ID,
 * refreshed OAuth token, etc.) for the Automations system — see `PluginContext.updatePluginConfig`
 * for why handlers can't just write to a `FormPlugin` row here.
 *
 * Writes to two places, both inside one Prisma `$transaction` so they can't diverge if one
 * write fails after the other succeeds:
 *  - `AutomationRun.graphSnapshot` for THIS run, so a retry after a transient failure (e.g.
 *    the workbook was created but the network dropped before this write) sees the
 *    already-created workbook/spreadsheet instead of creating a duplicate.
 *  - `Automation.graph`, the live graph, so the NEXT run — which snapshots fresh from this
 *    column — reuses the same workbook/spreadsheet and refreshed token too.
 */
async function updateAutomationNodeConfig(
  automationId: string,
  runId: string,
  nodeId: string,
  config: PluginConfig
): Promise<void> {
  await prisma.$transaction([
    jsonSetNodeConfigQuery('automation', 'graph', automationId, nodeId, config),
    jsonSetNodeConfigQuery('automation_run', 'graphSnapshot', runId, nodeId, config),
  ]);
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
    await prisma.automationStepRun.create({
      data: {
        id: generateId(),
        runId: run.id,
        nodeId: node.id,
        nodeType: 'delay',
        status: 'SKIPPED',
        output: { fastForwarded: true, requestedDelayMs: requestedMs },
        attempt: 1,
        finishedAt: new Date(),
      },
    });

    if (!nextNodeId) {
      await completeRun(run.id);
      return;
    }

    await prisma.automationRun.update({
      where: { id: run.id },
      data: { currentNodeId: nextNodeId },
    });
    await enqueueStep(run.id, nextNodeId, graph);
    return;
  }

  await prisma.automationStepRun.create({
    data: {
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType: 'delay',
      status: 'SUCCESS',
      output: { delayUntil: delayUntil.toISOString(), capped: delayMs < requestedMs },
      attempt: 1,
      finishedAt: new Date(),
    },
  });

  if (!nextNodeId) {
    await completeRun(run.id);
    return;
  }

  await prisma.automationRun.update({
    where: { id: run.id },
    data: { status: 'WAITING', currentNodeId: nextNodeId },
  });
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

  await prisma.automationStepRun.create({
    data: {
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType: 'condition',
      status: 'SUCCESS',
      output: { result, branch: nextNodeId ? branch : 'end' },
      attempt: 1,
      finishedAt: new Date(),
    },
  });

  if (!nextNodeId) {
    await completeRun(run.id);
    return;
  }

  await prisma.automationRun.update({ where: { id: run.id }, data: { currentNodeId: nextNodeId } });
  await enqueueStep(run.id, nextNodeId, graph);
}

async function handleEndNode(
  run: { id: string },
  node: Extract<AutomationNode, { type: 'end' }>
): Promise<void> {
  await prisma.automationStepRun.create({
    data: {
      id: generateId(),
      runId: run.id,
      nodeId: node.id,
      nodeType: 'end',
      status: 'SUCCESS',
      attempt: 1,
      finishedAt: new Date(),
    },
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
    await prisma.automationStepRun.create({
      data: {
        id: generateId(),
        runId: run.id,
        nodeId: node.id,
        nodeType,
        status: 'SKIPPED',
        errorMessage: `Automation is ${run.automation.status}, not ACTIVE`,
        attempt: 1,
        finishedAt: new Date(),
      },
    });
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    return;
  }

  await prisma.automationRun.update({
    where: { id: run.id },
    data: { status: 'RUNNING', currentNodeId: node.id },
  });

  const event = buildPluginEvent(run.automation, run);
  const substitutedConfig = substituteConfigMentions(config, event.data) as PluginConfig;

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

    await prisma.automationStepRun.create({
      data: {
        id: generateId(),
        runId: run.id,
        nodeId: node.id,
        nodeType,
        status: 'SUCCESS',
        output: result ?? {},
        attempt,
        finishedAt: new Date(),
      },
    });

    await prisma.automationRun.update({
      where: { id: run.id },
      data: { context: mergeStepOutput(run.context, node.id, result) },
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

    await prisma.automationStepRun.create({
      data: {
        id: generateId(),
        runId: run.id,
        nodeId: node.id,
        nodeType,
        status: 'FAILED',
        errorMessage: error?.message || 'Unknown error',
        attempt,
        finishedAt: new Date(),
      },
    });

    const isFinalAttempt = job.retryLimit <= job.retryCount;
    if (isFinalAttempt) {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date() },
      });
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
  const successorStarted = await prisma.automationStepRun.findFirst({
    where: { runId: run.id, nodeId: nextNodeId },
  });
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
        await prisma.automationRun.update({
          where: { id: run.id },
          data: { context: mergeStepOutput(run.context, node.id, existingSuccess.output) },
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
  await prisma.$transaction([
    prisma.automationStepRun.create({
      data: {
        id: generateId(),
        runId,
        nodeId,
        nodeType,
        status: 'FAILED',
        errorMessage: message,
        attempt,
        finishedAt: new Date(),
      },
    }),
    prisma.automationRun.update({
      where: { id: runId },
      data: { status: 'FAILED', completedAt: new Date() },
    }),
  ]);
}

export async function executeAutomationStep(job: JobWithMetadata<AutomationStepJobData>): Promise<void> {
  const { runId, nodeId } = job.data;

  const existingSuccess = await prisma.automationStepRun.findFirst({
    where: { runId, nodeId, status: 'SUCCESS' },
  });

  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    include: { automation: true },
  });
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
