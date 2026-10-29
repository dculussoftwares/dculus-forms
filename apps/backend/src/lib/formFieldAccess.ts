import { createGraphQLError, GraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { checkFormAccess, PermissionLevel } from '../services/formSharingService.js';

type FieldContext = { auth?: { user?: { id?: string } | null } | null };

// One form is often resolved through several guarded fields (and list queries
// resolve many forms), so the access lookup is memoised per request context.
const accessCache = new WeakMap<object, Map<string, Promise<boolean>>>();

/**
 * True when the caller is signed in and has at least VIEWER access to the
 * form. Used to guard builder-only `Form` fields that must never be readable
 * through the public `formByShortUrl` query.
 */
export function hasFormViewerAccess(formId: string, context: FieldContext): Promise<boolean> {
  const userId = context?.auth?.user?.id;
  if (!userId) return Promise.resolve(false);

  let perForm = accessCache.get(context as object);
  if (!perForm) {
    perForm = new Map();
    accessCache.set(context as object, perForm);
  }

  const cacheKey = `${userId}:${formId}`;
  let result = perForm.get(cacheKey);
  if (!result) {
    result = checkFormAccess(userId, formId, PermissionLevel.VIEWER)
      .then((check) => !!check.hasAccess)
      .catch((error) => {
        if (error instanceof GraphQLError) return false;
        throw error;
      });
    perForm.set(cacheKey, result);
  }
  return result;
}

export async function requireFormViewerAccess(formId: string, context: FieldContext): Promise<void> {
  if (!(await hasFormViewerAccess(formId, context))) {
    throw createGraphQLError(
      'Access denied: You do not have permission to view this form field',
      GRAPHQL_ERROR_CODES.NO_ACCESS
    );
  }
}
