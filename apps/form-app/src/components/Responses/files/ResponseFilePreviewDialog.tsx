import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, LoadingSpinner } from '@dculus/ui';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { ResponseFile } from '../../../graphql/responseFiles';
import { useResponseFileUrl } from '../../../hooks/useResponseFileUrl';
import { useTranslation } from '../../../hooks/useTranslation';
import { formatBytes, responseLabel } from '../../../utils/responseFiles';

interface ResponseFilePreviewDialogProps {
  /** Previewable files the user can step through, in list order. */
  files: ResponseFile[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

/**
 * Inline preview for images and PDFs, with previous/next (buttons or arrow
 * keys) through the files currently listed. Links are fetched on demand and
 * expire after a few minutes, so nothing long-lived ends up in the DOM.
 */
export const ResponseFilePreviewDialog: React.FC<ResponseFilePreviewDialogProps> = ({ files, index, onIndexChange }) => {
  const { t, locale } = useTranslation('responseFiles');
  const { getUrl, download, pendingKey } = useResponseFileUrl();
  const file = index === null ? undefined : files[index];
  const [preview, setPreview] = useState<{ key: string; url: string | null } | null>(null);

  const fileKey = file?.key;
  useEffect(() => {
    if (!fileKey) return;
    let cancelled = false;
    void getUrl(fileKey, true).then((url) => {
      if (!cancelled) setPreview({ key: fileKey, url });
    });
    return () => {
      cancelled = true;
    };
  }, [fileKey, getUrl]);

  const step = (delta: number) => {
    if (index === null || files.length === 0) return;
    onIndexChange((index + delta + files.length) % files.length);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  };

  const markUnavailable = () => {
    if (fileKey) setPreview({ key: fileKey, url: null });
  };
  const url = preview?.key === file?.key ? preview?.url : undefined;
  const isPdf = file?.mimeType === 'application/pdf';

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent className="sm:max-w-4xl w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden" onKeyDown={handleKeyDown}>
        {file && (
          <>
            <div className="flex items-start gap-3 px-5 py-4 pr-12 border-b">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm font-semibold truncate" title={file.originalName}>
                  {file.originalName}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                  {[file.fieldLabel, responseLabel(file.responseId, file.submittedAt), formatBytes(file.size, locale)].join(' · ')}
                </DialogDescription>
              </div>
            </div>

            <div className="relative flex items-center justify-center bg-muted/40 h-[65vh]">
              {url === undefined ? (
                <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                  <LoadingSpinner />
                  {t('preview.loading')}
                </div>
              ) : url === null ? (
                <p className="text-sm text-muted-foreground px-6 text-center">{t('preview.unavailable')}</p>
              ) : isPdf ? (
                <iframe src={url} title={file.originalName} className="h-full w-full border-0 bg-white" />
              ) : (
                <img
                  src={url}
                  alt={file.originalName}
                  onError={markUnavailable}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>

            <div className="flex items-center gap-2 px-5 py-3 border-t">
              {files.length > 1 && (
                <>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(-1)} aria-label={t('preview.previous')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(1)} aria-label={t('preview.next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t('preview.position', { values: { index: (index ?? 0) + 1, total: files.length } })}
                  </span>
                </>
              )}
              <Button
                size="sm"
                className="ml-auto gap-1.5"
                onClick={() => void download(file.key)}
                disabled={pendingKey === file.key}
              >
                <Download className="h-3.5 w-3.5" />
                {t('actions.download')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
