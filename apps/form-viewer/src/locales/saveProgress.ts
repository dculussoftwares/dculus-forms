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
  saveStopped: "Progress can't be saved for this form right now",
  restored: (date: string) => `Welcome back. We restored the answers you saved on ${date}.`,
  filesNotSaved: 'Files are not saved with your progress, so re-attach any uploads before submitting.',
  startOver: 'Start over',
  startOverConfirm: 'Clear your saved answers and start this form again?',
  startOverCancel: 'Keep my answers',
  startOverAction: 'Clear answers',
  conflictTitle: 'Your answers changed on another device or tab.',
  conflictDescription: 'Choose which answers to keep. The other copy will be replaced.',
  goneTitle: 'These answers were submitted or cleared on another device or tab.',
  goneDescription: 'Your progress here is no longer being saved.',
  keepSaving: 'Keep saving these answers',
  useOther: 'Use those answers',
  keepMine: 'Keep these answers',
  dismiss: 'Dismiss',
  promptTitle: 'Sign in to save your progress',
  promptDescription: 'Optional. Your answers are saved to your account so you can finish later on any device.',
  promptAction: 'Sign in',
  dialogTitle: 'Sign in to save your progress',
  dialogDescription:
    "You don't need an account to submit this form. Signing in saves your answers as you go, so you can come back and finish on any device. Your account isn't attached to your response.",
  accountNote: 'Your answers are saved to this account. It is not recorded with your response.',
};
