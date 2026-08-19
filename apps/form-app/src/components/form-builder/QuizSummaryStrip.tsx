import React from 'react';
import { CheckCircle2, AlertTriangle, Award, ListChecks } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { QuizSummary } from '../../utils/quizGrading';

interface QuizSummaryStripProps {
  summary: QuizSummary;
}

/**
 * Builder chrome shown only while quiz mode is on for the form (GitHub issue #297) —
 * total points, graded question count, and how many gradable questions still have no
 * answer key. Callers must gate this on `useQuizMode().enabled` themselves; rendering
 * nothing when quiz mode is off/absent is part of the additive guarantee (epic #289),
 * so this component doesn't re-check it — it always renders once mounted.
 */
export const QuizSummaryStrip: React.FC<QuizSummaryStripProps> = ({ summary }) => {
  const { t } = useTranslation('quizGrading');
  const { totalPoints, questionCount, unkeyedCount } = summary;

  if (questionCount === 0) return null;

  return (
    <div
      className="flex items-center gap-4 px-3 py-1.5 text-xs shrink-0"
      style={{ borderBottom: '1px solid var(--tf-border-medium)', background: 'var(--tf-faint)' }}
      data-testid="quiz-summary-strip"
    >
      <span className="flex items-center gap-1.5 font-medium text-foreground dark:text-gray-200">
        <Award className="w-3.5 h-3.5" />
        {t('summary.totalPoints', { values: { count: totalPoints } })}
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground dark:text-gray-400">
        <ListChecks className="w-3.5 h-3.5" />
        {t('summary.questionCount', { values: { count: questionCount } })}
      </span>
      {unkeyedCount > 0 ? (
        <span
          className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"
          data-testid="quiz-summary-unkeyed"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {t('summary.unkeyedCount', { values: { count: unkeyedCount } })}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t('summary.allKeyed')}
        </span>
      )}
    </div>
  );
};

export default QuizSummaryStrip;
