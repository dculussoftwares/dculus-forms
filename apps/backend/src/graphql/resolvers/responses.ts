import { 
  getAllResponses, 
  getResponseById, 
  getResponsesByFormId, 
  submitResponse, 
  deleteResponse 
} from '../../services/responseService.js';
import { getFormById } from '../../services/formService.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { generateId, substituteMentions, createFieldLabelsMap } from '@dculus/utils';
import { deserializeFormSchema } from '@dculus/types';
import { analyticsService } from '../../services/analyticsService.js';

export const responsesResolvers = {
  Query: {
    responses: async (_: any, { organizationId }: { organizationId: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      return await getAllResponses(organizationId);
    },
    response: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const response = await getResponseById(id);
      if (!response) throw new Error("Response not found");
      return response;
    },
    responsesByForm: async (_: any, { formId, page, limit, sortBy, sortOrder, filters }: { formId: string, page: number, limit: number, sortBy: string, sortOrder: string, filters?: any[] }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Check if the user has access to this form before allowing response access
      const form = await getFormById(formId);
      if (!form) {
        throw new Error("Form not found");
      }

      // Check if user is a member of the organization that owns this form
      const userSession = context.auth.session;
      if (!userSession || userSession.activeOrganizationId !== form.organizationId) {
        throw new Error("Access denied: You do not have permission to view responses for this form");
      }

      return await getResponsesByFormId(formId, page, limit, sortBy, sortOrder, filters);
    },
  },
  Mutation: {
    submitResponse: async (_: any, { input }: { input: any }, context: any) => {
      // Get form first to check if it exists and is published
      const form = await getFormById(input.formId);
      if (!form) {
        throw new Error("Form not found");
      }

      // Check if form is published - critical business rule
      if (!form.isPublished) {
        throw new Error("Form is not published and cannot accept responses");
      }

      // Check submission limits if they exist
      if (form.settings?.submissionLimits) {
        const limits = form.settings.submissionLimits;
        
        // Check maximum responses limit
        if (limits.maxResponses?.enabled) {
          // Count current responses
          const currentResponseCount = await getAllResponses(form.organizationId)
            .then(responses => responses.filter(r => r.formId === input.formId).length);
          
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
          const clientIP = context.req?.ip || 
                          context.req?.connection?.remoteAddress || 
                          context.req?.socket?.remoteAddress || 
                          (context.req?.headers?.['x-forwarded-for'] as string)?.split(',')[0];

          // Track the submission analytics
          await analyticsService.trackFormSubmission({
            formId: input.formId,
            responseId: response.id,
            sessionId: input.sessionId,
            userAgent: input.userAgent,
            timezone: input.timezone,
            language: input.language,
            completionTimeSeconds: input.completionTimeSeconds
          }, clientIP);

          console.log(`Submission analytics tracked for form ${input.formId}, response ${response.id}`);
        } catch (error) {
          // Log error but don't fail the response submission
          console.error('Error tracking submission analytics:', error);
        }
      }

      // Get form with settings to determine thank you message
      const formWithSettings = await getFormById(input.formId);
      
      // Determine thank you message
      let thankYouMessage = "Thank you! Your form has been submitted successfully.";
      let showCustomThankYou = false;
      
      if (formWithSettings?.settings?.thankYou?.enabled && formWithSettings.settings.thankYou.message) {
        thankYouMessage = formWithSettings.settings.thankYou.message;
        showCustomThankYou = true;
        
        // Apply mention substitution if we have a custom message
        try {
          // Create field labels map from form schema for better fallback display
          let fieldLabels: Record<string, string> = {};
          
          if (formWithSettings.formSchema) {
            const deserializedSchema = deserializeFormSchema(formWithSettings.formSchema);
            fieldLabels = createFieldLabelsMap(deserializedSchema);
          }
          
          // Apply mention substitution to replace field IDs with actual user responses
          thankYouMessage = substituteMentions(
            thankYouMessage,
            input.data, // User responses as field_id: value pairs
            fieldLabels  // Field labels for fallback display
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
        showCustomThankYou
      };
    },
    deleteResponse: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const existingResponse = await getResponseById(id);
      if (!existingResponse) {
        throw new Error("Response not found");
      }
      return await deleteResponse(id);
    },
  },
};
