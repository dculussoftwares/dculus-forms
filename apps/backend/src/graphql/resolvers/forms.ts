import { 
  getAllForms, 
  getFormById, 
  getFormByShortUrl,
  createForm, 
  updateForm, 
  deleteForm,
  regenerateShortUrl
} from '../../services/formService.js';
import { getTemplateById } from '../../services/templateService.js';
import { getFormMetadata, constructBackgroundImageUrl } from '../../services/formMetadataService.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { generateId } from '@dculus/utils';
import { copyFileForForm } from '../../services/fileUploadService.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import { prisma } from '../../lib/prisma.js';
import { randomUUID } from 'crypto';

export const formsResolvers = {
  Query: {
    forms: async (_: any, { organizationId }: { organizationId: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      return await getAllForms(organizationId);
    },
    form: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const form = await getFormById(id);
      if (!form) throw new Error("Form not found");
      return form;
    },
    formByShortUrl: async (_: any, { shortUrl }: { shortUrl: string }) => {
      const form = await getFormByShortUrl(shortUrl);
      if (!form) throw new Error("Form not found");
      if (!form.isPublished) throw new Error("Form is not published");
      return form;
    },
  },
  Form: {
    metadata: async (parent: any) => {
      const formId = parent.id;
      const metadata = await getFormMetadata(formId);
      
      if (!metadata) {
        return null;
      }
      
      return {
        pageCount: metadata.pageCount,
        fieldCount: metadata.fieldCount,
        backgroundImageKey: metadata.backgroundImageKey,
        backgroundImageUrl: constructBackgroundImageUrl(metadata.backgroundImageKey),
        lastUpdated: metadata.lastUpdated.toISOString(),
      };
    },
    formSchema: async (parent: any) => {
      const formId = parent.id;
      return await getFormSchemaFromHocuspocus(formId);
    },
  },
  Mutation: {
    createForm: async (
      _: any,
      { input }: { input: { templateId: string; title: string; description?: string; organizationId: string } },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      // Fetch the template by templateId
      const template = await getTemplateById(input.templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Generate form ID upfront
      const newFormId = generateId();
      
      // Clone the template schema to avoid modifying the original
      let formSchema = JSON.parse(JSON.stringify(template.formSchema));
      
      // Check if template has a background image and copy it for the new form
      if (formSchema.layout && formSchema.layout.backgroundImageKey) {
        try {
          console.log('Template form has background image, checking if we need to copy it:', formSchema.layout.backgroundImageKey);
          
          // Check if this is a template directory image that needs to be copied to form-specific location
          const isTemplateImage = formSchema.layout.backgroundImageKey.includes('templateDirectory') || 
                                 formSchema.layout.backgroundImageKey.includes('allOrgs');
          
          if (isTemplateImage) {
            console.log('Copying template background image to form-specific location');
            
            // Copy the template image to a form-specific location
            const copiedFile = await copyFileForForm(formSchema.layout.backgroundImageKey, newFormId);
            
            // Update the form schema with the new key
            formSchema.layout.backgroundImageKey = copiedFile.key;
            
            console.log('Updated form schema with new background image key:', copiedFile.key);
            
            // Create FormFile record for the copied image
            await prisma.formFile.create({
              data: {
                id: randomUUID(),
                key: copiedFile.key,
                type: 'FormBackground',
                formId: newFormId,
                originalName: copiedFile.originalName,
                url: copiedFile.url,
                size: copiedFile.size,
                mimeType: copiedFile.mimeType,
              }
            });
            
            console.log('Successfully copied template background and created FormFile record');
          } else {
            console.log('Background image is not from template directory, creating FormFile record for existing image');
            
            // Create FormFile record for non-template images
            const originalFileName = formSchema.layout.backgroundImageKey.split('/').pop() || 'background.jpg';
            
            await prisma.formFile.create({
              data: {
                id: randomUUID(),
                key: formSchema.layout.backgroundImageKey,
                type: 'FormBackground',
                formId: newFormId,
                originalName: originalFileName,
                url: `${process.env.CLOUDFLARE_R2_CDN_URL}/${formSchema.layout.backgroundImageKey}`,
                size: 0, // Size not available for existing images
                mimeType: 'image/jpeg', // Default mime type
              }
            });
            
            console.log('Successfully created FormFile record for existing background image');
          }
        } catch (formFileError) {
          console.error('Error handling template background image:', formFileError);
          // Continue with form creation even if FormFile creation fails
          // But remove the backgroundImageKey to avoid broken references
          formSchema.layout.backgroundImageKey = '';
        }
      }

      const formData = {
        id: newFormId,
        title: input.title,
        description: input.description,
        shortUrl: '', // Will be generated in createForm service
        isPublished: false,
        organizationId: input.organizationId,
        createdById: context.auth.user!.id,
      };
      return await createForm(formData, formSchema); // Initialize Hocuspocus document with modified schema
    },
    updateForm: async (_: any, { id, input }: { id: string; input: any }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const existingForm = await getFormById(id);
      if (!existingForm) {
        throw new Error("Form not found");
      }
      const updateData = {
        ...input,
        updatedAt: new Date(),
      };
      return await updateForm(id, updateData);
    },
    deleteForm: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const existingForm = await getFormById(id);
      if (!existingForm) {
        throw new Error("Form not found");
      }
      return await deleteForm(id);
    },
    regenerateShortUrl: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const existingForm = await getFormById(id);
      if (!existingForm) {
        throw new Error("Form not found");
      }
      return await regenerateShortUrl(id);
    },
  },
};
