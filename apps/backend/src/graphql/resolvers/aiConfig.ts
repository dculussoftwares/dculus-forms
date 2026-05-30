import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { type BetterAuthContext } from '../../middleware/better-auth-middleware.js';
import { listConfigs, updateConfig, SUPPORTED_MODELS } from '../../services/aiConfigService.js';

function requireAdminRole(auth: BetterAuthContext) {
  if (!auth?.user) {
    throw createGraphQLError('Authentication required', GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED);
  }
  const role = auth.user.role;
  if (role !== 'admin' && role !== 'superAdmin') {
    throw createGraphQLError('Admin privileges required', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }
  return auth.user;
}

export const aiConfigResolvers = {
  Query: {
    aiModelConfigs: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context.auth);
      return listConfigs();
    },

    aiSupportedModels: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      requireAdminRole(context.auth);
      return SUPPORTED_MODELS;
    },
  },

  Mutation: {
    updateAIModelConfig: async (
      _: any,
      { plan, primaryModel, fastModel }: { plan: string; primaryModel: string; fastModel: string },
      context: { auth: BetterAuthContext }
    ) => {
      const user = requireAdminRole(context.auth);
      return updateConfig(plan, primaryModel, fastModel, user.id);
    },
  },
};
