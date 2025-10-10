import {
  deleteResponse,
  getAllResponses,
  getResponseById,
  getResponsesByFormId,
  submitResponse,
  updateResponse,
} from '../../services/responseService.js';
import { getFormById } from '../../services/formService.js';
import {
  BetterAuthContext,
  requireAuth,
} from '../../middleware/better-auth-middleware.js';
import {
  createFieldLabelsMap,
  generateId,
  substituteMentions,
} from '@dculus/utils';
import { deserializeFormSchema } from '@dculus/types';
import { analyticsService } from '../../services/analyticsService.js';
import { eventBus } from '../../lib/event-bus.js';

export const responsesResolvers = {
  Query: {
    responses: async (
      _: any,
      { organizationId }: { organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      return await getAllResponses(organizationId);
    },
    response: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const response = await getResponseById(id);
      if (!response) throw new Error('Response not found');
      return response;
    },
    responsesByForm: async (
      _: any,
      {
        formId,
        page,
        limit,
        sortBy,
        sortOrder,
        filters,
      }: {
        formId: string;
        page: number;
        limit: number;
        sortBy: string;
        sortOrder: string;
        filters?: any[];
      },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Check if the user has access to this form before allowing response access
      const form = await getFormById(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      // Check if user is a member of the organization that owns this form
      const userSession = context.auth.session;
      if (
        !userSession ||
        userSession.activeOrganizationId !== form.organizationId
      ) {
        throw new Error(
          'Access denied: You do not have permission to view responses for this form'
        );
      }

      return await getResponsesByFormId(
        formId,
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      );
    },
  },
  Mutation: {
    submitResponse: async (_: any, { input }: { input: any }, context: any) => {
      // Get form first to check if it exists and is published
      const form = await getFormById(input.formId);
      if (!form) {
        throw new Error('Form not found');
      }

      // Check if form is published - critical business rule
      if (!form.isPublished) {
        throw new Error('Form is not published and cannot accept responses');
      }

      // Check submission limits if they exist
      if (form.settings?.submissionLimits) {
        const limits = form.settings.submissionLimits;

        // Check maximum responses limit
        if (limits.maxResponses?.enabled) {
          // Count current responses
          const currentResponseCount = await getAllResponses(
            form.organizationId
          ).then(
            (responses) =>
              responses.filter((r) => r.formId === input.formId).length
          );

          if (currentResponseCount >= limits.maxResponses.limit) {
            throw new Error('Form has reached its maximum response limit');
          }
        }

        // Check time window limits
        if (limits.timeWindow?.enabled) {
          const now = new Date();

          if (limits.timeWindow.startDate) {
            const startDate = new Date(
              limits.timeWindow.startDate + 'T00:00:00'
            );
            if (now < startDate) {
              throw new Error('Form is not yet open for submissions');
            }
          }

          if (limits.timeWindow.endDate) {
            const endDate = new Date(limits.timeWindow.endDate + 'T23:59:59');
            if (now > endDate) {
              throw new Error('Form submission period has ended');
            }
          }
        }
      }

      // If all limits pass, save the response
      const responseData = {
        id: generateId(),
        formId: input.formId,
        data: input.data,
        submittedAt: new Date(),
      };
      const response = await submitResponse(responseData);

      // Track submission analytics if analytics data is provided
      if (input.sessionId && input.userAgent) {
        try {
          // Get client IP from request
          const clientIP =
            context.req?.ip ||
            context.req?.connection?.remoteAddress ||
            context.req?.socket?.remoteAddress ||
            (context.req?.headers?.['x-forwarded-for'] as string)?.split(
              ','
            )[0];

          // Track the submission analytics
          await analyticsService.trackFormSubmission(
            {
              formId: input.formId,
              responseId: response.id,
              sessionId: input.sessionId,
              userAgent: input.userAgent,
              timezone: input.timezone,
              language: input.language,
              completionTimeSeconds: input.completionTimeSeconds,
            },
            clientIP
          );

          console.log(
            `Submission analytics tracked for form ${input.formId}, response ${response.id}`
          );
        } catch (error) {
          // Log error but don't fail the response submission
          console.error('Error tracking submission analytics:', error);
        }
      }

      // Emit plugin event for form submission
      try {
        await eventBus.emit('form.submitted', {
          formId: input.formId,
          responseId: response.id,
          data: input.data
        });
        console.log(`Plugin event emitted for form submission: ${input.formId}`);
      } catch (error) {
        console.error('Error emitting plugin event:', error);
      }

      // Get form with settings to determine thank you message
      const formWithSettings = await getFormById(input.formId);

      // Determine thank you message
      let thankYouMessage =
        'Thank you! Your form has been submitted successfully.';
      let showCustomThankYou = false;

      if (
        formWithSettings?.settings?.thankYou?.enabled &&
        formWithSettings.settings.thankYou.message
      ) {
        thankYouMessage = formWithSettings.settings.thankYou.message;
        showCustomThankYou = true;

        // Apply mention substitution if we have a custom message
        try {
          // Create field labels map from form schema for better fallback display
          let fieldLabels: Record<string, string> = {};

          if (formWithSettings.formSchema) {
            const deserializedSchema = deserializeFormSchema(
              formWithSettings.formSchema
            );
            fieldLabels = createFieldLabelsMap(deserializedSchema);
          }

          // Apply mention substitution to replace field IDs with actual user responses
          thankYouMessage = substituteMentions(
            thankYouMessage,
            input.data, // User responses as field_id: value pairs
            fieldLabels // Field labels for fallback display
          );
        } catch (error) {
          // If substitution fails, log error but continue with original message
          console.error('Failed to apply mention substitution:', error);
          // thankYouMessage remains the original HTML with mentions
        }
      }

      return {
        ...response,
        thankYouMessage,
        showCustomThankYou,
      };
    },
    updateResponse: async (
      _: any,
      {
        input,
      }: {
        input: {
          responseId: string;
          data: Record<string, any>;
          editReason?: string;
        };
      },
      context: { auth: BetterAuthContext; req?: any }
    ) => {
      requireAuth(context.auth);

      // 1. Validate response exists
      const existingResponse = await getResponseById(input.responseId);
      if (!existingResponse) {
        throw new Error('Response not found');
      }

      // 2. Check user permissions (form owner/editor access)
      const form = await getFormById(existingResponse.formId);
      if (!form) {
        throw new Error('Form not found');
      }

      const userSession = context.auth.session;
      if (
        !userSession ||
        userSession.activeOrganizationId !== form.organizationId
      ) {
        throw new Error(
          'Access denied: You do not have permission to edit this response'
        );
      }

      // 3. Prepare edit tracking context
      const editContext = {
        userId: context.auth.user.id,
        ipAddress:
          context.req?.ip ||
          context.req?.connection?.remoteAddress ||
          context.req?.socket?.remoteAddress ||
          (context.req?.headers?.['x-forwarded-for'] as string)?.split(',')[0],
        userAgent: context.req?.headers?.['user-agent'],
        editReason: input.editReason,
      };

      // 4. Update response data with edit tracking
      return await updateResponse(input.responseId, input.data, editContext);
    },
    deleteResponse: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const existingResponse = await getResponseById(id);
      if (!existingResponse) {
        throw new Error('Response not found');
      }
      return await deleteResponse(id);
    },
  },
};

// Create extended resolvers with edit tracking functionality
console.log('Loading extendedResponsesResolvers with FormResponse field resolvers');
export const extendedResponsesResolvers = {
  Query: {
    ...responsesResolvers.Query,

    responseEditHistory: async (
      _: any,
      { responseId }: { responseId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const { ResponseEditTrackingService } = await import(
        '../../services/responseEditTrackingService.js'
      );

      // Check permissions
      const existingResponse = await getResponseById(responseId);
      if (!existingResponse) {
        throw new Error('Response not found');
      }

      const form = await getFormById(existingResponse.formId);
      if (!form) {
        throw new Error('Form not found');
      }

      const userSession = context.auth.session;
      if (
        !userSession ||
        userSession.activeOrganizationId !== form.organizationId
      ) {
        throw new Error(
          'Access denied: You do not have permission to view edit history for this response'
        );
      }

      // Get edit history
      const editHistory =
        await ResponseEditTrackingService.getEditHistory(responseId);

      return editHistory.map((edit) => ({
        id: edit.id,
        responseId: edit.responseId,
        editedBy: edit.editedBy,
        editedAt: edit.editedAt.toISOString(),
        editType: edit.editType,
        editReason: edit.editReason,
        ipAddress: edit.ipAddress,
        userAgent: edit.userAgent,
        totalChanges: edit.totalChanges,
        changesSummary: edit.changesSummary,
        fieldChanges: edit.fieldChanges.map((change) => ({
          id: change.id,
          fieldId: change.fieldId,
          fieldLabel: change.fieldLabel,
          fieldType: change.fieldType,
          previousValue: change.previousValue,
          newValue: change.newValue,
          changeType: change.changeType,
          valueChangeSize: change.valueChangeSize,
        })),
      }));
    },
  },

  Mutation: {
    ...responsesResolvers.Mutation,
  },

  FormResponse: {
    hasBeenEdited: async (parent: any) => {
      console.log('hasBeenEdited resolver executing for response:', parent.id);
      try {
        const { ResponseEditTrackingService } = await import(
          '../../services/responseEditTrackingService.js'
        );
        const editHistory = await ResponseEditTrackingService.getEditHistory(parent.id);
        return editHistory.length > 0;
      } catch (error) {
        console.error('Error getting hasBeenEdited for response:', parent.id, error);
        return false;
      }
    },

    totalEdits: async (parent: any) => {
      try {
        const { ResponseEditTrackingService } = await import(
          '../../services/responseEditTrackingService.js'
        );
        const editHistory = await ResponseEditTrackingService.getEditHistory(parent.id);
        return editHistory.length;
      } catch (error) {
        console.error('Error getting totalEdits for response:', parent.id, error);
        return 0;
      }
    },

    lastEditedAt: async (parent: any) => {
      try {
        const { ResponseEditTrackingService } = await import(
          '../../services/responseEditTrackingService.js'
        );
        const editHistory = await ResponseEditTrackingService.getEditHistory(parent.id);
        if (editHistory.length > 0) {
          // Most recent edit is first in the array
          return editHistory[0].editedAt.toISOString();
        }
        return null;
      } catch (error) {
        console.error('Error getting lastEditedAt for response:', parent.id, error);
        return null;
      }
    },

    lastEditedBy: async (parent: any) => {
      try {
        const { ResponseEditTrackingService } = await import(
          '../../services/responseEditTrackingService.js'
        );
        const editHistory = await ResponseEditTrackingService.getEditHistory(parent.id);
        if (editHistory.length > 0) {
          // Most recent edit is first in the array
          const lastEdit = editHistory[0];
          // editedBy is already a full User object with id, name, email, image
          return lastEdit.editedBy;
        }
        return null;
      } catch (error) {
        console.error('Error getting lastEditedBy for response:', parent.id, error);
        return null;
      }
    },

    editHistory: async (parent: any) => {
      try {
        const { ResponseEditTrackingService } = await import(
          '../../services/responseEditTrackingService.js'
        );
        return await ResponseEditTrackingService.getEditHistory(parent.id);
      } catch (error) {
        console.error('Error getting editHistory for response:', parent.id, error);
        return [];
      }
    },
  },
};
