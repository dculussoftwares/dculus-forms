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
    responsesByForm: async (_: any, { formId, page, limit, sortBy, sortOrder }: { formId: string, page: number, limit: number, sortBy: string, sortOrder: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      return await getResponsesByFormId(formId, page, limit, sortBy, sortOrder);
    },
  },
  Mutation: {
    submitResponse: async (_: any, { input }: { input: any }) => {
      // Save the response
      const responseData = {
        id: generateId(),
        formId: input.formId,
        data: input.data,
        submittedAt: new Date(),
      };
      const response = await submitResponse(responseData);

      // Get form with settings to determine thank you message
      const form = await getFormById(input.formId);
      
      // Determine thank you message
      let thankYouMessage = "Thank you! Your form has been submitted successfully.";
      let showCustomThankYou = false;
      
      if (form?.settings?.thankYou?.enabled && form.settings.thankYou.message) {
        thankYouMessage = form.settings.thankYou.message;
        showCustomThankYou = true;
        
        // Apply mention substitution if we have a custom message
        try {
          // Create field labels map from form schema for better fallback display
          let fieldLabels: Record<string, string> = {};
          
          if (form.formSchema) {
            const deserializedSchema = deserializeFormSchema(form.formSchema);
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
