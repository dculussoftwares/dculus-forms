import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { deserializeFormSchema } from '@dculus/types';
import { generateId } from '@dculus/utils';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import {
  BetterAuthContext,
  requireAuth,
} from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import {
  deleteFile,
  generatePresignedDownloadUrl,
} from '../../services/fileUploadService.js';
import { uploadTemporaryFile } from '../../services/temporaryFileService.js';
import {
  buildAiFieldEntries,
  buildPdfFilename,
  buildSampleResponseData,
  coerceAiSampleData,
  generatePdfForResponse,
  stripBasePdf,
  validatePdfTemplate,
} from '../../services/pdfTemplateService.js';
import { generateAiSampleData } from '../../services/aiService.js';
import {
  checkAITokenBudget,
  recordAITokenUsage,
} from '../../services/aiUsageService.js';

/**
 * GraphQL Resolvers for PDF Templates (issue #87)
 *
 * PDF templates are a first-class form feature (like Responses/Analytics/
 * Integrations): pdfme designer templates persisted per form, with
 * per-response PDF generation delivered via temporary pre-signed URLs.
 *
 * Permissions: VIEWER may list/read templates and generate PDFs from
 * responses (same level as viewing responses); EDITOR+ may create/update/
 * delete templates.
 */

async function getTemplateOrThrow(id: string) {
  const template = await prisma.pdfTemplate.findUnique({ where: { id } });
  if (!template) {
    throw createGraphQLError('PDF template not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  return template;
}

export const pdfTemplatesResolvers = {
  Query: {
    /**
     * Get all PDF templates for a form
     */
    pdfTemplates: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError(
          'Access denied: You do not have permission to view PDF templates for this form',
          GRAPHQL_ERROR_CODES.NO_ACCESS
        );
      }

      return prisma.pdfTemplate.findMany({
        where: { formId },
        orderBy: { createdAt: 'desc' },
      });
    },

    /**
     * Get a single PDF template by ID
     */
    pdfTemplate: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const template = await getTemplateOrThrow(id);

      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        template.formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError(
          'Access denied: You do not have permission to view this PDF template',
          GRAPHQL_ERROR_CODES.NO_ACCESS
        );
      }

      return template;
    },
  },

  Mutation: {
    /**
     * Create a PDF template (from an uploaded base PDF or a blank page)
     */
    createPdfTemplate: async (
      _: any,
      {
        input,
      }: {
        input: {
          formId: string;
          name: string;
          template: any;
          fileKey?: string | null;
          fileName?: string | null;
        };
      },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        input.formId,
        PermissionLevel.EDITOR
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError(
          'Access denied: You need EDITOR access to create PDF templates for this form',
          GRAPHQL_ERROR_CODES.NO_ACCESS
        );
      }

      if (!input.name?.trim()) {
        throw createGraphQLError('Template name is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      // Reject fileKeys not issued for this form's PdfTemplateAsset upload path —
      // otherwise a caller could attach (and later read/delete via basePdfUrl /
      // deletePdfTemplate) a private object key belonging to another form.
      if (input.fileKey && !input.fileKey.startsWith(`files/pdf-template-asset/${input.formId}/`)) {
        throw createGraphQLError(
          'Invalid fileKey: must be an uploaded PdfTemplateAsset for this form',
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      const hasUploadedPdf = !!input.fileKey;
      try {
        validatePdfTemplate(input.template, hasUploadedPdf);
      } catch (error) {
        throw createGraphQLError(
          `Invalid PDF template: ${error instanceof Error ? error.message : 'validation failed'}`,
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      const storedTemplate = stripBasePdf(input.template, hasUploadedPdf);

      return prisma.pdfTemplate.create({
        data: {
          id: generateId(),
          formId: input.formId,
          name: input.name.trim(),
          template: storedTemplate,
          fileKey: input.fileKey ?? null,
          fileName: input.fileName ?? null,
          pageCount: Array.isArray(input.template?.schemas)
            ? Math.max(input.template.schemas.length, 1)
            : 1,
          createdById: context.auth.user!.id,
        },
      });
    },

    /**
     * Update a PDF template's name and/or layout JSON
     */
    updatePdfTemplate: async (
      _: any,
      {
        id,
        input,
      }: {
        id: string;
        input: { name?: string; template?: any };
      },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const existing = await getTemplateOrThrow(id);

      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        existing.formId,
        PermissionLevel.EDITOR
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError(
          'Access denied: You need EDITOR access to update this PDF template',
          GRAPHQL_ERROR_CODES.NO_ACCESS
        );
      }

      const data: Record<string, any> = {};

      if (input.name !== undefined) {
        if (!input.name.trim()) {
          throw createGraphQLError('Template name cannot be empty', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }
        data.name = input.name.trim();
      }

      if (input.template !== undefined) {
        const hasUploadedPdf = !!existing.fileKey;
        try {
          validatePdfTemplate(input.template, hasUploadedPdf);
        } catch (error) {
          throw createGraphQLError(
            `Invalid PDF template: ${error instanceof Error ? error.message : 'validation failed'}`,
            GRAPHQL_ERROR_CODES.BAD_USER_INPUT
          );
        }
        data.template = stripBasePdf(input.template, hasUploadedPdf);
        data.pageCount = Array.isArray(input.template?.schemas)
          ? Math.max(input.template.schemas.length, 1)
          : existing.pageCount;
      }

      return prisma.pdfTemplate.update({ where: { id }, data });
    },

    /**
     * Delete a PDF template (and its uploaded base PDF in R2, if any)
     */
    deletePdfTemplate: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const existing = await getTemplateOrThrow(id);

      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        existing.formId,
        PermissionLevel.EDITOR
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError(
          'Access denied: You need EDITOR access to delete this PDF template',
          GRAPHQL_ERROR_CODES.NO_ACCESS
        );
      }

      await prisma.pdfTemplate.delete({ where: { id } });

      // Best-effort cleanup of the base PDF in R2 — the DB row is already gone
      if (existing.fileKey) {
        const deleted = await deleteFile(existing.fileKey);
        if (!deleted) {
          logger.warn(`Failed to delete base PDF from R2: ${existing.fileKey}`);
        }
      }

      return true;
    },

    /**
     * Generate a filled PDF for one response and return a temporary
     * pre-signed download URL (same delivery mechanism as Excel/CSV export)
     */
    generatePdfFromResponse: async (
      _: any,
      { templateId, responseId }: { templateId: string; responseId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const template = await getTemplateOrThrow(templateId);

      // Same permission level as viewing responses
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        template.formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError(
          'Access denied: You do not have permission to generate PDFs for this form',
          GRAPHQL_ERROR_CODES.NO_ACCESS
        );
      }

      const response = await prisma.response.findUnique({
        where: { id: responseId },
      });
      if (!response || response.deletedAt || response.formId !== template.formId) {
        throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const form = await prisma.form.findUnique({
        where: { id: template.formId },
        select: { formSchema: true },
      });
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      try {
        const deserializedSchema = deserializeFormSchema(form.formSchema);
        const pdfBuffer = await generatePdfForResponse({
          storedTemplate: template.template,
          fileKey: template.fileKey,
          deserializedSchema,
          responseData: (response.data as Record<string, any>) ?? {},
        });

        const filename = buildPdfFilename(template.name, responseId);
        const temporaryFile = await uploadTemporaryFile(
          pdfBuffer,
          filename,
          'application/pdf'
        );

        return {
          downloadUrl: temporaryFile.downloadUrl,
          expiresAt: temporaryFile.expiresAt.toISOString(),
          filename,
        };
      } catch (error) {
        logger.error('generatePdfFromResponse failed:', error);
        throw createGraphQLError(
          'Failed to generate PDF',
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },

    /**
     * Preview a template as a generated PDF, without persisting anything.
     *
     * - `template` (optional): the designer's working copy, so unsaved
     *   changes preview accurately. Requires EDITOR (same right as saving
     *   it); omitted → the stored template is used (VIEWER is enough).
     * - `responseId` (optional): preview with that response's answers;
     *   omitted → deterministic per-field-type sample data, or AI-generated
     *   sample data when `aiSampleData` is set (EDITOR — spends AI credits).
     */
    previewPdfTemplate: async (
      _: any,
      {
        templateId,
        template,
        responseId,
        aiSampleData,
      }: {
        templateId: string;
        template?: any;
        responseId?: string | null;
        aiSampleData?: boolean;
      },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const stored = await getTemplateOrThrow(templateId);

      const usesWorkingCopy = template !== undefined && template !== null;
      // EDITOR for working copies (equivalent to save rights) AND for AI
      // sample data — it spends the org's AI credit budget, which VIEWER
      // access must not be able to drain
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        stored.formId,
        usesWorkingCopy || aiSampleData ? PermissionLevel.EDITOR : PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError(
          'Access denied: You do not have permission to preview this PDF template',
          GRAPHQL_ERROR_CODES.NO_ACCESS
        );
      }

      let workingTemplate = stored.template;
      if (usesWorkingCopy) {
        try {
          validatePdfTemplate(template, !!stored.fileKey);
        } catch (error) {
          throw createGraphQLError(
            `Invalid PDF template: ${error instanceof Error ? error.message : 'validation failed'}`,
            GRAPHQL_ERROR_CODES.BAD_USER_INPUT
          );
        }
        // The uploaded base PDF is never trusted from the client — it is
        // re-hydrated from R2 via the stored fileKey inside generation
        workingTemplate = stripBasePdf(template, !!stored.fileKey);
      }

      const form = await prisma.form.findUnique({
        where: { id: stored.formId },
        select: { formSchema: true, organizationId: true, title: true },
      });
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }
      const deserializedSchema = deserializeFormSchema(form.formSchema);

      let responseData: Record<string, any>;
      if (responseId) {
        const response = await prisma.response.findUnique({ where: { id: responseId } });
        if (!response || response.deletedAt || response.formId !== stored.formId) {
          throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
        }
        responseData = (response.data as Record<string, any>) ?? {};
      } else if (aiSampleData) {
        const budget = await checkAITokenBudget(form.organizationId);
        if (!budget.allowed) {
          throw createGraphQLError(
            `AI credit limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} credits used this month). Upgrade your plan to continue.`,
            GRAPHQL_ERROR_CODES.AI_TOKEN_LIMIT_EXCEEDED
          );
        }
        try {
          const aiResult = await generateAiSampleData({
            formTitle: form.title,
            entries: buildAiFieldEntries(deserializedSchema),
          });
          await recordAITokenUsage(form.organizationId, aiResult.tokensUsed, 'nano');
          responseData = coerceAiSampleData(deserializedSchema, aiResult.answers);
        } catch (error) {
          logger.error('AI sample data generation failed:', error);
          throw createGraphQLError(
            'AI sample data generation failed. Please try again.',
            GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
          );
        }
      } else {
        responseData = buildSampleResponseData(deserializedSchema);
      }

      try {
        const pdfBuffer = await generatePdfForResponse({
          storedTemplate: workingTemplate,
          fileKey: stored.fileKey,
          deserializedSchema,
          responseData,
        });

        const filename = buildPdfFilename(stored.name, responseId ?? 'preview');
        const temporaryFile = await uploadTemporaryFile(
          pdfBuffer,
          filename,
          'application/pdf'
        );

        return {
          downloadUrl: temporaryFile.downloadUrl,
          expiresAt: temporaryFile.expiresAt.toISOString(),
          filename,
        };
      } catch (error) {
        logger.error('previewPdfTemplate failed:', error);
        throw createGraphQLError(
          'Failed to generate the preview PDF',
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },
  },

  // Field resolvers
  PdfTemplate: {
    template: (parent: any) => {
      // Parse JSON template if it's a string
      if (typeof parent.template === 'string') {
        return JSON.parse(parent.template);
      }
      return parent.template;
    },
    // Short-lived pre-signed URL for the uploaded base PDF (null for blank templates)
    basePdfUrl: async (parent: any) => {
      if (!parent.fileKey) return null;
      try {
        return await generatePresignedDownloadUrl(parent.fileKey);
      } catch (error) {
        logger.error(`Failed to presign base PDF URL for template ${parent.id}:`, error);
        return null;
      }
    },
  },
};
