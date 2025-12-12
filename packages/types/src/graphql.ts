export const GRAPHQL_ERROR_CODES = {
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  NO_ACCESS: 'NO_ACCESS',
  FORBIDDEN: 'FORBIDDEN',

  // Generic resource errors
  NOT_FOUND: 'NOT_FOUND',

  // Domain-specific resource errors
  FORM_NOT_FOUND: 'FORM_NOT_FOUND',
  FORM_NOT_PUBLISHED: 'FORM_NOT_PUBLISHED',
  RESPONSE_NOT_FOUND: 'RESPONSE_NOT_FOUND',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',

  // Business logic errors
  SUBMISSION_LIMIT_EXCEEDED: 'SUBMISSION_LIMIT_EXCEEDED',
  VIEW_LIMIT_EXCEEDED: 'VIEW_LIMIT_EXCEEDED',
  MAX_RESPONSES_REACHED: 'MAX_RESPONSES_REACHED',
  FORM_NOT_YET_OPEN: 'FORM_NOT_YET_OPEN',
  FORM_CLOSED: 'FORM_CLOSED',

  // Validation errors
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
