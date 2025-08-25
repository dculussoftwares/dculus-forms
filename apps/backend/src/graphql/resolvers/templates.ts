import { GraphQLError } from 'graphql';
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplatesByCategory,
  getTemplateCategories,
} from '../../services/templateService.js';
import { createForm } from '../../services/formService.js';
import { randomUUID } from 'crypto';
import { copyFileForForm } from '../../services/fileUploadService.js';
import { prisma } from '../../lib/prisma.js';
import { s3Config } from '../../lib/env.js';

export interface CreateTemplateArgs {
  input: {
    name: string;
    description?: string;
    category?: string;
    formSchema: any;
  };
}

export interface UpdateTemplateArgs {
  id: string;
  input: {
    name?: string;
    description?: string;
    category?: string;
    formSchema?: any;
    isActive?: boolean;
  };
}

export interface CreateFormFromTemplateArgs {
  templateId: string;
  organizationId: string;
  title: string;
}

export const templatesResolvers = {
  Query: {
    templates: async (_: any, args: { category?: string }) => {
      try {
        return await getAllTemplates(args.category);
      } catch (error) {
        console.error('Error fetching templates:', error);
        throw new GraphQLError('Failed to fetch templates');
      }
    },

    template: async (_: any, args: { id: string }) => {
      try {
        const template = await getTemplateById(args.id);
        if (!template) {
          throw new GraphQLError('Template not found');
        }
        return template;
      } catch (error) {
        console.error('Error fetching template:', error);
        throw new GraphQLError('Failed to fetch template');
      }
    },

    templatesByCategory: async () => {
      try {
        const templatesByCategory = await getTemplatesByCategory();
        return Object.entries(templatesByCategory).map(([category, templates]) => ({
          category,
          templates,
        }));
      } catch (error) {
        console.error('Error fetching templates by category:', error);
        throw new GraphQLError('Failed to fetch templates by category');
      }
    },

    templateCategories: async () => {
      try {
        return await getTemplateCategories();
      } catch (error) {
        console.error('Error fetching template categories:', error);
        throw new GraphQLError('Failed to fetch template categories');
      }
    },
  },

  Mutation: {
    createTemplate: async (_: any, args: CreateTemplateArgs) => {
      try {
        return await createTemplate(args.input);
      } catch (error) {
        console.error('Error creating template:', error);
        throw new GraphQLError('Failed to create template');
      }
    },

    updateTemplate: async (_: any, args: UpdateTemplateArgs) => {
      try {
        const updatedTemplate = await updateTemplate(args.id, args.input);
        if (!updatedTemplate) {
          throw new GraphQLError('Template not found');
        }
        return updatedTemplate;
      } catch (error) {
        console.error('Error updating template:', error);
        throw new GraphQLError('Failed to update template');
      }
    },

    deleteTemplate: async (_: any, args: { id: string }) => {
      try {
        return await deleteTemplate(args.id);
      } catch (error) {
        console.error('Error deleting template:', error);
        throw new GraphQLError('Failed to delete template');
      }
    },

    createFormFromTemplate: async (_: any, args: CreateFormFromTemplateArgs, context: any) => {
      try {
        // Get the template
        const template = await getTemplateById(args.templateId);
        if (!template) {
          throw new GraphQLError('Template not found');
        }

        // Ensure user is authenticated
        if (!context.user) {
          throw new GraphQLError('Authentication required');
        }

        // Generate form ID upfront
        const newFormId = randomUUID();
        
        // Clone the template schema to avoid modifying the original
        let formSchema = JSON.parse(JSON.stringify(template.formSchema));
        
        // Check if template has a background image and copy it for the new form
        if (formSchema.layout && formSchema.layout.backgroundImageKey) {
          try {
            console.log('Copying background image for new form:', formSchema.layout.backgroundImageKey);
            
            // Copy the background image file
            const copiedFile = await copyFileForForm(formSchema.layout.backgroundImageKey, newFormId);
            
            // Update the form schema with the new background image key
            formSchema.layout.backgroundImageKey = copiedFile.key;
            
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
            
            console.log('Successfully copied background image:', copiedFile.key);
          } catch (copyError) {
            console.error('Error copying background image:', copyError);
            // Continue with form creation even if image copy fails
            // But remove the backgroundImageKey to avoid broken references
            formSchema.layout.backgroundImageKey = '';
          }
        }

        // Create a new form using the modified schema and initialize YJS
        const newForm = await createForm({
          id: newFormId,
          title: args.title,
          description: `Created from template: ${template.name}`,
          shortUrl: '', // Will be generated in createForm service
          isPublished: false,
          organizationId: args.organizationId,
          createdById: context.user.id,
        }, formSchema); // Initialize YJS document with modified schema

        // After form creation, check if it has a backgroundImageKey and create FormFile record
        // This handles cases where the template background image copying happens outside our logic
        if (newForm && formSchema.layout && formSchema.layout.backgroundImageKey) {
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
              
              // Update the YJS document with the new background image key
              // This ensures the form uses the copied image, not the template image
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
              // Check if FormFile record already exists for non-template images
              const existingFormFile = await prisma.formFile.findFirst({
                where: {
                  formId: newFormId,
                  key: formSchema.layout.backgroundImageKey,
                  type: 'FormBackground'
                }
              });

              if (!existingFormFile) {
                console.log('Creating FormFile record for existing background image:', formSchema.layout.backgroundImageKey);
                
                // Extract filename from the key
                const originalFileName = formSchema.layout.backgroundImageKey.split('/').pop() || 'background.jpg';
                
                // Create FormFile record for the background image
                await prisma.formFile.create({
                  data: {
                    id: randomUUID(),
                    key: formSchema.layout.backgroundImageKey,
                    type: 'FormBackground',
                    formId: newFormId,
                    originalName: originalFileName,
                    url: `${s3Config.cdnUrl}/${formSchema.layout.backgroundImageKey}`,
                    size: 0, // Size not available for existing images
                    mimeType: 'image/jpeg', // Default mime type
                  }
                });
                
                console.log('Successfully created FormFile record for existing background');
              } else {
                console.log('FormFile record already exists for background image');
              }
            }
          } catch (formFileError) {
            console.error('Error handling template background image:', formFileError);
            // Don't fail form creation if FormFile creation fails
          }
        }

        return newForm;
      } catch (error) {
        console.error('Error creating form from template:', error);
        throw new GraphQLError('Failed to create form from template');
      }
    },
  },
};
