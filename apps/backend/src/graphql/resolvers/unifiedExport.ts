import { GraphQLError } from 'graphql';
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


export const unifiedExportResolvers = {
  Mutation: {
    generateFormResponseReport: async (
      _: any, 
      { formId, format, filters = [] }: { formId: string; format: 'EXCEL' | 'CSV'; filters?: ResponseFilter[] }, 
      context: { auth: BetterAuthContext }
    ) => {
      try {
        // 🔒 SECURITY: Require authentication
        requireAuth(context.auth);

        const exportFormat: ExportFormat = format.toLowerCase() as ExportFormat;
        logger.info(`Starting unified ${exportFormat.toUpperCase()} export for form: ${formId}`);

        // 🔒 SECURITY: Verify user has access to this form before exporting data
        const accessCheck = await checkFormAccess(
          context.auth.user!.id,
          formId,
          PermissionLevel.VIEWER
        );
        if (!accessCheck.hasAccess) {
          throw new GraphQLError('Access denied: You do not have permission to export data from this form');
        }

        // Get form details
        const form = await getFormById(formId);
        if (!form) {
          throw new GraphQLError('Form not found');
        }

        // Get all responses for the form (unlimited)
        logger.info(`Fetching all responses for unified ${exportFormat.toUpperCase()} export - form: ${formId}`);
        let responses = await getAllResponsesByFormId(formId);
        
        if (responses.length === 0) {
          throw new GraphQLError('No responses found for this form');
        }

        logger.info(`Found ${responses.length} responses before filtering`);

        // Apply filters if provided
        if (filters && filters.length > 0) {
          responses = applyResponseFilters(responses, filters);
          logger.info(`Found ${responses.length} responses after applying ${filters.length} filters`);
          
          if (responses.length === 0) {
            throw new GraphQLError('No responses match the applied filters');
          }
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

        // Generate export file using unified service
        const exportResult = await generateExportFile({
          formTitle: form.title,
          responses,
          formSchema,
          format: exportFormat
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
        
        throw new GraphQLError(
          `Failed to generate ${format} report: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }
};