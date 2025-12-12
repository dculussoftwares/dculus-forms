import type { ApolloError } from '@apollo/client';
import {
  GRAPHQL_ERROR_CODES,
  isGraphQLErrorCode,
  type GraphQLErrorCode,
} from '@dculus/types/graphql';

/**
 * Extract error code from GraphQL errors list
 */
const extractFromList = (
  errors:
    | ReadonlyArray<{ extensions?: { code?: unknown } }>
    | undefined
): GraphQLErrorCode | undefined => {
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

/**
 * Extract GraphQL error code from an Apollo error.
 * Returns the explicit code from extensions.code if available.
 */
export const extractGraphQLErrorCode = (
  error?: ApolloError | Error | null
): GraphQLErrorCode | undefined => {
  if (!error) {
    return undefined;
  }

  // Try to extract from graphQLErrors first
  if ('graphQLErrors' in error) {
    const code = extractFromList(error.graphQLErrors);
    if (code) {
      return code;
    }
  }

  // Try to extract from network error
  const networkErrors = (error as ApolloError).networkError as
    | (Error & {
      result?: { errors?: Array<{ extensions?: { code?: unknown } }> };
    })
    | undefined;

  const networkCode = extractFromList(networkErrors?.result?.errors);
  if (networkCode) {
    return networkCode;
  }

  // No explicit code found - return undefined
  // UI should use INTERNAL_SERVER_ERROR as default
  return undefined;
};

/**
 * Get the i18n translation key for an error code.
 * Used with useTranslation('graphqlErrors').
 * 
 * @example
 * const { t } = useTranslation('graphqlErrors');
 * const errorCode = extractGraphQLErrorCode(error);
 * const titleKey = getErrorTranslationKey(errorCode, 'title');
 * const messageKey = getErrorTranslationKey(errorCode, 'message');
 * const title = t(titleKey);
 * const message = t(messageKey);
 */
export const getErrorTranslationKey = (
  code: GraphQLErrorCode | undefined,
  type: 'title' | 'message'
): string => {
  const effectiveCode = code || GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR;
  return `codes.${effectiveCode}.${type}`;
};

/**
 * Get error details (code and translation keys) from an error.
 * Convenience function combining extraction and key generation.
 */
export const getErrorDetails = (error?: ApolloError | Error | null) => {
  const code = extractGraphQLErrorCode(error);
  const effectiveCode = code || GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR;

  return {
    code: effectiveCode,
    titleKey: `codes.${effectiveCode}.title`,
    messageKey: `codes.${effectiveCode}.message`,
  };
};

// Re-export for convenience
export { GRAPHQL_ERROR_CODES, type GraphQLErrorCode };

