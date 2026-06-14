import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

interface AiTaggerOverviewSummaryProps {
  config: Record<string, any>;
}

export const AiTaggerOverviewSummary: React.FC<AiTaggerOverviewSummaryProps> = ({ config }) => {
  const { t } = useTranslation('pluginDashboard');
  const tags: Array<{ tagId: string; name: string; color: string }> = config.tags ?? [];

  if (tags.length === 0) {
    return (
      <div
        className="rounded-lg px-3 py-2.5"
        style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
      >
        <p className="text-xs" style={{ color: 'var(--tf-muted)' }}>
          {t('pluginSummary.aiTagger.noTags')}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--tf-light-muted)' }}>
        {t('pluginSummary.aiTagger.tagsConfigured')} ({tags.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag.tagId}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
            style={{ backgroundColor: tag.color || '#6b7280' }}
          >
            {tag.name}
          </span>
        ))}
      </div>
    </div>
  );
};
