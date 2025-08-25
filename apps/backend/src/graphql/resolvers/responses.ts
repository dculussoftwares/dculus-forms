import { 
  getAllResponses, 
  getResponseById, 
  getResponsesByFormId, 
  submitResponse, 
  deleteResponse 
} from '../../services/responseService';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware';
import { generateId } from '@dculus/utils';

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
      const responseData = {
        id: generateId(),
        formId: input.formId,
        data: input.data,
        submittedAt: new Date(),
      };
      return await submitResponse(responseData);
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
