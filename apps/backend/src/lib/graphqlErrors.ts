import {
  GRAPHQL_ERROR_CODES,
  type GraphQLErrorCode,
  isGraphQLErrorCode,
} from '@dculus/types/graphql.js';
import {
  GraphQLError as BaseGraphQLError,
  type GraphQLErrorOptions,
  type GraphQLFormattedError,
} from 'graphql';

type CreateGraphQLErrorOptions = Omit<GraphQLErrorOptions, 'extensions'> & {
  extensions?: Record<string, unknown>;
};

/**
 * Get error code from extensions or use fallback.
 * No inference from message - code must be explicitly provided.
 */
const getErrorCode = (extensionCode?: unknown): GraphQLErrorCode => {
  if (isGraphQLErrorCode(extensionCode)) {
    return extensionCode;
  }
  return GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR;
};

/**
 * Custom GraphQL error that requires an explicit error code.
 * Use createGraphQLError() helper for cleaner syntax.
 */
export class GraphQLError extends BaseGraphQLError {
  constructor(message: string, options?: GraphQLErrorOptions) {
    const extensions = {
      ...options?.extensions,
    };

    const code = getErrorCode(extensions.code);

    super(message, {
      ...options,
      extensions: {
        ...extensions,
        code,
      },
    });
  }
}

/**
 * Create a GraphQL error with an explicit error code.
 * This is the preferred way to throw errors in resolvers.
 * 
 * @example
 * throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
 */
export const createGraphQLError = (
  message: string,
  code: GraphQLErrorCode,
  options?: CreateGraphQLErrorOptions
) => {
  return new GraphQLError(message, {
    ...options,
    extensions: {
      ...options?.extensions,
      code,
    },
  });
};

/**
 * Extract error code from a formatted GraphQL error.
 * Returns the code from extensions or INTERNAL_SERVER_ERROR as fallback.
 */
export const deriveGraphQLErrorCode = (
  error: Pick<GraphQLFormattedError, 'message' | 'extensions'>
): GraphQLErrorCode => {
  return getErrorCode(error.extensions?.code);
};
