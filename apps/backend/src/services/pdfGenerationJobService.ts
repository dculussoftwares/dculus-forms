import type { Template, Font } from '@pdfme/common';
import { deserializeFormSchema } from '@dculus/types';
import { generateId } from '@dculus/utils';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import {
  hydrateTemplate,
  getPdfFonts,
  renderPdfForResponse,
  buildSubstitutionValues,
  buildGeneratorFilename,
} from './pdfTemplateService.js';
import { uploadGeneratedPdf } from './pdfGeneratorStorage.js';
import { getMatchingResponses } from './pdfGeneratorService.js';

/**
 * Background job loop for bulk PDF generation from a PdfGenerator's filter —
 * cloned from plugins/core/backfill.ts's in-process async-job pattern (no
 * queue infra exists in this repo). A resolver kicks a run off with
 * startPdfGenerationRun(), which creates the PdfGenerationRun row and fires
 * runPdfGenerationLoop() unawaited — the resolver returns immediately, so a
 * bulk run of any size never risks an HTTP timeout.
 */

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;
const STALLED_THRESHOLD_MS = 5 * 60 * 1000;
// getMatchingResponses() loads every one of the form's responses into memory
// before filtering (same pattern unifiedExportService uses, which caps at a
// much cheaper-per-row 50,000). PDF rendering is far heavier per item, so gate
// on the form's total live-response count up front rather than risk a
// request-path timeout/OOM on a broad or filterless generator.
const MAX_RESPONSES_PER_RUN = 5000;

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function loadGeneratorContext(generatorId: string) {
  const generator = await prisma.pdfGenerator.findUnique({
    where: { id: generatorId },
    include: { template: true },
  });
  if (!generator) {
    throw createGraphQLError('PDF generator not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  const form = await prisma.form.findUnique({
    where: { id: generator.formId },
    select: { formSchema: true },
  });
  if (!form) {
    throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
  }

  return { generator, deserializedSchema: deserializeFormSchema(form.formSchema) };
}

/**
 * Render, upload and upsert a single response's result. Shared by the bulk
 * loop, the on-demand single-response mutation, the auto-run listener, and
 * the response-edit regeneration hook — one rendering/persistence path for
 * every trigger.
 */
async function generateAndPersistResult(params: {
  generatorId: string;
  formId: string;
  templateName: string;
  filenameFieldId: string | null;
  template: Template;
  fonts: Font;
  deserializedSchema: any;
  responseId: string;
  responseData: Record<string, any>;
}): Promise<{ fileKey: string; filename: string }> {
  const {
    generatorId,
    formId,
    templateName,
    filenameFieldId,
    template,
    fonts,
    deserializedSchema,
    responseId,
    responseData,
  } = params;

  const buffer = await renderPdfForResponse(template, deserializedSchema, responseData, fonts);
  const { fileKey } = await uploadGeneratedPdf(buffer, formId, generatorId, responseId);
  const substitutionValues = buildSubstitutionValues(deserializedSchema, responseData);
  const filename = buildGeneratorFilename(filenameFieldId, substitutionValues, templateName, responseId);

  await prisma.pdfGenerationResult.upsert({
    where: { generatorId_responseId: { generatorId, responseId } },
    create: { id: generateId(), generatorId, responseId, status: 'success', fileKey, filename },
    update: { status: 'success', fileKey, filename, errorMessage: null, generatedAt: new Date() },
  });

  return { fileKey, filename };
}

async function recordFailure(generatorId: string, responseId: string, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  await prisma.pdfGenerationResult.upsert({
    where: { generatorId_responseId: { generatorId, responseId } },
    create: { id: generateId(), generatorId, responseId, status: 'failed', errorMessage },
    update: { status: 'failed', errorMessage, generatedAt: new Date() },
  });
}

export const startPdfGenerationRun = async (
  generatorId: string,
  trigger: 'manual' | 'auto' = 'manual'
) => {
  const generator = await prisma.pdfGenerator.findUnique({ where: { id: generatorId } });
  if (!generator) {
    throw createGraphQLError('PDF generator not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  if (!generator.enabled) {
    throw createGraphQLError(
      'Cannot run a disabled PDF generator',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const activeRun = await prisma.pdfGenerationRun.findFirst({
    where: { generatorId, status: { in: ['running', 'cancelling'] } },
  });
  if (activeRun) {
    throw createGraphQLError(
      'A run is already in progress for this PDF generator',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const totalResponseCount = await prisma.response.count({
    where: { formId: generator.formId, deletedAt: null },
  });
  if (totalResponseCount > MAX_RESPONSES_PER_RUN) {
    throw createGraphQLError(
      `This form has ${totalResponseCount} responses, which exceeds the ${MAX_RESPONSES_PER_RUN}-response limit for a single PDF generation run`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const matchingResponses = await getMatchingResponses(
    generator.formId,
    generator.filters as any,
    generator.filterLogic as 'AND' | 'OR'
  );

  const run = await prisma.pdfGenerationRun.create({
    data: {
      id: generateId(),
      generatorId,
      trigger,
      status: 'running',
      totalCount: matchingResponses.length,
    },
  });

  void runPdfGenerationLoop(run.id, generatorId, matchingResponses);

  return run;
};

export const runPdfGenerationLoop = async (
  runId: string,
  generatorId: string,
  responses: { id: string; data: Record<string, any> }[]
): Promise<void> => {
  try {
    const { generator, deserializedSchema } = await loadGeneratorContext(generatorId);
    const template = await hydrateTemplate(generator.template.template, generator.template.fileKey);
    const fonts = await getPdfFonts();

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < responses.length; i += BATCH_SIZE) {
      const run = await prisma.pdfGenerationRun.findUnique({ where: { id: runId } });
      if (!run || run.status === 'cancelling') {
        await prisma.pdfGenerationRun.update({
          where: { id: runId },
          data: { status: 'cancelled', completedAt: new Date() },
        });
        return;
      }

      const batch = responses.slice(i, i + BATCH_SIZE);
      for (const response of batch) {
        try {
          await generateAndPersistResult({
            generatorId,
            formId: generator.formId,
            templateName: generator.template.name,
            filenameFieldId: generator.filenameFieldId,
            template,
            fonts,
            deserializedSchema,
            responseId: response.id,
            responseData: response.data,
          });
          succeeded += 1;
        } catch (error) {
          logger.error(`[PDF Generator] Failed to generate PDF for response ${response.id}:`, error);
          failed += 1;
          await recordFailure(generatorId, response.id, error);
        }
        processed += 1;

        // Updated after every response (not just every batch) so a slow batch
        // never lets updatedAt go stale enough to trip stalled-run detection
        // while the loop is still healthy — see getLatestPdfGenerationRun.
        await prisma.pdfGenerationRun.update({
          where: { id: runId },
          data: { processedCount: processed, succeededCount: succeeded, failedCount: failed },
        });
      }

      await wait(BATCH_DELAY_MS);
    }

    await prisma.pdfGenerationRun.update({
      where: { id: runId },
      data: { status: 'completed', completedAt: new Date() },
    });
  } catch (error: any) {
    logger.error(`[PDF Generator] Run ${runId} failed`, error);
    await prisma.pdfGenerationRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        errorMessage: error.message || 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
};

export const cancelPdfGenerationRun = async (runId: string) => {
  const run = await prisma.pdfGenerationRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw createGraphQLError('PDF generation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  if (run.status !== 'running') {
    return run;
  }

  return prisma.pdfGenerationRun.update({ where: { id: runId }, data: { status: 'cancelling' } });
};

export const getLatestPdfGenerationRun = async (generatorId: string) => {
  const run = await prisma.pdfGenerationRun.findFirst({
    where: { generatorId },
    orderBy: { startedAt: 'desc' },
  });
  if (!run) return null;

  // Also cover 'cancelling': if the process restarts between
  // cancelPdfGenerationRun writing 'cancelling' and the loop observing it and
  // writing 'cancelled', the run would otherwise never finalize — and
  // startPdfGenerationRun's active-run guard treats 'cancelling' as active
  // too, permanently blocking new runs for this generator.
  if (run.status === 'running' || run.status === 'cancelling') {
    const staleMs = Date.now() - run.updatedAt.getTime();
    if (staleMs > STALLED_THRESHOLD_MS) {
      return prisma.pdfGenerationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorMessage:
            'Run appears stalled, possibly due to a server restart. Click Run again to retry.',
          completedAt: new Date(),
        },
      });
    }
  }

  return run;
};

/**
 * Generate (or reuse a fresh render for) one response via a saved generator —
 * the on-demand single-response path used by the Responses table's
 * per-generator column, the auto-run-on-submit listener, and the
 * response-edit regeneration hook. Always re-renders (no "already exists"
 * short-circuit here — callers that want the persisted-result-first check
 * query PdfGenerationResult themselves before calling this).
 */
export const generateSinglePdfForGenerator = async (
  generatorId: string,
  responseId: string
): Promise<{ fileKey: string; filename: string }> => {
  const { generator, deserializedSchema } = await loadGeneratorContext(generatorId);

  const response = await prisma.response.findUnique({ where: { id: responseId } });
  if (!response || response.deletedAt || response.formId !== generator.formId) {
    throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  const template = await hydrateTemplate(generator.template.template, generator.template.fileKey);
  const fonts = await getPdfFonts();

  return generateAndPersistResult({
    generatorId,
    formId: generator.formId,
    templateName: generator.template.name,
    filenameFieldId: generator.filenameFieldId,
    template,
    fonts,
    deserializedSchema,
    responseId,
    responseData: (response.data as Record<string, any>) ?? {},
  });
};

/**
 * Regenerate every persisted PdfGenerationResult tied to a response — fired
 * fire-and-forget after a tracked response edit commits (see
 * responseService.updateResponse). Failures are logged, not thrown: this
 * runs outside any request/response cycle.
 */
export const regeneratePdfsForResponse = async (responseId: string): Promise<void> => {
  const results = await prisma.pdfGenerationResult.findMany({
    where: { responseId, status: 'success' },
  });

  for (const result of results) {
    try {
      await generateSinglePdfForGenerator(result.generatorId, responseId);
    } catch (error) {
      logger.error(
        `[PDF Generator] Failed to regenerate PDF for response ${responseId} (generator ${result.generatorId}) after edit:`,
        error
      );
    }
  }
};
