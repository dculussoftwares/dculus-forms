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
