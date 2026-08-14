import React, { useMemo, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  Button,
  Input,
  Switch,
  Progress,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { Lock, SlidersHorizontal, PlayCircle, StopCircle, Loader2, FolderOpen, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FillableFormField } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';
import {
  UPDATE_PDF_GENERATOR,
  DELETE_PDF_GENERATOR,
  START_PDF_GENERATION_RUN,
  CANCEL_PDF_GENERATION_RUN,
} from '../../graphql/pdfGenerators';
import { FilterModal, FilterState } from '../Filters';
import { PdfGeneratorResultsModal } from '../PdfGenerators/PdfGeneratorResultsModal';

const ACTIVE_STATUSES = new Set(['running', 'cancelling']);

const toGraphqlFilters = (filters: Record<string, FilterState>) =>
  Object.values(filters)
    .filter((f) => f.active)
    .map((f) => ({
      fieldId: f.fieldId,
      operator: f.operator,
      value: f.value,
      values: f.values,
      dateRange: f.dateRange,
      numberRange: f.numberRange,
    }));

const safeFormatDistance = (dateVal: string | null | undefined): string => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: false });
  } catch {
    return '';
  }
};

interface AutomationBlockProps {
  generator: any;
  template: { id: string; name: string };
  canEdit: boolean;
  fillableFields: FillableFormField[];
  refetch: () => void;
}

export const AutomationBlock: React.FC<AutomationBlockProps> = ({
  generator,
  template,
  canEdit,
  fillableFields,
  refetch,
}) => {
  const { t } = useTranslation('pdfGenerators');
  const [columnNameDraft, setColumnNameDraft] = useState(generator.columnName ?? '');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [updateGenerator] = useMutation(UPDATE_PDF_GENERATOR);
  const [deleteGenerator, { loading: deleting }] = useMutation(DELETE_PDF_GENERATOR);
  const [startRun, { loading: starting }] = useMutation(START_PDF_GENERATION_RUN);
  const [cancelRun, { loading: cancelling }] = useMutation(CANCEL_PDF_GENERATION_RUN);

  const columnNameLocked = !!generator.columnName;
  const isActive = generator.latestRun && ACTIVE_STATUSES.has(generator.latestRun.status);

  const filtersAsState = useMemo(() => {
    const map: Record<string, FilterState> = {};
    (generator.filters ?? []).forEach((f: any, index: number) => {
      map[`filter_${index}`] = { ...f, active: true };
    });
    return map;
  }, [generator.filters]);
  const activeFilterCount = Object.keys(filtersAsState).length;

  const runError = (error: unknown, title: string) =>
    toastError(title, error instanceof Error ? error.message : t('toasts.genericError'));

  const handleToggleAutoRun = async (checked: boolean) => {
    try {
      await updateGenerator({ variables: { id: generator.id, input: { autoRunOnSubmit: checked } } });
      refetch();
    } catch (error) {
      runError(error, t('toasts.updateFailedTitle'));
    }
  };

  const handleColumnNameBlur = async () => {
    if (columnNameLocked) return;
    const trimmed = columnNameDraft.trim();
    if (!trimmed) return;
    try {
      await updateGenerator({ variables: { id: generator.id, input: { columnName: trimmed } } });
      refetch();
    } catch (error) {
      runError(error, t('toasts.updateFailedTitle'));
    }
  };

  const handleFilenameChange = async (value: string) => {
    try {
      await updateGenerator({
        variables: { id: generator.id, input: { filenameFieldId: value === '__none__' ? null : value } },
      });
      refetch();
    } catch (error) {
      runError(error, t('toasts.updateFailedTitle'));
    }
  };

  const handleApplyFilters = async (newFilters: Record<string, FilterState>, newLogic: 'AND' | 'OR') => {
    try {
      await updateGenerator({
        variables: {
          id: generator.id,
          input: { filters: toGraphqlFilters(newFilters), filterLogic: newLogic },
        },
      });
      refetch();
    } catch (error) {
      runError(error, t('toasts.updateFailedTitle'));
    }
  };

  const handleRun = async () => {
    try {
      await startRun({ variables: { generatorId: generator.id } });
      toastSuccess(t('toasts.runStartedTitle'), '');
      refetch();
    } catch (error) {
      runError(error, t('toasts.runStartFailedTitle'));
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRun({ variables: { runId: generator.latestRun.id } });
      toastSuccess(t('toasts.runCancelledTitle'), '');
      refetch();
    } catch (error) {
      runError(error, t('toasts.runCancelFailedTitle'));
    }
  };

  const handleRemove = async () => {
    try {
      await deleteGenerator({ variables: { id: generator.id } });
      toastSuccess(t('toasts.deletedTitle'), t('toasts.deletedDescription'));
      setDeleteConfirmOpen(false);
      refetch();
    } catch (error) {
      runError(error, t('toasts.deleteFailedTitle'));
    }
  };

  const renderLastRunStatus = () => {
    const run = generator.latestRun;
    if (!run) return t('inline.lastRun.never');
    if (run.status === 'running') {
      return t('inline.lastRun.running', { values: { processed: run.processedCount, total: run.totalCount } });
    }
    if (run.status === 'cancelling') return t('inline.lastRun.cancelling');
    const time = safeFormatDistance(run.completedAt ?? run.startedAt);
    if (run.status === 'completed') {
      return t('inline.lastRun.completed', {
        values: { time, succeeded: run.succeededCount, failed: run.failedCount },
      });
    }
    if (run.status === 'cancelled') return t('inline.lastRun.cancelled', { values: { time } });
    return t('inline.lastRun.failed', { values: { time } });
  };

  const rowLineStyle = { borderTop: '1px solid var(--tf-border-light)' };

  return (
    <div
      className="space-y-2.5 rounded-lg p-3"
      style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">{t('inline.toggleLabel')}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {generator.autoRunOnSubmit
              ? t('inline.toggleHelpOn', { values: { column: generator.columnName || template.name } })
              : t('inline.toggleHelpOff')}
          </p>
        </div>
        <Switch checked={generator.autoRunOnSubmit} onCheckedChange={handleToggleAutoRun} disabled={!canEdit} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2.5" style={rowLineStyle}>
        <div>
          <p className="text-xs font-medium text-primary">{t('inline.onlyWhenLabel')}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {activeFilterCount === 0
              ? t('inline.noFilterChip')
              : t('inline.matchCount', { values: { count: generator.matchingResponseCount ?? 0 } })}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs shrink-0"
          disabled={!canEdit}
          onClick={() => setShowFilterModal(true)}
        >
          <SlidersHorizontal className="h-3 w-3 mr-1" />
          {t('inline.editFilterButton')}
          {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2.5" style={rowLineStyle}>
        <p className="text-xs font-medium text-primary flex items-center gap-1.5">
          {t('inline.columnNameLabel')}
          {columnNameLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </p>
        <Input
          className="h-7 text-xs max-w-[160px]"
          placeholder={t('inline.columnNamePlaceholder', { values: { templateName: template.name } })}
          value={columnNameDraft}
          disabled={!canEdit || columnNameLocked}
          onChange={(e) => setColumnNameDraft(e.target.value)}
          onBlur={handleColumnNameBlur}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2.5" style={rowLineStyle}>
        <p className="text-xs font-medium text-primary">{t('inline.filenameFieldLabel')}</p>
        <Select
          value={generator.filenameFieldId || '__none__'}
          onValueChange={handleFilenameChange}
          disabled={!canEdit}
        >
          <SelectTrigger className="h-7 text-xs max-w-[160px]">
            <SelectValue placeholder={t('inline.filenameFieldPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t('inline.filenameFieldNone')}</SelectItem>
            {fillableFields.map((field) => (
              <SelectItem key={field.id} value={field.id}>
                {field.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isActive && (
        <Progress
          value={
            generator.latestRun.totalCount > 0
              ? Math.round((generator.latestRun.processedCount / generator.latestRun.totalCount) * 100)
              : 100
          }
        />
      )}
      <p className="text-[11px] text-muted-foreground">{renderLastRunStatus()}</p>

      <div className="flex items-center gap-2 pt-2.5" style={rowLineStyle}>
        {isActive ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            disabled={cancelling || generator.latestRun.status === 'cancelling'}
            onClick={handleCancel}
          >
            <StopCircle className="h-3.5 w-3.5 mr-1.5" />
            {t('inline.cancelRunButton')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={!canEdit || starting}
            onClick={handleRun}
          >
            {starting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
            )}
            {t('inline.runNowButton')}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setShowResultsModal(true)}
        >
          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
          {t('inline.viewFilesButton')}
        </Button>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {t('inline.removeButton')}
          </Button>
        )}
      </div>

      <FilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        fields={fillableFields}
        filters={filtersAsState}
        filterLogic={generator.filterLogic ?? 'AND'}
        onApplyFilters={(newFilters, newLogic) => {
          setShowFilterModal(false);
          handleApplyFilters(newFilters, newLogic);
        }}
      />

      {showResultsModal && (
        <PdfGeneratorResultsModal
          generatorId={generator.id}
          generatorName={generator.columnName || template.name}
          open={true}
          onClose={() => setShowResultsModal(false)}
        />
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialog.description', { values: { name: generator.columnName || template.name } })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              {t('deleteDialog.cancelButton')}
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={deleting}>
              {deleting ? t('deleteDialog.deletingButton') : t('deleteDialog.deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
