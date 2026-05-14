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
  requireOrganizationMembership,
} from '../../middleware/better-auth-middleware.js';
import {
  createFieldLabelsMap,
  generateId,
  substituteMentions,
} from '@dculus/utils';
import { deserializeFormSchema } from '@dculus/types';
import { analyticsService } from '../../services/analyticsService.js';
import { emitFormSubmitted } from '../../plugins/events.js';
import { checkUsageExceeded } from '../../subscriptions/usageService.js';
import { emitFormSubmitted as emitSubscriptionFormSubmitted } from '../../subscriptions/events.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { logger } from '../../lib/logger.js';

interface ResponseParent {
  id: string;
  _editHistoryPromise?: Promise<Awaited<ReturnType<typeof import('../../services/responseEditTrackingService.js').ResponseEditTrackingService.getEditHistory>>>;
}

// Stores a Promise on the parent object so all 5 FormResponse field resolvers that
// need edit history share one DB query per response per request, instead of firing 5.
async function getEditHistoryMemoised(parent: ResponseParent) {
  if (!parent._editHistoryPromise) {
    const { ResponseEditTrackingService } = await import(
      '../../services/responseEditTrackingService.js'
    );
    parent._editHistoryPromise = ResponseEditTrackingService.getEditHistory(parent.id);
  }
  return parent._editHistoryPromise;
}

export const responsesResolvers = {
  Query: {
    responses: async (
      _: any,
      { organizationId }: { organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      // 🔒 SECURITY: Verify user is a member of the target organization
      await requireOrganizationMembership(context.auth, organizationId);

      return await getAllResponses(organizationId);
    },
    response: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const response = await getResponseById(id);
      if (!response) throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);

      const accessCheck = await checkFormAccess(context.auth.user!.id, response.formId, PermissionLevel.VIEWER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view this response', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return response;
    },
    responsesByForm: async (
      _: any,
      {
        formId,
        page = 1,
        limit = 10,
        sortBy = 'submittedAt',
        sortOrder = 'desc',
        filters,
        filterLogic = 'AND',
      }: {
        formId: string;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: string;
        filters?: any[];
        filterLogic?: 'AND' | 'OR';
      },
      context: { auth: BetterAuthContext; req?: any }
    ) => {
      requireAuth(context.auth);

      // Check if the user has access to this form before allowing response access
      const form = await getFormById(formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      await requireOrganizationMembership(context.auth, form.organizationId);

      return await getResponsesByFormId(
        formId,
        page,
        limit,
        sortBy,
        sortOrder as 'asc' | 'desc',
        filters,
        filterLogic
      );
    },
  },
  Mutation: {
    submitResponse: async (_: any, { input }: { input: any }, context: { auth: BetterAuthContext; req?: any }) => {
      // Get form first to check if it exists and is published
      const form = await getFormById(input.formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      // Check if form is published - critical business rule
      if (!form.isPublished) {
        throw createGraphQLError('Form is not published and cannot accept responses', GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);
      }

      // Check subscription usage limits
      const usageExceeded = await checkUsageExceeded(form.organizationId);
      if (usageExceeded.submissionsExceeded) {
        throw createGraphQLError('Form submission limit exceeded for this organization subscription plan', GRAPHQL_ERROR_CODES.SUBMISSION_LIMIT_EXCEEDED);
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
            throw createGraphQLError('Form has reached its maximum response limit', GRAPHQL_ERROR_CODES.MAX_RESPONSES_REACHED);
          }
        }

        // Check time window limits
        if (limits.timeWindow?.enabled) {
          const now = new Date();
          const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

          if (limits.timeWindow.startDate) {
            if (!ISO_DATE_RE.test(limits.timeWindow.startDate)) {
              throw createGraphQLError('Form has an invalid start date configured', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
            }
            const startDate = new Date(limits.timeWindow.startDate + 'T00:00:00');
            if (isNaN(startDate.getTime())) {
              throw createGraphQLError('Form has an invalid start date configured', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
            }
            if (now < startDate) {
              throw createGraphQLError('Form is not yet open for submissions', GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN);
            }
          }

          if (limits.timeWindow.endDate) {
            if (!ISO_DATE_RE.test(limits.timeWindow.endDate)) {
              throw createGraphQLError('Form has an invalid end date configured', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
            }
            const endDate = new Date(limits.timeWindow.endDate + 'T23:59:59');
            if (isNaN(endDate.getTime())) {
              throw createGraphQLError('Form has an invalid end date configured', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
            }
            if (now > endDate) {
              throw createGraphQLError('Form submission period has ended', GRAPHQL_ERROR_CODES.FORM_CLOSED);
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

          logger.info(
            `Submission analytics tracked for form ${input.formId}, response ${response.id}`
          );
        } catch (error) {
          // Log error but don't fail the response submission
          logger.error('Error tracking submission analytics:', error);
        }
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
          logger.error('Failed to apply mention substitution:', error);
          // thankYouMessage remains the original HTML with mentions
        }
      }

      // Emit plugin event for form submission
      try {
        emitFormSubmitted(input.formId, form.organizationId, {
          responseId: response.id,
          submittedAt: response.submittedAt.toISOString(),
          ...input.data,
        });
      } catch (error) {
        // Log error but don't fail the response submission
        logger.error('Error emitting form.submitted event:', error);
      }

      // Emit subscription event for usage tracking
      try {
        emitSubscriptionFormSubmitted(form.organizationId, input.formId, response.id);
      } catch (error) {
        logger.error('Error emitting subscription event:', error);
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
        throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
      }

      // 2. Check user permissions (form owner/editor access)
      const form = await getFormById(existingResponse.formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      await requireOrganizationMembership(context.auth, form.organizationId);

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

      // 🔒 SECURITY: Fetch response with form information
      const existingResponse = await getResponseById(id);
      if (!existingResponse) {
        throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
      }

      // 🔒 SECURITY: Verify user has OWNER access to the form before allowing response deletion
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        existingResponse.formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to delete responses for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return await deleteResponse(id);
    },
  },
};

// Create extended resolvers with edit tracking functionality
logger.info('Loading extendedResponsesResolvers with FormResponse field resolvers');
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
        throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
      }

      const form = await getFormById(existingResponse.formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      await requireOrganizationMembership(context.auth, form.organizationId);

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
    submittedAt: (parent: any) => {
      // Convert Date object to ISO string for GraphQL
      if (parent.submittedAt instanceof Date) {
        return parent.submittedAt.toISOString();
      }
      // If already a string, return as is
      if (typeof parent.submittedAt === 'string') {
        return parent.submittedAt;
      }
      // If it's a number (Unix timestamp), convert to ISO string
      if (typeof parent.submittedAt === 'number') {
        return new Date(parent.submittedAt).toISOString();
      }
      return parent.submittedAt;
    },

    // Memoised per-response-per-request: all 5 field resolvers share one DB round-trip.
    // Storing the Promise on `parent` (the same object for all fields on one response)
    // means the first field to resolve kicks off the query; the rest await the same Promise.
    hasBeenEdited: async (parent: any) => {
      try {
        const history = await getEditHistoryMemoised(parent);
        return history.length > 0;
      } catch (error) {
        logger.error('Error getting hasBeenEdited for response:', parent.id, error);
        return false;
      }
    },

    totalEdits: async (parent: any) => {
      try {
        const history = await getEditHistoryMemoised(parent);
        return history.length;
      } catch (error) {
        logger.error('Error getting totalEdits for response:', parent.id, error);
        return 0;
      }
    },

    lastEditedAt: async (parent: any) => {
      try {
        const history = await getEditHistoryMemoised(parent);
        return history.length > 0 ? history[0].editedAt.toISOString() : null;
      } catch (error) {
        logger.error('Error getting lastEditedAt for response:', parent.id, error);
        return null;
      }
    },

    lastEditedBy: async (parent: any) => {
      try {
        const history = await getEditHistoryMemoised(parent);
        return history.length > 0 ? history[0].editedBy : null;
      } catch (error) {
        logger.error('Error getting lastEditedBy for response:', parent.id, error);
        return null;
      }
    },

    editHistory: async (parent: any) => {
      try {
        return await getEditHistoryMemoised(parent);
      } catch (error) {
        logger.error('Error getting editHistory for response:', parent.id, error);
        return [];
      }
    },
  },
};
