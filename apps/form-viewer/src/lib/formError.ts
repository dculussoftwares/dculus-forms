import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';

export function getFormErrorMessage(code: string | undefined): string {
  switch (code) {
    case GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED:
      return 'This form is not yet published.';
    case GRAPHQL_ERROR_CODES.MAX_RESPONSES_REACHED:
      return 'This form has reached its maximum number of responses and is no longer accepting submissions.';
    case GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN:
      return 'This form is not yet open for submissions. Please check back later.';
    case GRAPHQL_ERROR_CODES.FORM_CLOSED:
      return 'The submission period for this form has ended.';
    case GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED:
      return 'Your sign-in has expired. Please sign in again to finish submitting.';
    case GRAPHQL_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED:
      return 'Your email is not allowed to respond to this form.';
    default:
      return "The form you're looking for doesn't exist or has been removed.";
  }
}

export function isSubmissionLimitError(code: string | undefined): boolean {
  return (
    code === GRAPHQL_ERROR_CODES.MAX_RESPONSES_REACHED ||
    code === GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN ||
    code === GRAPHQL_ERROR_CODES.FORM_CLOSED
  );
}

// A respondent's token can expire/get revoked mid-fill (long session) — this
// distinguishes that race from a generic submission failure so the caller
// can re-show the sign-in gate instead of a dead-end error banner.
export function isAccessControlError(code: string | undefined): boolean {
  return (
    code === GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED ||
    code === GRAPHQL_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED
  );
}
