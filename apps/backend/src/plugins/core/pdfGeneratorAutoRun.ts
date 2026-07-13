import { generateId } from '@dculus/utils';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { applyResponseFilters } from '../../services/responseFilterService.js';
import { generateSinglePdfForGenerator } from '../../services/pdfGenerationJobService.js';
import { getEventEmitter } from './events.js';
import type { PluginEvent } from './types.js';

/**
 * Auto-generates PDFs for newly-submitted responses that match a
 * PdfGenerator's filter with autoRunOnSubmit enabled. A parallel listener on
 * the same plugin event emitter used by executePluginsForForm — deliberately
 * NOT modeled as a FormPlugin (see PDF Generators design notes): plugin
 * management is EDITOR/OWNER-scoped and framed around third-party
 * integrations, whereas this is a same-form-owner feature with its own
 * VIEWER-level single-response generation semantics.
 *
 * Note: this taps plugins/core/events.ts's emitFormSubmitted, not the
 * unrelated subscriptions/events.ts emitFormSubmitted (usage tracking) —
 * both exist in this codebase under the same exported name.
 */
export const initializePdfGeneratorAutoRun = (): void => {
  getEventEmitter().on('plugin:event', async (event: PluginEvent) => {
    if (event.type !== 'form.submitted') return;

    try {
      await runAutoGenerators(event);
    } catch (error) {
      logger.error('[PDF Generator Auto-Run] Error handling form.submitted event:', error);
    }
  });
};

async function runAutoGenerators(event: PluginEvent): Promise<void> {
  const responseId = event.data?.responseId;
  if (!responseId) return;

  const generators = await prisma.pdfGenerator.findMany({
    where: { formId: event.formId, enabled: true, autoRunOnSubmit: true },
  });
  if (generators.length === 0) return;

  const responseForFilter = { id: responseId, data: event.data };

  for (const generator of generators) {
    const matches = applyResponseFilters(
      [responseForFilter],
      generator.filters as any,
      generator.filterLogic as 'AND' | 'OR'
    );
    if (matches.length === 0) continue;

    // Wrapped in a trivial single-response PdfGenerationRun so the Generators
    // list's "last run" column has consistent audit visibility regardless of
    // trigger (manual bulk run vs. auto-run-on-submit).
    const run = await prisma.pdfGenerationRun.create({
      data: {
        id: generateId(),
        generatorId: generator.id,
        trigger: 'auto',
        status: 'running',
        totalCount: 1,
      },
    });

    try {
      await generateSinglePdfForGenerator(generator.id, responseId);
      await prisma.pdfGenerationRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          processedCount: 1,
          succeededCount: 1,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(
        `[PDF Generator Auto-Run] Failed to generate PDF for generator ${generator.id}, response ${responseId}:`,
        error
      );
      await prisma.pdfGenerationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          processedCount: 1,
          failedCount: 1,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
    }
  }
}
