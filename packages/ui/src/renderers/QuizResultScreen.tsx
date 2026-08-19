import React from 'react';
import type { RespondentGradeView } from '@dculus/types';
import { CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { cn } from '../utils';

/**
 * Every string this component shows to the respondent. `QuizResultScreen`
 * ships English defaults so it renders correctly with zero configuration
 * (Storybook, the builder's thank-you preview, etc.) — callers such as
 * form-viewer own their own copy by passing overrides here rather than by
 * this package reaching into an app-level i18n system.
 */
export interface QuizResultScreenLabels {
  pendingMessage: string;
  scoreLabel: string;
  outOfLabel: string;
  passedLabel: string;
  failedLabel: string;
  reviewHeading: string;
  correctLabel: string;
  incorrectLabel: string;
  yourAnswerLabel: string;
  correctAnswerLabel: string;
  pointsLabel: string;
  feedbackLabel: string;
  noAnswerLabel: string;
}

const DEFAULT_LABELS: QuizResultScreenLabels = {
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

export interface QuizResultScreenProps {
  /**
   * Server-projected grade view (`gradingService.toRespondentView`). This
   * component renders exactly what is present on it and never re-derives or
   * gates anything itself — release timing and respondent-visibility policy
   * were already applied on the server.
   */
  gradeResult: RespondentGradeView;
  /** Override any of the default English strings (e.g. for a translated app). */
  labels?: Partial<QuizResultScreenLabels>;
  className?: string;
}

const formatAnswerValue = (value: unknown, noAnswerLabel: string): string => {
  if (value === null || value === undefined || value === '') return noAnswerLabel;
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : noAnswerLabel;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const CorrectnessMarker: React.FC<{ correct: boolean; labels: QuizResultScreenLabels }> = ({
  correct,
  labels,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 text-sm font-medium',
      correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
    )}
  >
    {correct ? (
      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
    ) : (
      <XCircle className="w-4 h-4" aria-hidden="true" />
    )}
    {correct ? labels.correctLabel : labels.incorrectLabel}
  </span>
);

/**
 * Renders the respondent-facing quiz result — score, pass/fail badge,
 * optional result message and per-question review — inside the existing
 * thank-you screen slot (see `ThankYouScreen`). Never mounted for non-quiz
 * forms: `gradeResult` is only ever passed when the server graded the
 * submission (epic #289, D3).
 */
export const QuizResultScreen: React.FC<QuizResultScreenProps> = ({
  gradeResult,
  labels: labelsProp,
  className = '',
}) => {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };

  if (!gradeResult.released) {
    return (
      <div className={cn('text-center', className)} data-testid="quiz-result-pending">
        <div
          role="status"
          aria-live="polite"
          className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Clock3 className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-base text-foreground" data-testid="quiz-result-pending-message">
          {labels.pendingMessage}
        </p>
      </div>
    );
  }

  const hasScore = gradeResult.score !== undefined && gradeResult.maxScore !== undefined;
  const hasPassed = gradeResult.passed !== undefined;
  const questions = gradeResult.questions ?? [];

  const announcementParts: string[] = [];
  if (hasPassed) announcementParts.push(gradeResult.passed ? labels.passedLabel : labels.failedLabel);
  if (hasScore) {
    announcementParts.push(
      `${labels.scoreLabel}: ${gradeResult.score} ${labels.outOfLabel} ${gradeResult.maxScore}`
    );
  }
  if (gradeResult.message) announcementParts.push(gradeResult.message);

  return (
    <div className={cn('text-center', className)} data-testid="quiz-result-screen">
      {/* Screen-reader announcement — visually hidden, fires once on mount */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcementParts.join('. ')}
      </div>

      {hasPassed && (
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold mb-4',
            gradeResult.passed
              ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          )}
          data-testid="quiz-result-badge"
        >
          {gradeResult.passed ? (
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          ) : (
            <XCircle className="w-4 h-4" aria-hidden="true" />
          )}
          {gradeResult.passed ? labels.passedLabel : labels.failedLabel}
        </div>
      )}

      {hasScore && (
        <div className="mb-4" data-testid="quiz-result-score">
          <p className="text-sm text-muted-foreground mb-1">{labels.scoreLabel}</p>
          <p className="text-4xl font-bold text-foreground">
            {gradeResult.score}
            <span className="text-lg font-medium text-muted-foreground">
              {' '}
              {labels.outOfLabel} {gradeResult.maxScore}
            </span>
          </p>
          {gradeResult.percentage !== undefined && (
            <p className="text-sm text-muted-foreground mt-1">{Math.round(gradeResult.percentage)}%</p>
          )}
        </div>
      )}

      {gradeResult.message && (
        <p className="mb-6 text-base text-foreground" data-testid="quiz-result-message">
          {gradeResult.message}
        </p>
      )}

      {questions.length > 0 && (
        <div className="text-left mt-6" data-testid="quiz-result-questions">
          <h3 className="text-base font-semibold text-foreground mb-3 text-center">
            {labels.reviewHeading}
          </h3>
          <ul className="space-y-3">
            {questions.map((question) => (
              <li
                key={question.fieldId}
                className="rounded-lg border border-border bg-card p-4"
                data-testid="quiz-result-question"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-medium text-foreground">{question.label}</p>
                  {question.correct !== undefined && (
                    <CorrectnessMarker correct={question.correct} labels={labels} />
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {labels.yourAnswerLabel}: {formatAnswerValue(question.yourAnswer, labels.noAnswerLabel)}
                </p>

                {question.correctAnswer && question.correctAnswer.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {labels.correctAnswerLabel}: {question.correctAnswer.join(', ')}
                  </p>
                )}

                {question.pointsAwarded !== undefined && question.pointValue !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    {labels.pointsLabel}: {question.pointsAwarded} / {question.pointValue}
                  </p>
                )}

                {question.feedback && (
                  <p className="text-sm text-foreground mt-2 italic">
                    {labels.feedbackLabel}: {question.feedback}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
