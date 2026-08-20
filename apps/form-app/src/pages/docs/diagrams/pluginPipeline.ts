import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/05-plugin-pipeline.md`.
 *
 * Top-to-bottom: an eight-rank left-to-right chain shrinks to roughly 45% at
 * fit-to-view, which is below the point the file references stay readable.
 *
 * The registry and the context feed the handler from the side rather than
 * sitting in the chain — both are things the handler is *given*, and both are
 * shared with the automation engine, which the chain shape shouldn't imply.
 */
export const pluginPipeline: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'event',
      data: {
        label: 'plugin:event',
        kind: 'entry',
        file: 'apps/backend/src/plugins/core/events.ts',
        line: 12,
        does: 'form.submitted, response.edited or plugin.test arrives on the shared emitter.',
      },
    },
    {
      id: 'select',
      data: {
        label: 'Select matching plugins',
        kind: 'gate',
        file: 'apps/backend/src/plugins/core/executor.ts',
        line: 88,
        does: 'Queries plugins on this form that are enabled and whose events array contains this event type.',
        note: 'That events filter is why adding a new event type is always safe — existing plugins ignore it until they opt in.',
      },
    },
    {
      id: 'loop',
      data: {
        label: 'Run sequentially',
        kind: 'effect',
        file: 'apps/backend/src/plugins/core/executor.ts',
        line: 107,
        does: 'Executes each matching plugin one after another, never in parallel.',
        note: 'A correctness requirement, not a performance choice: several plugin types read-modify-write the same response.metadata column.',
      },
    },
    {
      id: 'registry',
      data: {
        label: 'Handler registry',
        kind: 'store',
        file: 'apps/backend/src/plugins/core/registry.ts',
        does: 'A Map from type name to handler, populated as an import side effect at boot.',
        note: 'webhook, email, quiz, ai-tagger, google-sheets, microsoft-sheets. Registering a duplicate type warns and overwrites rather than throwing. quiz is deprecated (#303, native quiz mode replaces it) but its handler stays registered — existing instances still execute.',
        shared: 'Also used by automation action nodes',
      },
    },
    {
      id: 'context',
      data: {
        label: 'Plugin context',
        kind: 'effect',
        file: 'apps/backend/src/plugins/core/context.ts',
        does: 'Gives the handler prisma, a few loaders, sendEmail, a logger, and updatePluginConfig.',
        note: 'updatePluginConfig is supplied per caller — a handler never knows whether it was invoked as a plugin or as an automation action.',
        shared: 'Two persistence strategies',
      },
    },
    {
      id: 'handler',
      data: {
        label: 'Handler',
        kind: 'effect',
        file: 'apps/backend/src/plugins/webhook/handler.ts',
        does: 'Does the actual outbound work — posts the webhook, sends the email, appends the spreadsheet row, grades the quiz.',
        note: 'One per plugin type, all with the same three-argument signature. The path here is the webhook one as a concrete example.',
      },
    },
    {
      id: 'delivery',
      data: {
        label: 'PluginDelivery',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 536,
        does: 'One row per attempt with the payload, the result or error, and success/failed status.',
        note: 'There is no automatic retry anywhere in this pipeline — this table is the entire record of what was tried.',
        shared: 'Read by the delivery log UI',
      },
    },
    {
      id: 'exports',
      data: {
        label: 'Export columns',
        kind: 'effect',
        file: 'apps/backend/src/plugins/core/exportRegistry.ts',
        does: 'Lets a plugin type contribute extra columns to Excel and CSV exports, driven by response.metadata.',
        note: 'Metadata keys come in two shapes — legacy bare type, and instance-scoped type:pluginId. Always resolve them via pluginTypeFromMetadataKey.',
        shared: 'Consumed by unifiedExportService',
      },
    },
    {
      id: 'backfill',
      data: {
        label: 'Backfill job',
        kind: 'effect',
        file: 'apps/backend/src/plugins/core/backfill.ts',
        does: 'Replays a newly added plugin over existing responses, 20 at a time with a 500ms pause.',
        note: 'Skips responses that already have a successful delivery for this plugin, so re-running a backfill cannot double-deliver.',
      },
    },
  ],
  edges: [
    { source: 'event', target: 'select' },
    { source: 'select', target: 'loop' },
    { source: 'loop', target: 'handler' },
    { source: 'registry', target: 'handler', label: 'lookup by type' },
    { source: 'context', target: 'handler', label: 'injected' },
    { source: 'handler', target: 'delivery' },
    { source: 'delivery', target: 'exports', async: true },
    { source: 'backfill', target: 'loop', label: 'replays old responses', async: true },
  ],
};
