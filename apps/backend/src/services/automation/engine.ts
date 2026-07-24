import type { PgBoss, JobWithMetadata } from 'pg-boss';
import * as Sentry from '@sentry/node';
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

async function handleDelayNode(
  run: { id: string },
  node: Extract<AutomationNode, { type: 'delay' }>,
  graph: AutomationGraph
): Promise<void> {
  const { amount, unit } = node.data;
  const requestedMs = amount * (DELAY_UNIT_MS[unit] ?? DELAY_UNIT_MS.minutes);
  const delayMs = Math.min(requestedMs, MAX_DELAY_MS);
  const delayUntil = new Date(Date.now() + delayMs);

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

  const nextNodeId = findNextNodeId(graph, node.id);
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
    automation: { status: string; formId: string; organizationId: string; triggerType: string };
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
      createPluginContext()
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

export async function executeAutomationStep(job: JobWithMetadata<AutomationStepJobData>): Promise<void> {
  const { runId, nodeId } = job.data;

  const existingSuccess = await prisma.automationStepRun.findFirst({
    where: { runId, nodeId, status: 'SUCCESS' },
  });
  if (existingSuccess) {
    logger.info(`[Automation Engine] Step ${nodeId} for run ${runId} already succeeded — skipping redelivery`);
    return;
  }

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
    logger.error(`[Automation Engine] Node ${nodeId} not found in run ${runId} graph snapshot`);
    await prisma.automationRun.update({
      where: { id: runId },
      data: { status: 'FAILED', completedAt: new Date() },
    });
    return;
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
      logger.error(`[Automation Engine] Unexpected node type for node ${nodeId} in run ${runId}`);
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: 'FAILED', completedAt: new Date() },
      });
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
