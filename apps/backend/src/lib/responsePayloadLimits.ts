import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';

export const MAX_RESPONSE_FIELDS = 500;
export const MAX_RESPONSE_STRING_LENGTH = 10_000;
/**
 * Ceiling on the whole serialized answers object, nested values included:
 * room for every field at its string limit, plus keys and JSON punctuation.
 */
export const MAX_RESPONSE_PAYLOAD_LENGTH = MAX_RESPONSE_FIELDS * (MAX_RESPONSE_STRING_LENGTH + 2_000);

/**
 * P2-04: bounds the size of a respondent-supplied answers object so a public
 * mutation can't be used for unbounded writes. Shared by `submitResponse` and
 * `saveResponseDraft` so a draft can never hold more than a submission could.
 */
export function assertResponsePayloadWithinLimits(data: unknown): void {
  if (!data || typeof data !== 'object') return;

  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length > MAX_RESPONSE_FIELDS) {
    throw createGraphQLError(
      `Response data cannot contain more than ${MAX_RESPONSE_FIELDS} fields`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }
  for (const [key, value] of entries) {
    if (typeof value === 'string' && value.length > MAX_RESPONSE_STRING_LENGTH) {
      throw createGraphQLError(
        `Field "${key}" exceeds the 10,000 character limit`,
        GRAPHQL_ERROR_CODES.BAD_USER_INPUT
      );
    }
  }
  // Per-field checks only see top-level strings; nested arrays and objects
  // are bounded by the total size instead.
  if (JSON.stringify(data).length > MAX_RESPONSE_PAYLOAD_LENGTH) {
    throw createGraphQLError('Response data is too large', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
}
