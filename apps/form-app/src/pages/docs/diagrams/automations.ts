import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/04-automations.md`.
 *
 * The loop back from "record step" to the queue is the whole engine: there is no
 * long-running process holding a run in memory, only a chain of independent jobs
 * each of which enqueues the next. Drawn as a forward edge with a label rather
 * than a real back-edge, since a cycle would force dagre to break it somewhere
 * arbitrary.
 */
export const automations: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'event',
      data: {
        label: 'Event trigger',
        kind: 'entry',
        file: 'apps/backend/src/services/automation/triggerService.ts',
        line: 23,
        does: 'Matches active automations on formId and trigger type when a response is submitted or edited.',
        note: 'Skips preview submissions, and refuses to create a run from an edit that an automation itself caused.',
      },
    },
    {
      id: 'cron',
      data: {
        label: 'Schedule trigger',
        kind: 'entry',
        file: 'apps/backend/src/services/automation/boss.ts',
        does: 'A pg-boss cron tick on the shared automation-cron queue, keyed per automation.',
        note: 'boss.schedule upserts by (queue, key), so registering the same schedule twice across a multi-instance deploy is harmless.',
      },
    },
    {
      id: 'createRun',
      data: {
        label: 'Create the run',
        kind: 'write',
        file: 'apps/backend/src/repositories/automationRepository.ts',
        does: 'Writes an AutomationRun holding a frozen copy of the graph plus the automation version.',
        note: 'From here the live Automation.graph is irrelevant to this run — editing the automation cannot disturb work already in flight.',
        shared: 'Snapshot read by the Runs UI',
      },
    },
    {
      id: 'queue',
      data: {
        label: 'pg-boss step job',
        kind: 'store',
        file: 'apps/backend/src/services/automation/engine.ts',
        line: 46,
        does: 'One durable job per node, carrying { runId, nodeId }, keyed on runId:nodeId so a step can never be queued twice.',
        note: 'Action nodes get retryLimit 3 with backoff; delays and conditions are deterministic and are not retried.',
      },
    },
    {
      id: 'delay',
      data: {
        label: 'Delay node',
        kind: 'effect',
        file: 'apps/backend/src/services/automation/engine.ts',
        line: 155,
        does: 'Sets the run WAITING and re-enqueues the successor with pg-boss startAfter, capped at 30 days.',
        note: 'Nothing is held in memory — a two-week delay survives any number of restarts because it lives in the job table.',
      },
    },
    {
      id: 'condition',
      data: {
        label: 'Condition node',
        kind: 'effect',
        file: 'apps/backend/src/services/automation/conditionEvaluator.ts',
        does: 'Evaluates the rules against the trigger data and follows the true or false edge.',
        note: 'The branch taken is written into the step output, which is what crash recovery replays instead of re-evaluating.',
      },
    },
    {
      id: 'action',
      data: {
        label: 'Action node',
        kind: 'effect',
        file: 'apps/backend/src/services/automation/engine.ts',
        line: 254,
        does: 'Substitutes field mentions into the config, then calls getPluginHandler(actionType).',
        note: 'There is no separate action abstraction — an action IS a plugin handler, invoked with a synthetic plugin id of runId:nodeId.',
        shared: 'Uses the plugin registry',
      },
    },
    {
      id: 'record',
      data: {
        label: 'Record step, enqueue next',
        kind: 'write',
        file: 'apps/backend/prisma/schema.prisma',
        line: 629,
        does: 'Writes an AutomationStepRun with the outcome, then enqueues the successor — looping back to the queue above.',
        note: 'On redelivery the engine verifies the successor was actually enqueued rather than assuming it, closing the crash window between these two writes.',
      },
    },
    {
      id: 'complete',
      data: {
        label: 'Run reaches a terminal state',
        kind: 'write',
        file: 'apps/backend/src/services/automation/engine.ts',
        line: 42,
        does: 'COMPLETED when a node has no successor, FAILED on a final failed attempt, CANCELLED if the automation was paused mid-run.',
      },
    },
  ],
  edges: [
    { source: 'event', target: 'createRun' },
    { source: 'cron', target: 'createRun' },
    { source: 'createRun', target: 'queue' },
    { source: 'queue', target: 'delay' },
    { source: 'queue', target: 'condition' },
    { source: 'queue', target: 'action' },
    { source: 'delay', target: 'record' },
    { source: 'condition', target: 'record' },
    { source: 'action', target: 'record' },
    { source: 'record', target: 'complete', label: 'or back to the queue', async: true },
  ],
};
