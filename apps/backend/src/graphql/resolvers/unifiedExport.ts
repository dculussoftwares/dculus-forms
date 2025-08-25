import { GraphQLError } from 'graphql';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { getFormById } from '../../services/formService.js';
import { getAllResponsesByFormId } from '../../services/responseService.js';
import { generateExportFile, ExportFormat } from '../../services/unifiedExportService.js';
import { uploadTemporaryFile } from '../../services/temporaryFileService.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import { deserializeFormSchema } from '@dculus/types';

export const unifiedExportResolvers = {
  Mutation: {
    generateFormResponseReport: async (
      _: any, 
      { formId, format }: { formId: string; format: 'EXCEL' | 'CSV' }, 
      context: { auth: BetterAuthContext }
    ) => {
      try {
        // Require authentication
        requireAuth(context.auth);

        const exportFormat: ExportFormat = format.toLowerCase() as ExportFormat;
        console.log(`Starting unified ${exportFormat.toUpperCase()} export for form: ${formId}`);

        // Get form details
        const form = await getFormById(formId);
        if (!form) {
          throw new GraphQLError('Form not found');
        }

        // Check if user has access to this form
        if (!context.auth.user) {
          throw new GraphQLError('Authentication required');
        }

        // Get all responses for the form (unlimited)
        console.log(`Fetching all responses for unified ${exportFormat.toUpperCase()} export - form: ${formId}`);
        const responses = await getAllResponsesByFormId(formId);
        
        if (responses.length === 0) {
          throw new GraphQLError('No responses found for this form');
        }

        console.log(`Found ${responses.length} responses, generating ${exportFormat.toUpperCase()} file...`);

        // Get live form schema from Hocuspocus first, fallback to database
        console.log('Unified Export - Getting live form schema from Hocuspocus...');
        let formSchema;
        const liveFormSchema = await getFormSchemaFromHocuspocus(formId);
        if (liveFormSchema && liveFormSchema.pages && liveFormSchema.pages.length > 0) {
          formSchema = liveFormSchema;
          console.log('Unified Export - Using live form schema from Hocuspocus, pages:', formSchema.pages.length);
        } else {
          console.log('Unified Export - Live schema not available, using database schema...');
          console.log('Unified Export - Raw form schema from DB:', typeof form.formSchema);
          formSchema = deserializeFormSchema(form.formSchema);
          console.log('Unified Export - Deserialized database form schema pages:', formSchema.pages.length);
        }

        // Generate export file using unified service
        const exportResult = await generateExportFile({
          formTitle: form.title,
          responses,
          formSchema,
          format: exportFormat
        });

        console.log(`${exportFormat.toUpperCase()} file generated, size: ${exportResult.buffer.length} bytes`);

        // Upload to S3 and get signed URL
        const temporaryFile = await uploadTemporaryFile(
          exportResult.buffer,
          exportResult.filename,
          exportResult.contentType
        );

        console.log(`${exportFormat.toUpperCase()} file uploaded to S3, signed URL generated`);

        return {
          downloadUrl: temporaryFile.downloadUrl,
          expiresAt: temporaryFile.expiresAt.toISOString(),
          filename: exportResult.filename,
          format: format // Return the original format enum
        };

      } catch (error) {
        console.error('Error in generateFormResponseReport:', error);
        
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