import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface WebhookOverviewSummaryProps {
  config: Record<string, any>;
}

export const WebhookOverviewSummary: React.FC<WebhookOverviewSummaryProps> = ({ config }) => {
  const { t } = useTranslation('pluginDashboard');
  const headerCount = config.headers ? Object.keys(config.headers).length : 0;

  return (
    <div className="space-y-2">
      {config.url && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--tf-light-muted)' }}>
            {t('pluginSummary.webhook.endpoint')}
          </p>
          <p className="text-xs font-mono truncate" style={{ color: 'var(--tf-text)' }}>
            {config.url}
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <div
          className="flex-1 rounded-lg px-3 py-2.5 flex items-center gap-2"
          style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
        >
          {config.secret ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tf-green)' }} />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tf-light-muted)' }} />
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tf-light-muted)' }}>
              {t('pluginSummary.webhook.secret')}
            </p>
            <p className="text-xs" style={{ color: 'var(--tf-text)' }}>
              {config.secret
                ? t('pluginSummary.webhook.secretEnabled')
                : t('pluginSummary.webhook.secretDisabled')}
            </p>
          </div>
        </div>
        {headerCount > 0 && (
          <div
            className="flex-1 rounded-lg px-3 py-2.5"
            style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--tf-light-muted)' }}>
              {t('pluginSummary.webhook.customHeaders')}
            </p>
            <p className="text-xs" style={{ color: 'var(--tf-text)' }}>
              {t('pluginSummary.webhook.headersCount', { values: { count: headerCount } })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
