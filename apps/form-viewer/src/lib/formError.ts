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
