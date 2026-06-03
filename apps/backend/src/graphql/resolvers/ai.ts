import { requireAuth, requireOrganizationMembership, type BetterAuthContext } from '../../middleware/better-auth-middleware.js';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { generateFormWithAI, type AIFormMode } from '../../services/aiService.js';
import { checkAITokenBudget, recordAITokenUsage, getAITokenUsage } from '../../services/aiUsageService.js';
import { logger } from '../../lib/logger.js';
import { getFieldInsights, generateFieldInsights, computeSchemaHash } from '../../services/aiFieldInsightService.js';
import { getFormSchema } from '../../routes/aiChat.js';
import { prisma } from '../../lib/prisma.js';

export const aiResolvers = {
  Query: {
    aiTokenUsage: async (
      _: any,
      { organizationId }: { organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);
      return getAITokenUsage(organizationId);
    },

    fieldInsights: async (
      _: any,
      { formId, organizationId }: { formId: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);

      const form = await prisma.form.findUnique({
        where: { id: formId, organizationId },
        select: { id: true },
      });
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const schema = await getFormSchema(formId);
      const currentHash = computeSchemaHash(schema);
      return getFieldInsights(formId, currentHash);
    },
  },

  Mutation: {
    generateFormWithAI: async (
      _: any,
      { prompt, organizationId, mode = 'standard' }: { prompt: string; organizationId: string; mode?: AIFormMode },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);

      if (!prompt || prompt.trim().length < 3) {
        throw createGraphQLError('Prompt must be at least 3 characters', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      if (prompt.length > 1000) {
        throw createGraphQLError('Prompt must be 1000 characters or less', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      const budget = await checkAITokenBudget(organizationId);
      if (!budget.allowed) {
        throw createGraphQLError(
          `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} tokens used this month). Upgrade your plan to continue.`,
          GRAPHQL_ERROR_CODES.AI_TOKEN_LIMIT_EXCEEDED
        );
      }

      try {
        const result = await generateFormWithAI(prompt.trim(), mode);
        await recordAITokenUsage(organizationId, result.tokensUsed);
        return result;
      } catch (error) {
        logger.error({ err: error, organizationId }, 'AI form generation failed');
        throw createGraphQLError(
          'AI form generation failed. Please try again.',
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },

    generateFieldInsights: async (
      _: any,
      { formId, organizationId }: { formId: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);

      const budget = await checkAITokenBudget(organizationId);
      if (!budget.allowed) {
        throw createGraphQLError(
          `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} tokens used this month). Upgrade your plan to continue.`,
          GRAPHQL_ERROR_CODES.AI_TOKEN_LIMIT_EXCEEDED
        );
      }

      const form = await prisma.form.findUnique({
        where: { id: formId, organizationId },
        select: { title: true },
      });
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const schema = await getFormSchema(formId);

      try {
        const result = await generateFieldInsights(formId, form.title, schema);
        await recordAITokenUsage(organizationId, result.tokensUsed);
        return result;
      } catch (error) {
        logger.error({ err: error, formId, organizationId }, 'AI field insights generation failed');
        throw createGraphQLError(
          'AI field insights generation failed. Please try again.',
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },
  },
};
