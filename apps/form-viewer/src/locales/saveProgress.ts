/**
 * Copy for save-and-resume. form-viewer has no i18n framework (see
 * quizResult.ts), so this is the single home for these respondent-facing
 * strings.
 */
export const saveProgressLabels = {
  saving: 'Saving…',
  saved: 'Progress saved',
  savedAt: (time: string) => `Progress saved at ${time}`,
  saveFailed: "Couldn't save your progress. Retrying…",
  restored: (date: string) => `Welcome back. We restored the answers you saved on ${date}.`,
  filesNotSaved: 'Files are not saved with your progress, so re-attach any uploads before submitting.',
  startOver: 'Start over',
  startOverConfirm: 'Clear your saved answers and start this form again?',
  startOverCancel: 'Keep my answers',
  startOverAction: 'Clear answers',
  conflictTitle: 'Your answers changed on another device or tab.',
  conflictDescription: 'Choose which answers to keep. The other copy will be replaced.',
  useOther: 'Use those answers',
  keepMine: 'Keep these answers',
  dismiss: 'Dismiss',
};
