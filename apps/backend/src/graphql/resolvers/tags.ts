import {
  getFormTags,
  createTag,
  deleteTag,
  addTagToResponse,
  removeTagFromResponse,
  getTagsForResponse,
  deletePreviewResponses,
  deleteAiGeneratedResponses,
} from '../../services/tagService.js';
import { getResponseById } from '../../services/responseService.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';

export const tagResolvers = {
  Query: {
    formTags: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const access = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.VIEWER);
      if (!access.hasAccess) {
        throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }
      return getFormTags(formId);
    },
  },

  Mutation: {
    createTag: async (
      _: any,
      { formId, name, color }: { formId: string; name: string; color?: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const access = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.EDITOR);
      if (!access.hasAccess) {
        throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }
      return createTag(formId, name, color);
    },

    deleteTag: async (
      _: any,
      { id, formId }: { id: string; formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const access = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.EDITOR);
      if (!access.hasAccess) {
        throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }
      return deleteTag(id);
    },

    addTagToResponse: async (
      _: any,
      { responseId, tagId }: { responseId: string; tagId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const response = await getResponseById(responseId);
      if (!response) throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
      const access = await checkFormAccess(context.auth.user!.id, response.formId, PermissionLevel.EDITOR);
      if (!access.hasAccess) throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
      return addTagToResponse(responseId, tagId);
    },

    removeTagFromResponse: async (
      _: any,
      { responseId, tagId }: { responseId: string; tagId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const response = await getResponseById(responseId);
      if (!response) throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
      const access = await checkFormAccess(context.auth.user!.id, response.formId, PermissionLevel.EDITOR);
      if (!access.hasAccess) throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
      return removeTagFromResponse(responseId, tagId);
    },

    deletePreviewResponses: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const access = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.EDITOR);
      if (!access.hasAccess) {
        throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }
      return deletePreviewResponses(formId);
    },

    deleteAiGeneratedResponses: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const access = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.EDITOR);
      if (!access.hasAccess) {
        throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }
      return deleteAiGeneratedResponses(formId);
    },
  },

  FormResponse: {
    tags: async (parent: { id: string; tags?: any[] }) => {
      // If tags were batch-loaded by the parent query, use them directly
      if (parent.tags !== undefined) return parent.tags;
      return getTagsForResponse(parent.id);
    },
  },
};
