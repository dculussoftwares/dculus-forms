import type { QuizResultScreenLabels } from '@dculus/ui';

/**
 * form-viewer's own copy for `QuizResultScreen` (epic #289, Story 10).
 * form-viewer has no i18n framework (unlike form-app, which is en/ta —
 * see CLAUDE.md) — this is the single place its respondent-facing quiz
 * result strings live, so they aren't scattered across the page component.
 */
export const quizResultLabels: QuizResultScreenLabels = {
  pendingMessage: 'Your responses have been recorded. Your score will be available once reviewed.',
  scoreLabel: 'Your score',
  outOfLabel: 'out of',
  passedLabel: 'Passed',
  failedLabel: 'Not passed',
  reviewHeading: 'Question review',
  correctLabel: 'Correct',
  incorrectLabel: 'Incorrect',
  yourAnswerLabel: 'Your answer',
  correctAnswerLabel: 'Correct answer',
  pointsLabel: 'Points',
  feedbackLabel: 'Feedback',
  noAnswerLabel: 'No answer given',
};

/**
 * Copy for the "check your result later" flow (epic #289, Story 16/#320,
 * D9) — the persistent post-submit link and the standalone results page it
 * leads to. Same rationale as `quizResultLabels` above: form-viewer has no
 * i18n framework, so this is the single home for this English copy.
 */
export const quizResultLinkLabel = 'Come back later to see your result';

export const quizResultPageLabels = {
  loading: 'Loading your result…',
  notSubmitted: "We don't have a result for you on this form yet.",
  notSubmittedHint: 'Make sure you sign in with the same email or account you used to submit.',
  backToForm: 'Back to form',
  loadError: 'Something went wrong while loading your result. Please try again.',
  retry: 'Try again',
};
