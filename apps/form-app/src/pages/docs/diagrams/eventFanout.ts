import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/02-event-fanout.md`.
 *
 * Laid out left-to-right with the emitter as a single hub, because the point of
 * the page is that the three listeners are peers — none of them calls the
 * others, and none of them is referenced from the submission resolver.
 */
export const eventFanout: DocDiagram = {
  direction: 'LR',
  nodes: [
    {
      id: 'submit',
      data: {
        label: 'submitResponse',
        kind: 'entry',
        file: 'apps/backend/src/graphql/resolvers/responses.ts',
        line: 362,
        does: 'Calls emitFormSubmitted once, after the response row is written.',
        note: 'This one line is the only connection between form submission and three major features.',
      },
    },
    {
      id: 'emitter',
      data: {
        label: 'plugin:event emitter',
        kind: 'effect',
        file: 'apps/backend/src/plugins/core/events.ts',
        line: 6,
        does: 'A single module-level Node EventEmitter that every listener subscribes to.',
        note: 'In-process and non-durable. If the backend restarts mid-flight, that work is lost — each listener arranges its own durability.',
        shared: 'The hub: 3 independent listeners',
      },
    },
    {
      id: 'pluginExec',
      data: {
        label: 'Listener 1 — plugins',
        kind: 'effect',
        file: 'apps/backend/src/plugins/core/executor.ts',
        line: 81,
        does: 'Runs every enabled plugin on the form whose events array contains this event type.',
        note: 'Sequential, never parallel — two plugins of the same type would otherwise race on response.metadata.',
      },
    },
    {
      id: 'automationTrigger',
      data: {
        label: 'Listener 2 — automations',
        kind: 'effect',
        file: 'apps/backend/src/services/automation/triggerService.ts',
        line: 23,
        does: 'Creates an AutomationRun per matching active automation and enqueues its first step.',
        note: 'Deliberately a second listener rather than a call from inside listener 1, so automations can never change plugin behaviour or submission latency.',
      },
    },
    {
      id: 'pdfAutoRun',
      data: {
        label: 'Listener 3 — PDF auto-run',
        kind: 'effect',
        file: 'apps/backend/src/plugins/core/pdfGeneratorAutoRun.ts',
        does: 'Generates a document for the new response, for each PDF generator with autoRunOnSubmit enabled.',
      },
    },
    {
      id: 'delivery',
      data: {
        label: 'PluginDelivery',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 536,
        does: 'One row per plugin attempt, success or failure, with the payload and response.',
        note: 'There is no automatic plugin retry — this table is the record of what happened.',
      },
    },
    {
      id: 'run',
      data: {
        label: 'AutomationRun',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 606,
        does: 'Holds a snapshot of the automation graph as it was when the run started.',
        note: 'Snapshotting is what lets someone edit an automation without corrupting runs already in flight.',
      },
    },
    {
      id: 'boss',
      data: {
        label: 'pg-boss queue',
        kind: 'store',
        file: 'apps/backend/src/services/automation/boss.ts',
        does: 'Durable job queue backing every automation step, delay and retry.',
        note: 'Steps are keyed on runId:nodeId, so the same step cannot be enqueued twice.',
      },
    },
    {
      id: 'pdfResult',
      data: {
        label: 'PdfGenerationResult',
        kind: 'store',
        file: 'apps/backend/src/services/pdfGeneratorService.ts',
        does: 'Records the generated document and its location in the private bucket.',
      },
    },
    {
      id: 'r2',
      data: {
        label: 'Private R2 bucket',
        kind: 'external',
        file: 'apps/backend/src/services/fileUploadService.ts',
        does: 'Stores the generated PDF. No public access — downloads go through pre-signed URLs.',
      },
    },
  ],
  edges: [
    { source: 'submit', target: 'emitter' },
    { source: 'emitter', target: 'pluginExec', async: true },
    { source: 'emitter', target: 'automationTrigger', async: true },
    { source: 'emitter', target: 'pdfAutoRun', async: true },
    { source: 'pluginExec', target: 'delivery' },
    { source: 'automationTrigger', target: 'run' },
    { source: 'automationTrigger', target: 'boss' },
    { source: 'pdfAutoRun', target: 'pdfResult' },
    { source: 'pdfResult', target: 'r2' },
  ],
};
