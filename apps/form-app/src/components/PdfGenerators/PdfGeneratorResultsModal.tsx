import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Button,
  LoadingSpinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { Download, Loader2, PackageOpen, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from '../../hooks/useTranslation';
import {
  GET_PDF_GENERATION_RESULTS,
  DOWNLOAD_PDF_GENERATION_RESULTS_ZIP,
} from '../../graphql/pdfGenerators';

interface PdfGeneratorResultsModalProps {
  generatorId: string;
  generatorName: string;
  open: boolean;
  onClose: () => void;
}

const safeFormatDistance = (dateVal: string | null | undefined): string => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
};

const triggerDownload = (url: string, filename: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const PdfGeneratorResultsModal: React.FC<PdfGeneratorResultsModalProps> = ({
  generatorId,
  generatorName,
  open,
  onClose,
}) => {
  const { t } = useTranslation('pdfGenerators');
  const [downloadingZip, setDownloadingZip] = useState(false);

  const { data, loading } = useQuery(GET_PDF_GENERATION_RESULTS, {
    variables: { generatorId },
    skip: !open,
    fetchPolicy: 'network-only',
  });
  const [downloadZip] = useMutation(DOWNLOAD_PDF_GENERATION_RESULTS_ZIP);

  const results: any[] = data?.pdfGenerationResults ?? [];
  const successCount = results.filter((r) => r.status === 'success').length;

  const handleDownloadAll = async () => {
    if (successCount === 0) {
      toastError(t('results.toasts.noResultsTitle'), '');
      return;
    }
    setDownloadingZip(true);
    try {
      const { data: result } = await downloadZip({ variables: { generatorId } });
      const generated = result?.downloadPdfGenerationResultsZip;
      if (generated?.downloadUrl) {
        triggerDownload(generated.downloadUrl, generated.filename);
      }
      toastSuccess(t('results.toasts.zipReadyTitle'), '');
    } catch (error) {
      toastError(
        t('results.toasts.zipFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('results.title', { values: { name: generatorName } })}</DialogTitle>
          <DialogDescription>{t('results.description')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-1.5 py-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-8">{t('results.empty')}</p>
          ) : (
            results.map((result) => (
              <div
                key={result.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                style={
                  result.status === 'success'
                    ? { background: 'var(--tf-green-bg)', border: '1px solid var(--tf-green-bg-md)' }
                    : { background: 'var(--tf-error-bg)', border: '1px solid var(--tf-error-bg-md)' }
                }
              >
                {result.status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--tf-green)' }} />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--tf-error)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {result.filename ?? t('results.responseIdLabel', { values: { id: result.responseId } })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {result.status === 'success' ? t('results.statusSuccess') : t('results.statusFailed')}
                    {' · '}
                    {safeFormatDistance(result.generatedAt)}
                  </p>
                </div>
                {result.status === 'success' && result.downloadUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs shrink-0"
                    onClick={() => triggerDownload(result.downloadUrl, result.filename ?? 'document.pdf')}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('results.closeButton')}
          </Button>
          <Button onClick={handleDownloadAll} disabled={downloadingZip || successCount === 0}>
            {downloadingZip ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <PackageOpen className="h-3.5 w-3.5 mr-1.5" />
            )}
            {downloadingZip ? t('results.downloadingButton') : t('results.downloadAllButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
