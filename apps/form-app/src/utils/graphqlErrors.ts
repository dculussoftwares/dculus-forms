import type { ApolloError } from '@apollo/client';
import {
  GRAPHQL_ERROR_CODES,
  isGraphQLErrorCode,
  type GraphQLErrorCode,
} from '@dculus/types/graphql';

const normalizeMessage = (message?: string) => message?.toLowerCase() ?? '';

const deriveCodeFromMessage = (
  message?: string
): GraphQLErrorCode | undefined => {
  const normalized = normalizeMessage(message);

  if (!normalized) {
    return undefined;
  }

  if (normalized.includes('authentication required')) {
    return GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED;
  }

  if (
    normalized.includes('access denied') ||
    normalized.includes('permission denied') ||
    normalized.includes('not a member') ||
    normalized.includes('no access')
  ) {
    return GRAPHQL_ERROR_CODES.NO_ACCESS;
  }

  if (normalized.includes('not found')) {
    return GRAPHQL_ERROR_CODES.NOT_FOUND;
  }

  return undefined;
};

const extractFromList = (
  errors:
    | ReadonlyArray<{ extensions?: { code?: unknown } }>
    | undefined
) => {
  if (!Array.isArray(errors)) {
    return undefined;
  }

  for (const graphQLError of errors) {
    const code = graphQLError.extensions?.code;
    if (isGraphQLErrorCode(code)) {
      return code;
    }
  }

  return undefined;
};

export const extractGraphQLErrorCode = (
  error?: ApolloError | Error | null
): GraphQLErrorCode | undefined => {
  if (!error) {
    return undefined;
  }

  if ('graphQLErrors' in error) {
    const code = extractFromList(error.graphQLErrors);
    if (code) {
      return code;
    }
  }

  const networkErrors = (error as ApolloError).networkError as
    | (Error & {
        result?: { errors?: Array<{ extensions?: { code?: unknown } }> };
      })
    | undefined;

  const networkCode = extractFromList(networkErrors?.result?.errors);
  if (networkCode) {
    return networkCode;
  }

  return deriveCodeFromMessage(error.message);
};
