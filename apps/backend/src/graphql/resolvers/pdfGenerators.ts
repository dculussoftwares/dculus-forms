import { GraphQLError } from 'graphql';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { logger } from '../../lib/logger.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { generatePresignedDownloadUrl } from '../../services/fileUploadService.js';
import { uploadTemporaryFile } from '../../services/temporaryFileService.js';
import {
  createPdfGenerator,
  updatePdfGenerator,
  deletePdfGenerator,
  listPdfGenerators,
  getPdfGenerator,
  countMatchingResponses,
  countPdfGenerators,
  getPdfTemplateById,
  getPdfGenerationResult,
  listPdfGenerationResults,
  countSuccessfulResults,
} from '../../services/pdfGeneratorService.js';
import {
  startPdfGenerationRun,
  cancelPdfGenerationRun,
  getLatestPdfGenerationRun,
  getPdfGenerationRun,
  generateSinglePdfForGenerator,
} from '../../services/pdfGenerationJobService.js';
import { buildZipForGenerator } from '../../services/pdfGeneratorZipService.js';

/**
 * GraphQL resolvers for PDF Generators — saved template+filter combos for
 * bulk/repeatable PDF generation from responses. Permission model mirrors
 * PDF Templates: VIEWER may read/download; EDITOR+ may create/edit/run.
 */

const MAX_PDF_GENERATORS_PER_FORM = 6;

async function getGeneratorOrThrow(id: string) {
  const generator = await getPdfGenerator(id);
  if (!generator) {
    throw createGraphQLError('PDF generator not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  return generator;
}

type PermissionLevelValue = (typeof PermissionLevel)[keyof typeof PermissionLevel];

async function requireFormAccess(
  context: { auth: BetterAuthContext },
  formId: string,
  level: PermissionLevelValue,
  action: string
) {
  requireAuth(context.auth);
  const accessCheck = await checkFormAccess(context.auth.user!.id, formId, level);
  if (!accessCheck.hasAccess) {
    throw createGraphQLError(
      `Access denied: You need ${level} access to ${action}`,
      GRAPHQL_ERROR_CODES.NO_ACCESS
    );
  }
}

export const pdfGeneratorsResolvers = {
  Query: {
    pdfGenerators: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      await requireFormAccess(context, formId, PermissionLevel.VIEWER, 'view PDF generators for this form');
      return listPdfGenerators(formId);
    },

    pdfGenerator: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(id);
      await requireFormAccess(context, generator.formId, PermissionLevel.VIEWER, 'view this PDF generator');
      return generator;
    },

    pdfGenerationRunStatus: async (
      _: any,
      { generatorId }: { generatorId: string },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(generatorId);
      await requireFormAccess(context, generator.formId, PermissionLevel.VIEWER, 'view this PDF generator');
      return getLatestPdfGenerationRun(generatorId);
    },

    pdfGenerationResult: async (
      _: any,
      { generatorId, responseId }: { generatorId: string; responseId: string },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(generatorId);
      await requireFormAccess(context, generator.formId, PermissionLevel.VIEWER, 'view this PDF generator');
      return getPdfGenerationResult(generatorId, responseId);
    },

    pdfGenerationResults: async (
      _: any,
      { generatorId }: { generatorId: string },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(generatorId);
      await requireFormAccess(context, generator.formId, PermissionLevel.VIEWER, 'view this PDF generator');
      // Excludes results for responses that have since been soft-deleted —
      // responseId isn't a hard FK, so those rows (and their R2 files) would
      // otherwise stay downloadable forever. See filterResultsToLiveResponses.
      return listPdfGenerationResults(generatorId);
    },

    /**
     * Live "N responses match" preview for the generator editor — evaluated
     * against a draft filter set that may not be saved yet, so it can't use
     * PdfGenerator.matchingResponseCount (which reads a persisted generator).
     */
    previewPdfGeneratorMatchCount: async (
      _: any,
      {
        formId,
        filters,
        filterLogic,
      }: { formId: string; filters?: any[]; filterLogic?: 'AND' | 'OR' },
      context: { auth: BetterAuthContext }
    ) => {
      await requireFormAccess(context, formId, PermissionLevel.VIEWER, 'view responses for this form');
      return countMatchingResponses(formId, filters ?? [], filterLogic ?? 'AND');
    },
  },

  Mutation: {
    createPdfGenerator: async (
      _: any,
      {
        input,
      }: {
        input: {
          formId: string;
          templateId: string;
          name: string;
          columnName?: string | null;
          filenameFieldId?: string | null;
          filters: any[];
          filterLogic?: 'AND' | 'OR';
          autoRunOnSubmit?: boolean;
        };
      },
      context: { auth: BetterAuthContext }
    ) => {
      await requireFormAccess(context, input.formId, PermissionLevel.EDITOR, 'create PDF generators for this form');

      if (!input.name?.trim()) {
        throw createGraphQLError('Generator name is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      const existingGeneratorCount = await countPdfGenerators(input.formId);
      if (existingGeneratorCount >= MAX_PDF_GENERATORS_PER_FORM) {
        throw createGraphQLError(
          `This form already has the maximum of ${MAX_PDF_GENERATORS_PER_FORM} PDF generators`,
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      return createPdfGenerator({
        formId: input.formId,
        templateId: input.templateId,
        name: input.name.trim(),
        columnName: input.columnName,
        filenameFieldId: input.filenameFieldId,
        filters: input.filters ?? [],
        filterLogic: input.filterLogic,
        autoRunOnSubmit: input.autoRunOnSubmit,
      });
    },

    updatePdfGenerator: async (
      _: any,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          templateId?: string;
          name?: string;
          columnName?: string | null;
          filenameFieldId?: string | null;
          filters?: any[];
          filterLogic?: 'AND' | 'OR';
          autoRunOnSubmit?: boolean;
          enabled?: boolean;
        };
      },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(id);
      await requireFormAccess(context, generator.formId, PermissionLevel.EDITOR, 'update this PDF generator');

      if (input.name !== undefined && !input.name.trim()) {
        throw createGraphQLError('Generator name cannot be empty', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      return updatePdfGenerator(id, { ...input, name: input.name?.trim() });
    },

    deletePdfGenerator: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(id);
      await requireFormAccess(context, generator.formId, PermissionLevel.EDITOR, 'delete this PDF generator');
      return deletePdfGenerator(id);
    },

    startPdfGenerationRun: async (
      _: any,
      { generatorId }: { generatorId: string },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(generatorId);
      await requireFormAccess(context, generator.formId, PermissionLevel.EDITOR, 'run this PDF generator');
      return startPdfGenerationRun(generatorId, 'manual');
    },

    cancelPdfGenerationRun: async (
      _: any,
      { runId }: { runId: string },
      context: { auth: BetterAuthContext }
    ) => {
      const run = await getPdfGenerationRun(runId);
      if (!run) {
        throw createGraphQLError('PDF generation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }
      const generator = await getGeneratorOrThrow(run.generatorId);
      await requireFormAccess(context, generator.formId, PermissionLevel.EDITOR, 'cancel this PDF generation run');
      return cancelPdfGenerationRun(runId);
    },

    /**
     * On-demand single-response generation via a saved generator — the
     * "download via generator" path from the response detail panel. VIEWER
     * level, matching generatePdfFromResponse's existing permission level.
     */
    generatePdfFromGenerator: async (
      _: any,
      { generatorId, responseId }: { generatorId: string; responseId: string },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(generatorId);
      await requireFormAccess(context, generator.formId, PermissionLevel.VIEWER, 'generate PDFs for this form');

      try {
        const { fileKey, filename } = await generateSinglePdfForGenerator(generatorId, responseId);
        const downloadUrl = await generatePresignedDownloadUrl(fileKey);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        return { downloadUrl, expiresAt, filename };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        logger.error('generatePdfFromGenerator failed:', error);
        throw createGraphQLError('Failed to generate PDF', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },

    /**
     * Bundles every successfully-generated PDF for a generator into a ZIP,
     * delivered via a temporary pre-signed URL (same 5h-TTL mechanism as
     * Excel/CSV export) — the ZIP itself is a derived, regenerable artifact,
     * unlike the individual PDFs which persist durably.
     */
    downloadPdfGenerationResultsZip: async (
      _: any,
      { generatorId }: { generatorId: string },
      context: { auth: BetterAuthContext }
    ) => {
      const generator = await getGeneratorOrThrow(generatorId);
      await requireFormAccess(context, generator.formId, PermissionLevel.VIEWER, 'download PDFs for this form');

      const successCount = await countSuccessfulResults(generatorId);
      if (successCount === 0) {
        throw createGraphQLError(
          'No generated PDFs are available for this generator yet',
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      try {
        const zipBuffer = await buildZipForGenerator(generatorId);
        const filename = `${generator.name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'generated-pdfs'}.zip`;
        const temporaryFile = await uploadTemporaryFile(zipBuffer, filename, 'application/zip');
        return {
          downloadUrl: temporaryFile.downloadUrl,
          expiresAt: temporaryFile.expiresAt.toISOString(),
          filename,
        };
      } catch (error) {
        logger.error('downloadPdfGenerationResultsZip failed:', error);
        throw createGraphQLError('Failed to build ZIP archive', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },
  },

  // Field resolvers
  PdfGenerator: {
    template: async (parent: { templateId: string }) => getPdfTemplateById(parent.templateId),
    latestRun: async (parent: { id: string }) => getLatestPdfGenerationRun(parent.id),
    matchingResponseCount: async (parent: { formId: string; filters: any; filterLogic: string }) =>
      countMatchingResponses(parent.formId, parent.filters as any, parent.filterLogic as 'AND' | 'OR'),
  },

  PdfGenerationResult: {
    downloadUrl: async (parent: { fileKey: string | null }) => {
      if (!parent.fileKey) return null;
      try {
        return await generatePresignedDownloadUrl(parent.fileKey);
      } catch (error) {
        logger.error('Failed to presign generated PDF URL:', error);
        return null;
      }
    },
  },
};
