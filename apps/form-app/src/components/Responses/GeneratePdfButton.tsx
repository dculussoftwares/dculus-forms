import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { FileText } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  GET_PDF_TEMPLATES,
  GENERATE_PDF_FROM_RESPONSE,
} from '../../graphql/pdfTemplates';

interface GeneratePdfButtonProps {
  formId: string;
  responseId: string;
}

/**
 * Per-response "Generate PDF" action: picks a PDF template (when the form
 * has several) and downloads the filled PDF via a temporary pre-signed URL.
 * Renders nothing when the form has no PDF templates.
 */
export const GeneratePdfButton: React.FC<GeneratePdfButtonProps> = ({
  formId,
  responseId,
}) => {
  const { t } = useTranslation('pdfTemplates');
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data } = useQuery(GET_PDF_TEMPLATES, {
    variables: { formId },
    skip: !formId,
  });
  const [generatePdf] = useMutation(GENERATE_PDF_FROM_RESPONSE);

  const templates = data?.pdfTemplates || [];
  if (templates.length === 0) return null;

  const runGeneration = async (templateId: string) => {
    setGenerating(true);
    try {
      const { data: result } = await generatePdf({
        variables: { templateId, responseId },
      });
      const generated = result?.generatePdfFromResponse;
      if (generated?.downloadUrl) {
        const a = document.createElement('a');
        a.href = generated.downloadUrl;
        a.download = generated.filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      toastSuccess(t('toasts.generatedTitle'), t('toasts.generatedDescription'));
      setOpen(false);
    } catch (error) {
      toastError(
        t('toasts.generateFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleClick = () => {
    if (templates.length === 1) {
      runGeneration(templates[0].id);
    } else {
      setSelectedId(templates[0].id);
      setOpen(true);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={generating}
        className="gap-1.5"
        data-testid="generate-pdf-button"
      >
        <FileText className="h-3.5 w-3.5" />
        {generating && !open ? t('generate.generatingButton') : t('generate.menuLabel')}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && !generating && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('generate.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('generate.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="py-1 space-y-1 max-h-64 overflow-y-auto">
            {templates.map((template: any) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                data-testid={`generate-pdf-template-${template.id}`}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left text-sm transition-colors border ${
                  selectedId === template.id
                    ? 'border-blue-400 bg-blue-50/60 text-primary'
                    : 'border-transparent hover:bg-[rgba(87,84,91,0.05)] text-[#655d67]'
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{template.name}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>
              {t('generate.cancelButton')}
            </Button>
            <Button
              onClick={() => selectedId && runGeneration(selectedId)}
              disabled={!selectedId || generating}
              data-testid="generate-pdf-confirm"
            >
              {generating ? t('generate.generatingButton') : t('generate.generateButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
