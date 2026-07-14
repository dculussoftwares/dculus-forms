import { GraphQLError, createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { getFormById } from '../../services/formService.js';
import { getAllResponsesByFormId } from '../../services/responseService.js';
import { generateExportFile, ExportFormat } from '../../services/unifiedExportService.js';
import { uploadTemporaryFile } from '../../services/temporaryFileService.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import { deserializeFormSchema } from '@dculus/types';
import { ResponseFilter, applyResponseFilters } from '../../services/responseFilterService.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';


export const unifiedExportResolvers = {
  Mutation: {
    generateFormResponseReport: async (
      _: any,
      { formId, format, filters = [], filterLogic = 'AND', ids }: {
        formId: string;
        format: 'EXCEL' | 'CSV';
        filters?: ResponseFilter[];
        filterLogic?: 'AND' | 'OR';
        ids?: string[];
      },
      context: { auth: BetterAuthContext }
    ) => {
      try {
        // 🔒 SECURITY: Require authentication
        requireAuth(context.auth);

        const exportFormat: ExportFormat = format.toLowerCase() as ExportFormat;
        logger.info(`Starting unified ${exportFormat.toUpperCase()} export for form: ${formId}`);

        // 🔒 SECURITY: Verify user has EDITOR access to export data (VIEWER cannot bulk-export PII)
        const accessCheck = await checkFormAccess(
          context.auth.user!.id,
          formId,
          PermissionLevel.EDITOR
        );
        if (!accessCheck.hasAccess) {
          throw createGraphQLError('Access denied: You need EDITOR access to export data from this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
        }

        // Get form details
        const form = await getFormById(formId);
        if (!form) {
          throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
        }

        const MAX_EXPORT_RESPONSES = 50_000;

        logger.info(`Fetching all responses for unified ${exportFormat.toUpperCase()} export - form: ${formId}`);
        let responses = await getAllResponsesByFormId(formId);

        if (responses.length === 0) {
          throw createGraphQLError('No responses found for this form', GRAPHQL_ERROR_CODES.NOT_FOUND);
        }

        // If specific IDs are provided (bulk export of selected rows), restrict to those
        if (ids && ids.length > 0) {
          const idSet = new Set(ids);
          responses = responses.filter((r) => idSet.has(r.id));
          logger.info(`Filtered to ${responses.length} selected responses`);
        }

        // Apply filters before the size check so that a form with > 50k total
        // responses can still be exported when filters narrow the result set.
        if (filters && filters.length > 0) {
          responses = applyResponseFilters(responses, filters, filterLogic);
          logger.info(`Found ${responses.length} responses after applying ${filters.length} filters with ${filterLogic} logic`);

          if (responses.length === 0) {
            throw createGraphQLError('No responses match the applied filters', GRAPHQL_ERROR_CODES.NOT_FOUND);
          }
        }

        if (responses.length > MAX_EXPORT_RESPONSES) {
          throw createGraphQLError(
            `Export contains ${responses.length.toLocaleString()} responses which exceeds the ` +
            `${MAX_EXPORT_RESPONSES.toLocaleString()} limit. Apply filters to narrow the dataset before exporting.`,
            GRAPHQL_ERROR_CODES.BAD_USER_INPUT
          );
        }

        logger.info(`Generating ${exportFormat.toUpperCase()} file with ${responses.length} responses...`);

        // Get live form schema from Hocuspocus first, fallback to database
        logger.info('Unified Export - Getting live form schema from Hocuspocus...');
        let formSchema;
        const liveFormSchema = await getFormSchemaFromHocuspocus(formId);
        if (liveFormSchema && liveFormSchema.pages && liveFormSchema.pages.length > 0) {
          formSchema = liveFormSchema;
          logger.info('Unified Export - Using live form schema from Hocuspocus, pages:', formSchema.pages.length);
        } else {
          logger.info('Unified Export - Live schema not available, using database schema...');
          logger.info('Unified Export - Raw form schema from DB:', typeof form.formSchema);
          formSchema = deserializeFormSchema(form.formSchema);
          logger.info('Unified Export - Deserialized database form schema pages:', formSchema.pages.length);
        }

        // Build a pluginType → config map so the export service can honour
        // per-plugin settings (e.g. the quiz plugin's configurable columnName).
        // Key by 'type:id' so multiple instances of the same plugin type each
        // get their own config entry, matching the metadata key written by the handler.
        const formPlugins = await prisma.formPlugin.findMany({
          where: { formId, enabled: true },
          select: { id: true, type: true, config: true },
        });
        const pluginConfigs: Record<string, Record<string, any>> = {};
        for (const fp of formPlugins) {
          if (fp.config && typeof fp.config === 'object') {
            pluginConfigs[`${fp.type}:${fp.id}`] = fp.config as Record<string, any>;
          }
        }

        // Only forms that actually capture respondent identity get the
        // "Respondent Email" export column — most forms are anonymous.
        const includeRespondentEmail = !!(
          form.settings?.accessControl?.enabled || form.settings?.collectRespondentEmail
        );

        // Generate export file using unified service
        const exportResult = await generateExportFile({
          formTitle: form.title,
          responses,
          formSchema,
          format: exportFormat,
          pluginConfigs,
          includeRespondentEmail,
        });

        logger.info(`${exportFormat.toUpperCase()} file generated, size: ${exportResult.buffer.length} bytes`);

        // Upload to S3 and get signed URL
        const temporaryFile = await uploadTemporaryFile(
          exportResult.buffer,
          exportResult.filename,
          exportResult.contentType
        );

        logger.info(`${exportFormat.toUpperCase()} file uploaded to S3, signed URL generated`);

        return {
          downloadUrl: temporaryFile.downloadUrl,
          expiresAt: temporaryFile.expiresAt.toISOString(),
          filename: exportResult.filename,
          format: format // Return the original format enum
        };

      } catch (error) {
        logger.error('Error in generateFormResponseReport:', error);
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw createGraphQLError(
          `Failed to generate ${format} report: ${error instanceof Error ? error.message : 'Unknown error'}`,
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    }
  }
};