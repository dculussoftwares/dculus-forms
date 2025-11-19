export const GRAPHQL_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  NO_ACCESS: 'NO_ACCESS',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type GraphQLErrorCode =
  (typeof GRAPHQL_ERROR_CODES)[keyof typeof GRAPHQL_ERROR_CODES];

export const isGraphQLErrorCode = (
  value: unknown
): value is GraphQLErrorCode => {
  if (typeof value !== 'string') {
    return false;
  }

  return Object.values(GRAPHQL_ERROR_CODES).includes(
    value as GraphQLErrorCode
  );
};
