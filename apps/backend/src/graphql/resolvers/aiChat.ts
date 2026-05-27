import {
  requireAuth,
  requireOrganizationMembership,
  type BetterAuthContext,
} from '../../middleware/better-auth-middleware.js';
import { checkAITokenBudget, recordAITokenUsage } from '../../services/aiUsageService.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  renameConversation,
  saveUserMessage,
  saveAssistantMessage,
  buildStreamForConversation,
  autoGenerateTitle,
} from '../../services/aiChatService.js';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { logger } from '../../lib/logger.js';

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

    sendAIChatUserMessage: async (
      _: any,
      { conversationId, organizationId, content }: { conversationId: string; organizationId: string; content: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      const message = await saveUserMessage(conversationId, content);
      // Auto-generate title from first message only (fire-and-forget)
      const conv = await getConversation(conversationId, context.auth.user!.id);
      if (conv && conv.messageCount <= 1) {
        autoGenerateTitle(conversationId, content);
      }
      return message;
    },
  },

  Subscription: {
    aiChatStream: {
      subscribe: async function* (
        _: any,
        {
          conversationId,
          organizationId,
          currentFormState,
        }: { conversationId: string; organizationId: string; currentFormState: object },
        context: { auth: BetterAuthContext }
      ) {
        requireAuth(context.auth);
        await requireOrganizationMembership(context.auth, organizationId);

        const budget = await checkAITokenBudget(organizationId);
        if (!budget.allowed) {
          yield {
            aiChatStream: {
              type: 'error',
              error: `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} used). Upgrade your plan to continue.`,
            },
          };
          return;
        }

        const operations: object[] = [];
        let fullText = '';

        try {
          const result = await buildStreamForConversation(
            conversationId,
            context.auth.user!.id,
            currentFormState
          );

          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              const delta = (part as any).text ?? (part as any).textDelta ?? '';
              fullText += delta;
              yield { aiChatStream: { type: 'text', delta } };
            }

            if (part.type === 'tool-result') {
              // AI SDK v6: result is on `output`, not `result`
              const op = (part as any).output as object;
              if (op) {
                operations.push(op);
                yield { aiChatStream: { type: 'operation', operation: op } };
              }
            }

            if (part.type === 'finish') {
              const tokensUsed = (part as any).totalUsage?.totalTokens ?? (part as any).usage?.totalTokens ?? 0;
              const saved = await saveAssistantMessage(conversationId, fullText, operations, tokensUsed);
              await recordAITokenUsage(organizationId, tokensUsed);
              yield { aiChatStream: { type: 'done', messageId: saved.id } };
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.error({ errMsg, conversationId }, 'AI chat stream failed');
          yield { aiChatStream: { type: 'error', error: 'AI processing failed. Please try again.' } };
        }
      },
      resolve: (payload: any) => payload.aiChatStream,
    },
  },
};
