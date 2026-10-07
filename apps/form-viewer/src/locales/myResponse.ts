/**
 * Copy for respondent self-service (view and edit my response, one response
 * per person). form-viewer has no i18n framework (see quizResult.ts), so this
 * is the single home for these respondent-facing strings.
 */
export const myResponseLabels = {
  alreadyRespondedTitle: "You've already responded",
  alreadyRespondedDescription: (date: string) =>
    `This form accepts one response per person. You submitted yours on ${date}.`,
  closedTitle: 'This form is no longer accepting responses',
  closedDescription: (date: string) => `You submitted your response on ${date}.`,
  saveBeforeEditFailed: "We couldn't save the answers you're working on, so they were kept. Please try again.",
  respondedOn: (date: string) => `You responded to this form on ${date}.`,
  responseSaved: 'Your response has been saved.',
  changesSaved: 'Your changes have been saved.',
  viewResponse: 'View your response',
  editResponse: 'Edit your response',
  hideResponse: 'Hide your response',
  editingTitle: 'Editing your response',
  editingDescription: 'Your earlier answers are filled in. Submit to save your changes.',
  cancelEdit: 'Cancel',
  noAnswer: 'No answer',
  yes: 'Yes',
  no: 'No',
  submitting: 'Saving your changes...',
};
