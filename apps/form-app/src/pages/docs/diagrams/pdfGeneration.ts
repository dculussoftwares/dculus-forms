import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/06-pdf-generation.md`.
 *
 * Top-to-bottom, with all three prerequisites for a run (the design, the saved
 * generator, and whatever started it) converging on one node rather than
 * chaining — the four-model relationship is what readers need disentangled, and
 * a nine-rank linear chain would shrink the labels past readable.
 *
 * Template hydration is folded into the run node; "build inputs" keeps its own
 * box because the three binding conventions are the single most consulted thing
 * on this page.
 */
export const pdfGeneration: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'template',
      data: {
        label: 'PdfTemplate',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 428,
        does: 'The pdfme design: element positions plus the field bindings placed on them.',
        note: 'For an uploaded base PDF the bytes are stripped out and kept in private R2 under fileKey — the JSON column stores layout, not a document.',
      },
    },
    {
      id: 'generator',
      data: {
        label: 'PdfGenerator',
        kind: 'store',
        file: 'apps/backend/src/services/pdfGeneratorService.ts',
        does: 'A saved template plus response filters, autoRunOnSubmit, a column name and a filename field.',
        note: 'columnName is locked once set — it is the Responses table header, and changing it after exports referenced it would be confusing.',
        shared: 'Filters reuse the responses-table engine',
      },
    },
    {
      id: 'trigger',
      data: {
        label: 'Manual run or auto-run',
        kind: 'entry',
        file: 'apps/backend/src/plugins/core/pdfGeneratorAutoRun.ts',
        does: 'A run started from the Generators UI, or the form.submitted listener when autoRunOnSubmit is set.',
      },
    },
    {
      id: 'run',
      data: {
        label: 'PdfGenerationRun',
        kind: 'write',
        file: 'apps/backend/src/services/pdfGenerationJobService.ts',
        line: 107,
        does: 'Creates the run, hydrates the template from private R2, then walks responses in batches of 10.',
        note: 'Progress is written after every response rather than every batch, because stalled-run detection reads updatedAt and a slow batch would otherwise look hung.',
      },
    },
    {
      id: 'bind',
      data: {
        label: 'Build inputs',
        kind: 'effect',
        file: 'apps/backend/src/services/pdfTemplateService.ts',
        line: 369,
        does: 'Resolves each element to a value using three binding conventions, checked in order.',
        note: 'dculusFieldId beats dculusTextTemplate beats legacy {{fieldId}}. A missing or deleted field resolves to an empty string, never an error.',
        shared: 'Binding order is load-bearing',
      },
    },
    {
      id: 'render',
      data: {
        label: '@pdfme/generator',
        kind: 'external',
        file: 'apps/backend/src/services/pdfTemplateService.ts',
        line: 427,
        does: 'Renders the filled PDF, with Roboto as fallback plus Noto Sans Tamil.',
        note: 'The Tamil face is not optional dressing — without it, Tamil answers render as blank glyphs rather than failing loudly.',
      },
    },
    {
      id: 'result',
      data: {
        label: 'PdfGenerationResult',
        kind: 'write',
        file: 'apps/backend/prisma/schema.prisma',
        line: 494,
        does: 'One row per response, success or failure, unique on (generatorId, responseId).',
        note: 'A per-response failure never fails the run — it is recorded and the loop moves on.',
        shared: 'Rendered as a Responses table cell',
      },
    },
    {
      id: 'bucket',
      data: {
        label: 'Private R2 bucket',
        kind: 'external',
        file: 'apps/backend/src/services/pdfGeneratorStorage.ts',
        does: 'Stores the generated PDF. No public URL — downloads go through pre-signed URLs, bulk download through the ZIP service.',
      },
    },
  ],
  edges: [
    { source: 'template', target: 'run', label: 'design' },
    { source: 'generator', target: 'run', label: 'which responses' },
    { source: 'trigger', target: 'run' },
    { source: 'run', target: 'bind' },
    { source: 'bind', target: 'render' },
    { source: 'render', target: 'result' },
    { source: 'result', target: 'bucket' },
  ],
};
