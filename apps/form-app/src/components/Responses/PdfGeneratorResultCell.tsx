import React from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Button, toastError } from '@dculus/ui';
import { Download, Loader2, RotateCcw, Wand2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  GET_PDF_GENERATION_RESULT,
  GENERATE_PDF_FROM_GENERATOR,
} from '../../graphql/pdfGenerators';

interface PdfGeneratorResultCellProps {
  generatorId: string;
  responseId: string;
}

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

/**
 * Per-row, per-generator cell in the Responses table — the "download from
 * the response table" entry point for the PDF Generators feature. Three
 * states: not yet generated (Wand2, click to generate + download), generated
 * (Download, click to download the persisted PDF instantly, no re-render),
 * failed (RotateCcw, click to retry). Each cell owns its own query/mutation
 * rather than a bulk-fetched map — bounded by page size × generator count,
 * which stays small.
 */
export const PdfGeneratorResultCell: React.FC<PdfGeneratorResultCellProps> = ({
  generatorId,
  responseId,
}) => {
  const { t } = useTranslation('pdfGenerators');
  // cache-and-network (not cache-first): a bulk/auto run can flip this
  // response's result from null to success in the background after the cell
  // first mounted and cached a "not generated yet" answer — cache-first would
  // keep serving that stale null indefinitely without a manual refetch.
  const { data, loading, refetch } = useQuery(GET_PDF_GENERATION_RESULT, {
    variables: { generatorId, responseId },
    fetchPolicy: 'cache-and-network',
  });
  const [generateFromGenerator, { loading: generating }] = useMutation(GENERATE_PDF_FROM_GENERATOR);

  const result = data?.pdfGenerationResult;
  const busy = loading || generating;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;

    if (result?.status === 'success' && result.downloadUrl) {
      triggerDownload(result.downloadUrl, result.filename ?? 'document.pdf');
      return;
    }

    try {
      const { data: generated } = await generateFromGenerator({ variables: { generatorId, responseId } });
      const output = generated?.generatePdfFromGenerator;
      if (output?.downloadUrl) {
        triggerDownload(output.downloadUrl, output.filename);
      }
      refetch();
    } catch (error) {
      toastError(
        t('responseAction.downloadFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    }
  };

  const icon = generating ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : result?.status === 'success' ? (
    <Download className="h-4 w-4 text-emerald-600" />
  ) : result?.status === 'failed' ? (
    <RotateCcw className="h-4 w-4 text-destructive" />
  ) : (
    <Wand2 className="h-4 w-4 text-muted-foreground" />
  );

  return (
    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={busy}
        onClick={handleClick}
      >
        {icon}
      </Button>
    </div>
  );
};
