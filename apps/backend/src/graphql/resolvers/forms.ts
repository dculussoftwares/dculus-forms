import {
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
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { generateId } from '@dculus/utils';
import { copyFileForForm } from '../../services/fileUploadService.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import { constructCdnUrl } from '../../utils/cdn.js';
import { prisma } from '../../lib/prisma.js';
import { randomUUID } from 'crypto';
import { GraphQLError } from 'graphql';
import { checkUsageExceeded } from '../../subscriptions/usageService.js';

export const formsResolvers = {
  Query: {
    form: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      
      // Check if user has access to this form
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.VIEWER);
      if (!accessCheck.hasAccess) {
        throw new GraphQLError('Access denied: You do not have permission to view this form');
      }
      
      return accessCheck.form;
    },
    formByShortUrl: async (_: any, { shortUrl }: { shortUrl: string }) => {
      const form = await getFormByShortUrl(shortUrl);
      if (!form) throw new Error("Form not found");
      if (!form.isPublished) throw new Error("Form is not published");

      // Check subscription usage limits
      const usageExceeded = await checkUsageExceeded(form.organizationId);
      if (usageExceeded.viewsExceeded) {
        throw new Error("Form view limit exceeded for this organization's subscription plan");
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
            throw new Error("Form has reached its maximum response limit");
          }
        }
        
        // Check time window limits
        if (limits.timeWindow?.enabled) {
          const now = new Date();
          
          if (limits.timeWindow.startDate) {
            const startDate = new Date(limits.timeWindow.startDate + 'T00:00:00');
            if (now < startDate) {
              throw new Error("Form is not yet open for submissions");
            }
          }
          
          if (limits.timeWindow.endDate) {
            const endDate = new Date(limits.timeWindow.endDate + 'T23:59:59');
            if (now > endDate) {
              throw new Error("Form submission period has ended");
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
          where: { responseId: { in:
            await prisma.response.findMany({
              where: { formId },
              select: { id: true }
            }).then(responses => responses.map(r => r.id))
          }},
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
      
      // Always copy background images from templates to ensure unique keys for each form
      if (formSchema.layout && formSchema.layout.backgroundImageKey) {
        try {
          console.log('Template has background image, copying to form-specific location:', formSchema.layout.backgroundImageKey);
          
          // Always copy the background image to create a unique key with formId
          const copiedFile = await copyFileForForm(formSchema.layout.backgroundImageKey, newFormId);
          
          // Update the form schema with the new unique key
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
      
      // Analyze input to determine required permission level
      const hasLayoutChanges = input.hasOwnProperty('title') || 
                             input.hasOwnProperty('description') || 
                             input.hasOwnProperty('settings');
      
      const hasCriticalChanges = input.hasOwnProperty('isPublished') || 
                                input.hasOwnProperty('shortUrl') || 
                                input.hasOwnProperty('organizationId');
      
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
        throw new GraphQLError(`Access denied: ${permissionName} permissions required for this type of update`);
      }
      
      // Additional validation for specific fields
      if (input.hasOwnProperty('organizationId') && input.organizationId !== accessCheck.form.organizationId) {
        // Only allow moving forms within same organization for now
        throw new GraphQLError('Access denied: Cannot transfer form to different organization');
      }
      
      if (input.hasOwnProperty('createdById')) {
        // Never allow changing form ownership through update
        throw new GraphQLError('Access denied: Cannot change form ownership through update');
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
        throw new GraphQLError('Access denied: Only the form owner can delete this form');
      }
      
      return await deleteForm(id, context.auth.user!.id);
    },
    regenerateShortUrl: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      
      // Check if user has EDITOR access to regenerate URL
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        throw new GraphQLError('Access denied: You do not have permission to regenerate the URL for this form');
      }
      
      return await regenerateShortUrl(id);
    },
  },
};
