import React from 'react';
import { Button, Progress } from '@dculus/ui';
import { Archive, X } from 'lucide-react';
import type { ResponseFileExport } from '../../../graphql/responseFiles';
import { useTranslation } from '../../../hooks/useTranslation';
import { formatBytes } from '../../../utils/responseFiles';

/**
 * Floating card shown while a ZIP is being prepared. The download starts on
 * its own when the archive is ready, so people can keep working meanwhile.
 */
export const ResponseFileExportProgress: React.FC<{
  activeExport: ResponseFileExport | null;
  onHide: () => void;
}> = ({ activeExport, onHide }) => {
  const { t, locale } = useTranslation('responseFiles');
  if (!activeExport) return null;

  const percent = activeExport.totalCount
    ? Math.round((activeExport.processedCount / activeExport.totalCount) * 100)
    : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border bg-white p-4 shadow-lg dark:bg-card"
    >
      <div className="flex items-start gap-3">
        <div className="bg-blue-50 p-2.5 rounded-xl">
          <Archive className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('export.preparing.title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('export.preparing.progress', {
              values: {
                processed: activeExport.processedCount,
                total: activeExport.totalCount,
                size: formatBytes(activeExport.totalBytes, locale),
              },
            })}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1" onClick={onHide} aria-label={t('export.hide')}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Progress value={percent} className="mt-3 h-1.5" aria-label={t('export.preparing.title')} />
      <p className="text-[11px] text-muted-foreground mt-2">{t('export.preparing.hint')}</p>
    </div>
  );
};
