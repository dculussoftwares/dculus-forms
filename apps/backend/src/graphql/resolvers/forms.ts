import {
  getFormByShortUrl,
  createForm,
  updateForm,
  deleteForm,
  regenerateShortUrl,
  duplicateForm as duplicateFormService,
} from '../../services/formService.js';
import { getTemplateById } from '../../services/templateService.js';
import { getFormMetadata, constructBackgroundImageUrl } from '../../services/formMetadataService.js';
import { BetterAuthContext, requireAuth, requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { generateId } from '@dculus/utils';
import { copyFileForForm } from '../../services/fileUploadService.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import { prisma } from '../../lib/prisma.js';
import { randomUUID } from 'crypto';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { checkUsageExceeded } from '../../subscriptions/usageService.js';
import { logger } from '../../lib/logger.js';

export const formsResolvers = {
  Query: {
    form: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Check if user has access to this form
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.VIEWER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return accessCheck.form;
    },
    formByShortUrl: async (_: any, { shortUrl }: { shortUrl: string }) => {
      const form = await getFormByShortUrl(shortUrl);
      if (!form) throw createGraphQLError("Form not found", GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      if (!form.isPublished) throw createGraphQLError("Form is not published", GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);

      // Check subscription usage limits
      const usageExceeded = await checkUsageExceeded(form.organizationId);
      if (usageExceeded.viewsExceeded) {
        throw createGraphQLError("Form view limit exceeded for this organization's subscription plan", GRAPHQL_ERROR_CODES.VIEW_LIMIT_EXCEEDED);
      }

      // Check submission limits
      if (form.settings?.submissionLimits) {
        const limits = form.settings.submissionLimits;

        // Check maximum responses limit
        if (limits.maxResponses?.enabled) {
          const currentResponseCount = await prisma.response.count({
            where: { formId: form.id }
          });

          if (currentResponseCount >= limits.maxResponses.limit) {
            throw createGraphQLError("Form has reached its maximum response limit", GRAPHQL_ERROR_CODES.MAX_RESPONSES_REACHED);
          }
        }

        // Check time window limits
        if (limits.timeWindow?.enabled) {
          const now = new Date();

          if (limits.timeWindow.startDate) {
            const startDate = new Date(limits.timeWindow.startDate + 'T00:00:00');
            if (now < startDate) {
              throw createGraphQLError("Form is not yet open for submissions", GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN);
            }
          }

          if (limits.timeWindow.endDate) {
            const endDate = new Date(limits.timeWindow.endDate + 'T23:59:59');
            if (now > endDate) {
              throw createGraphQLError("Form submission period has ended", GRAPHQL_ERROR_CODES.FORM_CLOSED);
            }
          }
        }
      }

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
    settings: (parent: any) => {
      // Parse JSON settings from database or return null if no settings
      if (parent.settings) {
        return JSON.parse(typeof parent.settings === 'string' ? parent.settings : JSON.stringify(parent.settings));
      }
      return null;
    },
    responseCount: async (parent: any) => {
      // Count total responses for this form
      const count = await prisma.response.count({
        where: { formId: parent.id }
      });
      return count;
    },
    dashboardStats: async (parent: any) => {
      const formId = parent.id;

      // Get time boundaries
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get response counts for different time periods
      const [
        responsesToday,
        responsesThisWeek,
        responsesThisMonth,
        totalViews,
        submissionAnalytics
      ] = await Promise.all([
        // Responses today
        prisma.response.count({
          where: {
            formId,
            submittedAt: { gte: today }
          }
        }),

        // Responses this week
        prisma.response.count({
          where: {
            formId,
            submittedAt: { gte: weekAgo }
          }
        }),

        // Responses this month
        prisma.response.count({
          where: {
            formId,
            submittedAt: { gte: monthAgo }
          }
        }),

        // Total views for response rate calculation
        prisma.formViewAnalytics.count({
          where: { formId }
        }),

        // Get submission analytics for average completion time
        prisma.formSubmissionAnalytics.findMany({
          where: {
            responseId: {
              in:
                await prisma.response.findMany({
                  where: { formId },
                  select: { id: true }
                }).then(responses => responses.map(r => r.id))
            }
          },
          select: { completionTimeSeconds: true }
        })
      ]);

      // Calculate average completion time in seconds
      let averageCompletionTime = null;
      if (submissionAnalytics.length > 0) {
        const validCompletionTimes = submissionAnalytics
          .map(s => s.completionTimeSeconds)
          .filter((t): t is number => t !== null && t > 0);

        if (validCompletionTimes.length > 0) {
          averageCompletionTime = validCompletionTimes.reduce((sum, time) => sum + time, 0) / validCompletionTimes.length;
        }
      }

      // Calculate response rate as percentage
      const totalResponses = await prisma.response.count({ where: { formId } });
      const responseRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;

      return {
        averageCompletionTime,
        responseRate,
        responsesToday,
        responsesThisWeek,
        responsesThisMonth
      };
    },
  },
  Mutation: {
    createForm: async (
      _: any,
      { input }: { input: { templateId?: string; formSchema?: any; title: string; description?: string; organizationId: string } },
      context: { auth: BetterAuthContext }
    ) => {
      // 🔒 SECURITY: Verify user is a member of the target organization
      await requireOrganizationMembership(context.auth, input.organizationId);

      // ✅ VALIDATION: Ensure exactly one of templateId or formSchema is provided
      const hasTemplateId = !!input.templateId;
      const hasFormSchema = !!input.formSchema;

      if (!hasTemplateId && !hasFormSchema) {
        throw createGraphQLError('Either templateId or formSchema must be provided', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      if (hasTemplateId && hasFormSchema) {
        throw createGraphQLError('Cannot provide both templateId and formSchema', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      // Generate form ID upfront
      const newFormId = generateId();

      let formSchema: any;

      // 📋 Get schema from template OR use provided schema
      if (hasTemplateId) {
        // Existing flow: Fetch template and clone schema
        const template = await getTemplateById(input.templateId!);
        if (!template) {
          throw createGraphQLError('Template not found', GRAPHQL_ERROR_CODES.TEMPLATE_NOT_FOUND);
        }
        formSchema = JSON.parse(JSON.stringify(template.formSchema));
      } else {
        // New flow: Use provided schema with validation
        formSchema = input.formSchema;

        // Validate schema structure
        if (!formSchema.pages || !Array.isArray(formSchema.pages)) {
          throw createGraphQLError('Invalid formSchema: pages array is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }

        if (!formSchema.layout || typeof formSchema.layout !== 'object') {
          throw createGraphQLError('Invalid formSchema: layout object is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }

        // Ensure backgroundImageKey is initialized
        if (!formSchema.layout.backgroundImageKey) {
          formSchema.layout.backgroundImageKey = '';
        }
      }

      // Track if we need to create FormFile record after form creation
      let copiedFileInfo: any = null;

      // Always copy background images from templates to ensure unique keys for each form
      // Check for both truthy value AND non-empty string
      if (formSchema.layout && formSchema.layout.backgroundImageKey && formSchema.layout.backgroundImageKey.trim() !== '') {
        try {
          // Always copy the background image to create a unique key with formId
          const copiedFile = await copyFileForForm(formSchema.layout.backgroundImageKey, newFormId);

          // Update the form schema with the new unique key
          formSchema.layout.backgroundImageKey = copiedFile.key;

          // Store file info to create FormFile record AFTER form is created
          copiedFileInfo = copiedFile;
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

      const formData = {
        id: newFormId,
        title: input.title,
        description: input.description,
        shortUrl: '', // Will be generated in createForm service
        isPublished: false,
        organizationId: input.organizationId,
        createdById: context.auth.user!.id,
      };

      // Create the form first (this creates the database record)
      const newForm = await createForm(formData, formSchema);

      // NOW create the FormFile record after the form exists in the database
      if (copiedFileInfo) {
        try {
          await prisma.formFile.create({
            data: {
              id: randomUUID(),
              key: copiedFileInfo.key,
              type: 'FormBackground',
              formId: newFormId,
              originalName: copiedFileInfo.originalName,
              url: copiedFileInfo.url,
              size: copiedFileInfo.size,
              mimeType: copiedFileInfo.mimeType,
            }
          });
        } catch (formFileError) {
          logger.error('Error creating FormFile record:', formFileError);
          // Don't fail the entire operation if FormFile creation fails
        }
      }

      return newForm;
    },
    updateForm: async (_: any, { id, input }: { id: string; input: any }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Analyze input to determine required permission level
      const hasProp = (prop: string) =>
        Object.prototype.hasOwnProperty.call(input, prop);
      const hasLayoutChanges =
        ['title', 'description', 'settings'].some(hasProp);
      const hasCriticalChanges =
        ['isPublished', 'shortUrl', 'organizationId'].some(hasProp);

      // Determine required permission level based on update type
      let requiredPermission: string = PermissionLevel.EDITOR;

      if (hasCriticalChanges) {
        // Critical changes like publishing, URL changes, org changes require OWNER
        requiredPermission = PermissionLevel.OWNER;
      } else if (hasLayoutChanges) {
        // Layout and content changes require EDITOR
        requiredPermission = PermissionLevel.EDITOR;
      }

      // Check if user has required access level
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, requiredPermission as any);
      if (!accessCheck.hasAccess) {
        const permissionName = requiredPermission === 'OWNER' ? 'owner' : 'editor';
        throw createGraphQLError(`Access denied: ${permissionName} permissions required for this type of update`, GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Additional validation for specific fields
      if (hasProp('organizationId') && input.organizationId !== accessCheck.form.organizationId) {
        // Only allow moving forms within same organization for now
        throw createGraphQLError('Access denied: Cannot transfer form to different organization', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      if (hasProp('createdById')) {
        // Never allow changing form ownership through update
        throw createGraphQLError('Access denied: Cannot change form ownership through update', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      const updateData = {
        ...input,
        updatedAt: new Date(),
      };
      return await updateForm(id, updateData, context.auth.user!.id);
    },
    deleteForm: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Check if user has OWNER access to delete this form
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.OWNER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: Only the form owner can delete this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return await deleteForm(id, context.auth.user!.id);
    },
    regenerateShortUrl: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // 🔒 SECURITY: Check if user has OWNER access to regenerate URL
      // Regenerating URL breaks all existing shared links - this is a critical operation
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.OWNER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: Only form owners can regenerate the URL (this breaks all existing shared links)', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return await regenerateShortUrl(id);
    },
    duplicateForm: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Duplicating requires edit access to the source form
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to duplicate this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return await duplicateFormService(id, context.auth.user!.id);
    },
  },
};
