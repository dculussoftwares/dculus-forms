import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Button, Switch, toastError } from '@dculus/ui';
import { ChevronDown, FileText, PencilRuler, Trash2 } from 'lucide-react';
import { FillableFormField } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';
import { CREATE_PDF_GENERATOR } from '../../graphql/pdfGenerators';
import { AutomationBlock } from './AutomationBlock';

interface TemplateAutomationRowProps {
  template: any;
  formId: string;
  canEdit: boolean;
  fillableFields: FillableFormField[];
  quizEnabled: boolean;
  generators: any[];
  refetchGenerators: () => void;
  onOpenDesigner: () => void;
  onDelete: () => void;
}

export const TemplateAutomationRow: React.FC<TemplateAutomationRowProps> = ({
  template,
  formId,
  canEdit,
  fillableFields,
  quizEnabled,
  generators,
  refetchGenerators,
  onOpenDesigner,
  onDelete,
}) => {
  const { t } = useTranslation('pdfTemplates');
  const { t: tGenerators } = useTranslation('pdfGenerators');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [createGenerator] = useMutation(CREATE_PDF_GENERATOR);

  const isActive = generators.some((g) => g.autoRunOnSubmit);
  const canShowAutomation = canEdit || generators.length > 0;

  const createDefaultGenerator = async () => {
    setCreating(true);
    try {
      await createGenerator({
        variables: {
          input: {
            formId,
            templateId: template.id,
            name: generators.length === 0 ? template.name : `${template.name} (${generators.length + 1})`,
            filters: [],
            autoRunOnSubmit: generators.length === 0,
          },
        },
      });
      refetchGenerators();
    } catch (error) {
      toastError(
        tGenerators('toasts.createFailedTitle'),
        error instanceof Error ? error.message : tGenerators('toasts.genericError')
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="rounded-xl bg-white dark:bg-card overflow-hidden"
      style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
          <FileText className="h-5 w-5 text-blue-600" />
        </div>

        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => canShowAutomation && setOpen((v) => !v)}
          disabled={!canShowAutomation}
        >
          <p className="text-sm font-semibold text-primary truncate">{template.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {template.fileName
              ? t('list.uploadedSource', { values: { fileName: template.fileName } })
              : t('list.blankSource')}
            {' · '}
            {t('list.pageCount', { values: { count: template.pageCount } })}
          </p>
        </button>

        {canShowAutomation && (
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
              isActive ? '' : 'text-muted-foreground'
            }`}
            style={
              isActive
                ? { background: 'var(--tf-green-bg)', color: 'var(--tf-green)' }
                : { background: 'var(--tf-faint)' }
            }
          >
            {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />}
            {isActive ? tGenerators('inline.pillActive') : tGenerators('inline.pillManual')}
          </span>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={onOpenDesigner}>
            <PencilRuler className="h-3.5 w-3.5 mr-1.5" />
            {canEdit ? t('list.openButton') : t('list.viewButton')}
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {canShowAutomation && (
            <button
              type="button"
              aria-label="Toggle automation panel"
              className="p-1 text-muted-foreground"
              onClick={() => setOpen((v) => !v)}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {open && canShowAutomation && (
        <div className="px-5 pb-5 space-y-2.5">
          {generators.length === 0 ? (
            <div
              className="flex items-center justify-between gap-3 rounded-lg p-3"
              style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
            >
              <div>
                <p className="text-xs font-medium text-primary">{tGenerators('inline.toggleLabel')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{tGenerators('inline.toggleHelpOff')}</p>
              </div>
              <Switch checked={false} disabled={creating} onCheckedChange={() => createDefaultGenerator()} />
            </div>
          ) : (
            <>
              {generators.map((generator) => (
                <AutomationBlock
                  key={generator.id}
                  generator={generator}
                  template={template}
                  formId={formId}
                  canEdit={canEdit}
                  fillableFields={fillableFields}
                  quizEnabled={quizEnabled}
                  refetch={refetchGenerators}
                />
              ))}
              {canEdit && (
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground hover:text-primary"
                  disabled={creating}
                  onClick={() => createDefaultGenerator()}
                >
                  {tGenerators('inline.addAnotherButton')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
