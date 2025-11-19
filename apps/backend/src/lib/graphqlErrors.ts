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

const normalizeMessage = (message: string) => message.toLowerCase();

const inferGraphQLErrorCode = (
  message: string,
  extensionCode?: unknown
): GraphQLErrorCode => {
  if (isGraphQLErrorCode(extensionCode)) {
    return extensionCode;
  }

  const normalizedMessage = normalizeMessage(message);

  if (normalizedMessage.includes('authentication required')) {
    return GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED;
  }

  if (
    normalizedMessage.includes('access denied') ||
    normalizedMessage.includes('permission denied') ||
    normalizedMessage.includes('not a member') ||
    normalizedMessage.includes('no access')
  ) {
    return GRAPHQL_ERROR_CODES.NO_ACCESS;
  }

  if (normalizedMessage.includes('not found')) {
    return GRAPHQL_ERROR_CODES.NOT_FOUND;
  }

  if (
    normalizedMessage.includes('validation') ||
    normalizedMessage.includes('invalid') ||
    normalizedMessage.includes('bad request')
  ) {
    return GRAPHQL_ERROR_CODES.BAD_USER_INPUT;
  }

  return GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR;
};

export class GraphQLError extends BaseGraphQLError {
  constructor(message: string, options?: GraphQLErrorOptions) {
    const extensions = {
      ...options?.extensions,
    };

    const code = inferGraphQLErrorCode(message, extensions.code);

    super(message, {
      ...options,
      extensions: {
        ...extensions,
        code,
      },
    });
  }
}

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

export const deriveGraphQLErrorCode = (
  error: Pick<GraphQLFormattedError, 'message' | 'extensions'>
): GraphQLErrorCode => {
  return inferGraphQLErrorCode(error.message, error.extensions?.code);
};
