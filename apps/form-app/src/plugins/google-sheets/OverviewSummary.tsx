import React from 'react';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface GoogleSheetsOverviewSummaryProps {
  config: Record<string, any>;
}

export const GoogleSheetsOverviewSummary: React.FC<GoogleSheetsOverviewSummaryProps> = ({ config }) => {
  const { t } = useTranslation('pluginDashboard');
  const token = config.googleToken;

  if (!token) {
    return (
      <div
        className="rounded-lg px-3 py-2.5 flex items-center gap-2"
        style={{ background: 'rgba(206,93,85,0.06)', border: '1px solid rgba(206,93,85,0.14)' }}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tf-error)' }} />
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--tf-error)' }}>
            {t('pluginSummary.googleSheets.notConnected')}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--tf-muted)' }}>
            {t('pluginSummary.googleSheets.notConnectedHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="rounded-lg px-3 py-2.5 flex items-center gap-2"
        style={{ background: 'var(--tf-green-bg)', border: '1px solid var(--tf-green-bg-md)' }}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tf-green)' }} />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--tf-green)' }}>
            {t('pluginSummary.googleSheets.connectedAs')}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--tf-text)' }}>
            {token.email}
          </p>
        </div>
      </div>
      {config.spreadsheetUrl && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--tf-light-muted)' }}>
            {t('pluginSummary.googleSheets.spreadsheet')}
          </p>
          <a
            href={config.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs hover:underline"
            style={{ color: 'var(--tf-green)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            {t('pluginSummary.googleSheets.openSheet')}
          </a>
        </div>
      )}
    </div>
  );
};
