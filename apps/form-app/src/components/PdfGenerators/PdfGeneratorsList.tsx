import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Button,
  Badge,
  Progress,
  LoadingSpinner,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import {
  Wand2,
  PlayCircle,
  StopCircle,
  Pencil,
  Trash2,
  Loader2,
  Zap,
  FolderOpen,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from '../../hooks/useTranslation';
import {
  GET_PDF_GENERATORS,
  START_PDF_GENERATION_RUN,
  CANCEL_PDF_GENERATION_RUN,
  DELETE_PDF_GENERATOR,
} from '../../graphql/pdfGenerators';
import { PdfGeneratorResultsModal } from './PdfGeneratorResultsModal';

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

interface PdfGeneratorsListProps {
  formId: string;
  canEdit: boolean;
}

const ACTIVE_STATUSES = new Set(['running', 'cancelling']);
const MAX_PDF_GENERATORS_PER_FORM = 6;

export const PdfGeneratorsList: React.FC<PdfGeneratorsListProps> = ({ formId, canEdit }) => {
  const { t } = useTranslation('pdfGenerators');
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [resultsTarget, setResultsTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, loading, refetch, startPolling, stopPolling } = useQuery(GET_PDF_GENERATORS, {
    variables: { formId },
    skip: !formId,
    fetchPolicy: 'cache-and-network',
  });

  const generators: any[] = data?.pdfGenerators ?? [];
  const atGeneratorLimit = generators.length >= MAX_PDF_GENERATORS_PER_FORM;
  const hasActiveRun = generators.some((g) => g.latestRun && ACTIVE_STATUSES.has(g.latestRun.status));

  // Poll the whole list only while some generator has a run in flight — avoids
  // hitting the server every 3s when nothing is running (same pattern as
  // PluginDashboardModal's backfill polling).
  useEffect(() => {
    if (hasActiveRun) {
      startPolling(3000);
    } else {
      stopPolling();
    }
  }, [hasActiveRun, startPolling, stopPolling]);

  const [startRun, { loading: starting }] = useMutation(START_PDF_GENERATION_RUN);
  const [cancelRun, { loading: cancelling }] = useMutation(CANCEL_PDF_GENERATION_RUN);
  const [deletePdfGenerator, { loading: deleting }] = useMutation(DELETE_PDF_GENERATOR);

  const handleRun = async (generatorId: string) => {
    try {
      await startRun({ variables: { generatorId } });
      toastSuccess(t('toasts.runStartedTitle'), '');
      refetch();
    } catch (error) {
      toastError(
        t('toasts.runStartFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    }
  };

  const handleCancel = async (runId: string) => {
    try {
      await cancelRun({ variables: { runId } });
      toastSuccess(t('toasts.runCancelledTitle'), '');
      refetch();
    } catch (error) {
      toastError(
        t('toasts.runCancelFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePdfGenerator({ variables: { id: deleteTarget.id } });
      toastSuccess(t('toasts.deletedTitle'), t('toasts.deletedDescription'));
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      toastError(
        t('toasts.deleteFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    }
  };

  const renderLastRunStatus = (generator: any) => {
    const run = generator.latestRun;
    if (!run) return t('list.lastRun.never');

    if (run.status === 'running') {
      return t('list.lastRun.running', { values: { processed: run.processedCount, total: run.totalCount } });
    }
    if (run.status === 'cancelling') {
      return t('list.lastRun.cancelling');
    }
    const time = safeFormatDistance(run.completedAt ?? run.startedAt);
    if (run.status === 'completed') {
      return t('list.lastRun.completed', {
        values: { time, succeeded: run.succeededCount, failed: run.failedCount },
      });
    }
    if (run.status === 'cancelled') {
      return t('list.lastRun.cancelled', { values: { time } });
    }
    return t('list.lastRun.failed', { values: { time } });
  };

  if (loading && generators.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-primary">{t('header.title')}</h1>
          <p className="text-sm mt-0.5 text-muted-foreground">{t('header.description')}</p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            data-testid="pdf-generator-new-button"
            disabled={atGeneratorLimit}
            onClick={() => navigate(`/dashboard/form/${formId}/pdf-templates/generators/new`)}
          >
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            {t('newButton')}
          </Button>
        )}
      </div>

      {canEdit && atGeneratorLimit && (
        <p className="text-xs text-muted-foreground">
          {t('limits.generatorLimitReached', { values: { max: MAX_PDF_GENERATORS_PER_FORM } })}
        </p>
      )}

      {generators.length === 0 ? (
        <EmptyState
          icon={<Wand2 className="h-6 w-6 text-muted-foreground" />}
          title={t('empty.title')}
          description={canEdit ? t('empty.description') : t('empty.viewerDescription')}
        />
      ) : (
        <div
          className="rounded-xl bg-white dark:bg-card overflow-hidden"
          style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
        >
          {generators.map((generator, i) => {
            const isActive = generator.latestRun && ACTIVE_STATUSES.has(generator.latestRun.status);
            return (
              <div
                key={generator.id}
                className="flex flex-col gap-2.5 px-5 py-4"
                style={{ borderTop: i > 0 ? '1px solid var(--tf-border-light)' : undefined }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-50">
                    <Wand2 className="h-5 w-5 text-violet-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-primary truncate">{generator.name}</p>
                      {generator.autoRunOnSubmit && (
                        <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                          <Zap className="h-2.5 w-2.5" />
                          {t('list.autoRunBadge')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('list.templateLabel', { values: { name: generator.template?.name ?? '' } })}
                      {' · '}
                      {t('list.matchLabel', { values: { count: generator.matchingResponseCount } })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-xs"
                      onClick={() => setResultsTarget({ id: generator.id, name: generator.name })}
                    >
                      <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                      {t('list.viewResultsButton')}
                    </Button>
                    {isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 text-xs text-destructive hover:text-destructive"
                        disabled={cancelling || generator.latestRun.status === 'cancelling'}
                        onClick={() => handleCancel(generator.latestRun.id)}
                      >
                        <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                        {t('list.cancelButton')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        disabled={!canEdit || starting}
                        onClick={() => handleRun(generator.id)}
                      >
                        {starting ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {t('list.runButton')}
                      </Button>
                    )}
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground"
                          onClick={() => navigate(`/dashboard/form/${formId}/pdf-templates/generators/${generator.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: generator.id, name: generator.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {isActive && (
                  <div className="pl-14">
                    <Progress
                      value={
                        generator.latestRun.totalCount > 0
                          ? Math.round(
                              (generator.latestRun.processedCount / generator.latestRun.totalCount) * 100
                            )
                          : 100
                      }
                    />
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground pl-14">{renderLastRunStatus(generator)}</p>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialog.description', { values: { name: deleteTarget?.name ?? '' } })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('deleteDialog.cancelButton')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('deleteDialog.deletingButton') : t('deleteDialog.deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resultsTarget && (
        <PdfGeneratorResultsModal
          generatorId={resultsTarget.id}
          generatorName={resultsTarget.name}
          open={resultsTarget !== null}
          onClose={() => setResultsTarget(null)}
        />
      )}
    </div>
  );
};
