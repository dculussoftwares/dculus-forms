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

export const INTERNAL_ERROR_MESSAGE = 'Internal server error';

const INTERNAL_MESSAGE_PATTERNS: RegExp[] = [
  /Invalid `prisma\./i,
  /\bprisma\.\w+\.\w+\(\)/i,
  /Unique constraint failed/i,
  /Foreign key constraint/i,
  /Raw query failed/i,
  /\bnode_modules\b/,
  /(^|[\s("'])\/(app|usr|home|var|Users|opt|workspace)\//,
  /\n\s+at\s/,
  /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND)\b/,
];

/**
 * True for errors whose message is likely to expose internals (ORM/driver
 * messages, file paths, stack fragments). Deliberate, user-facing errors are
 * never matched.
 */
export const isInternalError = (original: unknown): boolean => {
  if (original instanceof BaseGraphQLError) return false;
  if (!original || typeof original !== 'object') return false;

  const candidate = original as { name?: unknown; code?: unknown; message?: unknown };
  if (typeof candidate.name === 'string' && /^(PrismaClient|DatabaseError)/.test(candidate.name)) {
    return true;
  }
  if (typeof candidate.code === 'string' && /^P\d{4}$/.test(candidate.code)) return true;

  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return INTERNAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
};

/**
 * Normalises an error before it is sent to the client: always drops the stack
 * trace and replaces the message of internal errors with a generic one.
 */
export const sanitizeFormattedError = (
  formattedError: GraphQLFormattedError,
  originalError: unknown,
  requestId?: string
): GraphQLFormattedError => {
  const extensions = { ...(formattedError.extensions ?? {}) } as Record<string, unknown>;
  delete extensions.stacktrace;
  const masked = isInternalError(originalError);

  return {
    ...formattedError,
    message: masked ? INTERNAL_ERROR_MESSAGE : formattedError.message,
    extensions: {
      ...extensions,
      ...(masked && requestId ? { requestId } : {}),
    },
  };
};
