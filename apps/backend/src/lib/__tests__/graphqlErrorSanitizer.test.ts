import { describe, it, expect } from 'vitest';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import {
  createGraphQLError,
  isInternalError,
  sanitizeFormattedError,
  INTERNAL_ERROR_MESSAGE,
} from '../graphqlErrors.js';

describe('sanitizeFormattedError (S05-02 / S05-03)', () => {
  it('strips stack traces from every error', () => {
    const original = createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
    const result = sanitizeFormattedError(
      {
        message: 'Form not found',
        extensions: { code: 'FORM_NOT_FOUND', stacktrace: ['Error: at /app/x.ts:1'] },
      },
      original
    );

    expect(result.extensions).not.toHaveProperty('stacktrace');
    expect(result.message).toBe('Form not found');
    expect(result.extensions?.code).toBe('FORM_NOT_FOUND');
  });

  it('keeps deliberate error messages intact and adds no requestId', () => {
    const original = createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
    const result = sanitizeFormattedError(
      { message: 'Access denied', extensions: { code: 'NO_ACCESS' } },
      original,
      'req-1'
    );

    expect(result.message).toBe('Access denied');
    expect(result.extensions).not.toHaveProperty('requestId');
  });

  it('masks Prisma-style internal errors and exposes only a request id', () => {
    const original = Object.assign(
      new Error('Invalid `prisma.form.findUnique()` invocation: column "secret" does not exist'),
      { name: 'PrismaClientKnownRequestError', code: 'P2022' }
    );
    const result = sanitizeFormattedError(
      { message: original.message, extensions: { code: 'INTERNAL_SERVER_ERROR' } },
      original,
      'req-42'
    );

    expect(result.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(result.extensions?.requestId).toBe('req-42');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('classifies plain errors by their message', () => {
    expect(isInternalError(new Error('connect ECONNREFUSED 10.0.0.1:5432'))).toBe(true);
    expect(isInternalError(new Error('Something at /app/dist/services/x.js failed'))).toBe(true);
    expect(isInternalError(new Error('Title is required'))).toBe(false);
    expect(isInternalError(createGraphQLError('x', GRAPHQL_ERROR_CODES.BAD_USER_INPUT))).toBe(false);
    expect(isInternalError(undefined)).toBe(false);
  });
});
