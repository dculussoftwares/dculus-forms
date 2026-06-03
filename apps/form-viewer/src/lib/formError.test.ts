import { describe, it, expect } from 'vitest';
import { getFormErrorMessage, isSubmissionLimitError } from './formError';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';

describe('getFormErrorMessage', () => {
  it('maps FORM_NOT_PUBLISHED code to the correct message', () => {
    expect(getFormErrorMessage(GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED)).toBe(
      'This form is not yet published.'
    );
  });

  it('maps MAX_RESPONSES_REACHED code to the correct message', () => {
    expect(getFormErrorMessage(GRAPHQL_ERROR_CODES.MAX_RESPONSES_REACHED)).toBe(
      'This form has reached its maximum number of responses and is no longer accepting submissions.'
    );
  });

  it('maps FORM_NOT_YET_OPEN code to the correct message', () => {
    expect(getFormErrorMessage(GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN)).toBe(
      'This form is not yet open for submissions. Please check back later.'
    );
  });

  it('maps FORM_CLOSED code to the correct message', () => {
    expect(getFormErrorMessage(GRAPHQL_ERROR_CODES.FORM_CLOSED)).toBe(
      'The submission period for this form has ended.'
    );
  });

  it('returns the default message for unknown codes', () => {
    expect(getFormErrorMessage(undefined)).toBe(
      "The form you're looking for doesn't exist or has been removed."
    );
    expect(getFormErrorMessage('SOME_OTHER_ERROR')).toBe(
      "The form you're looking for doesn't exist or has been removed."
    );
  });
});

describe('isSubmissionLimitError', () => {
  it('returns true for MAX_RESPONSES_REACHED', () => {
    expect(isSubmissionLimitError(GRAPHQL_ERROR_CODES.MAX_RESPONSES_REACHED)).toBe(true);
  });

  it('returns true for FORM_NOT_YET_OPEN', () => {
    expect(isSubmissionLimitError(GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN)).toBe(true);
  });

  it('returns true for FORM_CLOSED', () => {
    expect(isSubmissionLimitError(GRAPHQL_ERROR_CODES.FORM_CLOSED)).toBe(true);
  });

  it('returns false for FORM_NOT_PUBLISHED', () => {
    expect(isSubmissionLimitError(GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSubmissionLimitError(undefined)).toBe(false);
  });
});
