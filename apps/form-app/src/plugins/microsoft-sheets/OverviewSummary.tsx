import React from 'react';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface MicrosoftSheetsOverviewSummaryProps {
  config: Record<string, any>;
}

export const MicrosoftSheetsOverviewSummary: React.FC<MicrosoftSheetsOverviewSummaryProps> = ({
  config,
}) => {
  const { t } = useTranslation('pluginDashboard');
  const token = config.microsoftToken;

  if (!token) {
    return (
      <div
        className="rounded-lg px-3 py-2.5 flex items-center gap-2"
        style={{
          background: 'rgba(206,93,85,0.06)',
          border: '1px solid rgba(206,93,85,0.14)',
        }}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tf-error)' }} />
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--tf-error)' }}>
            {t('pluginSummary.microsoftSheets.notConnected')}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--tf-muted)' }}>
            {t('pluginSummary.microsoftSheets.notConnectedHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="rounded-lg px-3 py-2.5 flex items-center gap-2"
        style={{
          background: 'rgba(37,99,235,0.06)',
          border: '1px solid rgba(37,99,235,0.14)',
        }}
      >
        <CheckCircle2
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: 'rgb(37,99,235)' }}
        />
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
            style={{ color: 'rgb(37,99,235)' }}
          >
            {t('pluginSummary.microsoftSheets.connectedAs')}
          </p>
          {token.displayName && (
            <p className="text-xs font-medium truncate" style={{ color: 'var(--tf-text)' }}>
              {token.displayName}
            </p>
          )}
          <p className="text-[10px] truncate" style={{ color: 'var(--tf-muted)' }}>
            {token.email}
          </p>
        </div>
      </div>
      {config.workbookUrl && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{
            background: 'var(--tf-faint)',
            border: '1px solid var(--tf-border-light)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wide mb-1"
            style={{ color: 'var(--tf-light-muted)' }}
          >
            {t('pluginSummary.microsoftSheets.workbook')}
          </p>
          <a
            href={config.workbookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs hover:underline"
            style={{ color: 'rgb(37,99,235)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            {t('pluginSummary.microsoftSheets.openWorkbook')}
          </a>
        </div>
      )}
      {config.worksheetName && config.worksheetName !== 'Sheet1' && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{
            background: 'var(--tf-faint)',
            border: '1px solid var(--tf-border-light)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
            style={{ color: 'var(--tf-light-muted)' }}
          >
            {t('pluginSummary.microsoftSheets.worksheet')}
          </p>
          <p className="text-xs" style={{ color: 'var(--tf-text)' }}>
            {config.worksheetName}
          </p>
        </div>
      )}
    </div>
  );
};
