import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

interface EmailOverviewSummaryProps {
  config: Record<string, any>;
}

export const EmailOverviewSummary: React.FC<EmailOverviewSummaryProps> = ({ config }) => {
  const { t } = useTranslation('pluginDashboard');

  return (
    <div className="space-y-2">
      {config.recipientEmail && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--tf-light-muted)' }}>
            {t('pluginSummary.email.recipient')}
          </p>
          <p className="text-xs" style={{ color: 'var(--tf-text)' }}>
            {config.recipientEmail}
          </p>
        </div>
      )}
      {config.subject && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--tf-light-muted)' }}>
            {t('pluginSummary.email.subject')}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--tf-text)' }}>
            {config.subject}
          </p>
        </div>
      )}
    </div>
  );
};
