import { GraphQLError } from '#graphql-errors';
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
import { constructCdnUrl } from '../../utils/cdn.js';
import { requireSystemLevelRole, requireAuthentication, type AuthContext } from '../../utils/auth.js';
import { requireOrganizationMembership, BetterAuthContext } from '../../middleware/better-auth-middleware.js';
import { logger } from '../../lib/logger.js';

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
    templates: async (_: any, args: { category?: string }, context: AuthContext) => {
      try {
        // Template queries require any authenticated user
        requireAuthentication(context);
        return await getAllTemplates(args.category);
      } catch (error) {
        logger.error('Error fetching templates:', error);
        // Re-throw GraphQLError as-is to preserve auth error messages
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to fetch templates');
      }
    },

    template: async (_: any, args: { id: string }, context: AuthContext) => {
      try {
        // Template queries require any authenticated user
        requireAuthentication(context);
        const template = await getTemplateById(args.id);
        if (!template) {
          throw new GraphQLError('Template not found');
        }
        return template;
      } catch (error) {
        logger.error('Error fetching template:', error);
        // Re-throw GraphQLError as-is to preserve auth error messages
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to fetch template');
      }
    },

    templatesByCategory: async (_: any, args: any, context: AuthContext) => {
      try {
        // Template queries require any authenticated user
        requireAuthentication(context);
        const templatesByCategory = await getTemplatesByCategory();
        return Object.entries(templatesByCategory).map(([category, templates]) => ({
          category,
          templates,
        }));
      } catch (error) {
        logger.error('Error fetching templates by category:', error);
        // Re-throw GraphQLError as-is to preserve auth error messages
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to fetch templates by category');
      }
    },

    templateCategories: async (_: any, args: any, context: AuthContext) => {
      try {
        // Template queries require any authenticated user
        requireAuthentication(context);
        return await getTemplateCategories();
      } catch (error) {
        logger.error('Error fetching template categories:', error);
        // Re-throw GraphQLError as-is to preserve auth error messages
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to fetch template categories');
      }
    },
  },

  Mutation: {
    createTemplate: async (_: any, args: CreateTemplateArgs, context: AuthContext) => {
      try {
        // Only system-level roles (admin, superAdmin) can create templates
        requireSystemLevelRole(context);
        return await createTemplate(args.input);
      } catch (error) {
        logger.error('Error creating template:', error);
        // Re-throw GraphQLError as-is to preserve auth error messages
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to create template');
      }
    },

    updateTemplate: async (_: any, args: UpdateTemplateArgs, context: AuthContext) => {
      try {
        // Only system-level roles (admin, superAdmin) can update templates
        requireSystemLevelRole(context);
        const updatedTemplate = await updateTemplate(args.id, args.input);
        if (!updatedTemplate) {
          throw new GraphQLError('Template not found');
        }
        return updatedTemplate;
      } catch (error) {
        logger.error('Error updating template:', error);
        // Re-throw GraphQLError as-is to preserve auth error messages
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to update template');
      }
    },

    deleteTemplate: async (_: any, args: { id: string }, context: AuthContext) => {
      try {
        // Only system-level roles (admin, superAdmin) can delete templates
        requireSystemLevelRole(context);
        return await deleteTemplate(args.id);
      } catch (error) {
        logger.error('Error deleting template:', error);
        // Re-throw GraphQLError as-is to preserve auth error messages
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to delete template');
      }
    },

    createFormFromTemplate: async (_: any, args: CreateFormFromTemplateArgs, context: AuthContext & { auth: BetterAuthContext }) => {
      try {
        // Ensure user is authenticated first - any authenticated user can create forms from templates
        const user = requireAuthentication(context);

        // 🔒 SECURITY: Verify user is a member of the target organization before creating form
        await requireOrganizationMembership(context.auth, args.organizationId);

        // Get the template
        const template = await getTemplateById(args.templateId);
        if (!template) {
          throw new GraphQLError('Template not found');
        }

        // Generate form ID upfront
        const newFormId = randomUUID();
        
        // Clone the template schema to avoid modifying the original
        const formSchema = JSON.parse(JSON.stringify(template.formSchema));
        
        // Check if template has a background image and copy it for the new form
        // Check for both truthy value AND non-empty string
        if (formSchema.layout && formSchema.layout.backgroundImageKey && formSchema.layout.backgroundImageKey.trim() !== '') {
          try {
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
          } catch (copyError) {
            logger.error('Error copying background image:', copyError);
            // Continue with form creation even if image copy fails
            // But remove the backgroundImageKey to avoid broken references
            formSchema.layout.backgroundImageKey = '';
          }
        } else {
          // Ensure backgroundImageKey is set to empty string if not present
          if (formSchema.layout) {
            formSchema.layout.backgroundImageKey = formSchema.layout.backgroundImageKey || '';
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
          createdById: user.id,
        }, formSchema); // Initialize YJS document with modified schema

        return newForm;
      } catch (error) {
        logger.error('Error creating form from template:', error);
        // Re-throw GraphQLError as-is to preserve auth error messages
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to create form from template');
      }
    },
  },
};

