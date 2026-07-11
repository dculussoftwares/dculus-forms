import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingSpinner,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import { FieldType } from '@dculus/types';
import { AlertCircle, Sparkles } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { GET_FORM_RESPONSES } from '../../graphql/queries';
import { PREVIEW_PDF_TEMPLATE } from '../../graphql/pdfTemplates';
import type { FormFieldEntry } from './fieldBinding';

const SAMPLE_OPTION = '__sample__';
const AI_SAMPLE_OPTION = '__ai_sample__';
const RESPONSE_PICKER_LIMIT = 20;

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  formId: string;
  fields: FormFieldEntry[];
  /** Working template from the designer (basePdf already stripped), or null when not ready */
  getWorkingTemplate: () => any | null;
}

/**
 * True-fidelity template preview: sends the designer's working template to
 * the backend, which runs the exact same generation path as real per-response
 * PDFs (so there is no formatting drift), and renders the result inline.
 * Data source is a recent response or deterministic sample data.
 */
export const PreviewDialog: React.FC<PreviewDialogProps> = ({
  open,
  onOpenChange,
  templateId,
  formId,
  fields,
  getWorkingTemplate,
}) => {
  const { t } = useTranslation('pdfTemplates');
  const [source, setSource] = useState<string>(SAMPLE_OPTION);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: responsesData } = useQuery(GET_FORM_RESPONSES, {
    variables: {
      formId,
      page: 1,
      limit: RESPONSE_PICKER_LIMIT,
      sortBy: 'submittedAt',
      sortOrder: 'desc',
    },
    skip: !open || !formId,
    fetchPolicy: 'cache-and-network',
  });
  const responses: any[] = responsesData?.responsesByForm?.data ?? [];

  // Human-readable option per response: first text/email answer + date
  const identityFieldIds = useMemo(
    () =>
      fields
        .filter(
          (f) =>
            f.type === FieldType.TEXT_INPUT_FIELD || f.type === FieldType.EMAIL_FIELD
        )
        .map((f) => f.id),
    [fields]
  );

  const responseLabel = (response: any): string => {
    const data = (response?.data ?? {}) as Record<string, any>;
    let identity = '';
    for (const fieldId of identityFieldIds) {
      const value = data[fieldId];
      if (typeof value === 'string' && value.trim()) {
        identity = value.trim();
        break;
      }
    }
    if (identity.length > 28) identity = `${identity.slice(0, 28)}…`;
    const submitted = response?.submittedAt
      ? new Date(response.submittedAt).toLocaleString()
      : '';
    return identity ? `${identity} — ${submitted}` : submitted || response.id;
  };

  const [previewPdfTemplate] = useMutation(PREVIEW_PDF_TEMPLATE);

  useEffect(() => {
    if (!open) return;
    const template = getWorkingTemplate();
    if (!template) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setPdfUrl(null);

    const run = async () => {
      const isPickedResponse = source !== SAMPLE_OPTION && source !== AI_SAMPLE_OPTION;
      const { data } = await previewPdfTemplate({
        variables: {
          templateId,
          template,
          responseId: isPickedResponse ? source : null,
          aiSampleData: source === AI_SAMPLE_OPTION,
        },
      });
      const downloadUrl = data?.previewPdfTemplate?.downloadUrl;
      if (!downloadUrl) throw new Error(t('preview.failed'));

      // The pre-signed URL carries Content-Disposition: attachment, which
      // would trigger a download instead of rendering — fetch to a blob and
      // show the object URL inline instead
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(t('preview.failed'));
      const blob = await response.blob();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(
        blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
      );
      setPdfUrl(objectUrl);
    };

    run()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('preview.failed'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Regenerate when the dialog opens or the data source changes
  }, [open, source, templateId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[92vw] h-[88vh] flex flex-col gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('preview.title')}</DialogTitle>
          <DialogDescription>{t('preview.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-[#655d67] dark:text-gray-400">
            {t('preview.dataSourceLabel')}
          </span>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger
              className="w-80 h-8 text-xs"
              data-testid="pdf-designer-preview-source"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SAMPLE_OPTION} className="text-xs">
                {t('preview.sampleData')}
              </SelectItem>
              <SelectItem value={AI_SAMPLE_OPTION} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-[#5c2e6b]" />
                  {t('preview.aiSampleData')}
                </span>
              </SelectItem>
              {responses.map((response) => (
                <SelectItem key={response.id} value={response.id} className="text-xs">
                  {responseLabel(response)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {responses.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              {t('preview.noResponses')}
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-[#f1f0f2] dark:bg-black/30 relative border border-[rgba(81,76,84,0.12)] dark:border-white/10">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <LoadingSpinner />
            </div>
          )}
          {error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : (
            pdfUrl && (
              <iframe
                src={pdfUrl}
                title={t('preview.title')}
                className="w-full h-full"
                data-testid="pdf-designer-preview-frame"
              />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
