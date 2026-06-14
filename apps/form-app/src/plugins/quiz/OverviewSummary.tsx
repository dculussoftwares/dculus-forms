import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

interface QuizOverviewSummaryProps {
  config: Record<string, any>;
}

export const QuizOverviewSummary: React.FC<QuizOverviewSummaryProps> = ({ config }) => {
  const { t } = useTranslation('pluginDashboard');
  const questionCount = config.quizFields?.length ?? 0;
  const columnName = config.columnName?.trim() || t('pluginSummary.quiz.defaultColumn');

  return (
    <div className="flex gap-2">
      <div
        className="flex-1 rounded-lg px-3 py-2.5"
        style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--tf-light-muted)' }}>
          {t('pluginSummary.quiz.passThreshold')}
        </p>
        <p className="text-sm font-semibold" style={{ color: 'var(--tf-dark)' }}>
          {config.passThreshold ?? 60}%
        </p>
      </div>
      <div
        className="flex-1 rounded-lg px-3 py-2.5"
        style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--tf-light-muted)' }}>
          {t('pluginSummary.quiz.questionsConfigured')}
        </p>
        <p className="text-sm font-semibold" style={{ color: 'var(--tf-dark)' }}>
          {questionCount}
        </p>
      </div>
      <div
        className="flex-1 rounded-lg px-3 py-2.5"
        style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--tf-light-muted)' }}>
          {t('pluginSummary.quiz.exportColumn')}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--tf-text)' }}>
          {columnName}
        </p>
      </div>
    </div>
  );
};
