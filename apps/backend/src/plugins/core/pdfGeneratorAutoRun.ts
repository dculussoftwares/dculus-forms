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
// Auto-run is triggered by public submissions, so renders are bounded: at most a few at a time in
// this process, and at most N per form per minute (excess submissions are skipped, not queued).
export const AUTO_RUN_MAX_CONCURRENT = 3;
export const AUTO_RUN_MAX_PER_FORM_PER_MINUTE = 30;
const formWindows = new Map<string, { start: number; count: number }>();
let activeRenders = 0;
const renderWaiters: Array<() => void> = [];

export const allowAutoRun = (formId: string, now = Date.now()): boolean => {
  const window = formWindows.get(formId);
  if (!window || now - window.start >= 60_000) {
    formWindows.set(formId, { start: now, count: 1 });
    return true;
  }
  window.count += 1;
  return window.count <= AUTO_RUN_MAX_PER_FORM_PER_MINUTE;
};

export const resetAutoRunLimits = (): void => {
  formWindows.clear();
  activeRenders = 0;
  renderWaiters.length = 0;
};

async function withRenderSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeRenders >= AUTO_RUN_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => renderWaiters.push(resolve));
  } else {
    activeRenders += 1;
  }
  try {
    return await task();
  } finally {
    const next = renderWaiters.shift();
    if (next) next();
    else activeRenders -= 1;
  }
}

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

  if (!allowAutoRun(event.formId)) {
    logger.warn(`[PDF Generator Auto-Run] Rate limit reached for form ${event.formId}; skipping response ${responseId}`);
    return;
  }

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
      await withRenderSlot(() => generateSinglePdfForGenerator(generator.id, responseId));
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
