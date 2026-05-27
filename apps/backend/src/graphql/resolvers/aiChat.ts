import {
  requireAuth,
  requireOrganizationMembership,
  type BetterAuthContext,
} from '../../middleware/better-auth-middleware.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  renameConversation,
} from '../../services/aiChatService.js';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';

export const aiChatResolvers = {
  Query: {
    listAIChatConversations: async (
      _: any,
      { formId, organizationId }: { formId: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      return listConversations(formId, organizationId, context.auth.user!.id);
    },

    getAIChatConversation: async (
      _: any,
      { id, organizationId }: { id: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      const conv = await getConversation(id, context.auth.user!.id);
      if (!conv) throw createGraphQLError('Conversation not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      return conv;
    },
  },

  Mutation: {
    createAIChatConversation: async (
      _: any,
      { formId, organizationId }: { formId: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      const conv = await createConversation(formId, organizationId, context.auth.user!.id);
      return { ...conv, messageCount: 0, messages: [] };
    },

    deleteAIChatConversation: async (
      _: any,
      { id, organizationId }: { id: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      return deleteConversation(id, context.auth.user!.id);
    },

    renameAIChatConversation: async (
      _: any,
      { id, organizationId, title }: { id: string; organizationId: string; title: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      const updated = await renameConversation(id, context.auth.user!.id, title);
      if (!updated) throw createGraphQLError('Conversation not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      return { ...updated, messageCount: 0, messages: [] };
    },
  },
};
