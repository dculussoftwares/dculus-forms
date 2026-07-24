import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Badge,
  Card,
  LoadingSpinner,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { CheckCircle2, XCircle, SkipForward, ChevronDown, Loader2, FlaskConical, Ban } from 'lucide-react';
import { GET_AUTOMATION_RUN, GET_AUTOMATION_RUNS, CANCEL_AUTOMATION_RUN } from '../../../graphql/automations';
import { useTranslation } from '../../../hooks/useTranslation';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import {
  formatDuration,
  getStepIcon,
  getStepLabel,
  isRunActive,
  runStatusStyle,
  stepStatusStyle,
} from './runFormatting';

interface AutomationRunDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string | null;
  automationId: string;
}

export const AutomationRunDetail: React.FC<AutomationRunDetailProps> = ({
  open,
  onOpenChange,
  runId,
  automationId,
}) => {
  const { t, locale } = useTranslation('automations');
  const { canEdit } = useFormPermissions();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const {
    data,
    loading,
    error,
    refetch,
    startPolling,
    stopPolling,
  } = useQuery(GET_AUTOMATION_RUN, {
    variables: { id: runId },
    skip: !open || !runId,
    fetchPolicy: 'network-only',
  });

  const run = data?.automationRun;

  useEffect(() => {
    if (open && runId) {
      refetch();
    }
  }, [open, runId, refetch]);

  useEffect(() => {
    if (open && isRunActive(run?.status)) {
      startPolling(3000);
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [open, run?.status, startPolling, stopPolling]);

  const [cancelRun, { loading: isCancelling }] = useMutation(CANCEL_AUTOMATION_RUN, {
    refetchQueries: [{ query: GET_AUTOMATION_RUNS, variables: { automationId } }],
  });

  const handleCancel = async () => {
    if (!runId) return;
    setShowCancelConfirm(false);
    try {
      const result = await cancelRun({ variables: { runId } });
      if (result.error) throw result.error;
      toastSuccess(t('runs.toasts.cancelledTitle'), t('runs.toasts.cancelledMessage'));
      refetch();
    } catch (err: any) {
      toastError(t('runs.toasts.cancelErrorTitle'), err.message);
    }
  };

  const isTest = !!run?.context?.test;
  const canCancel = canEdit && isRunActive(run?.status);

  const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString(locale);

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--tf-green)' }} />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.body.style.pointerEvents = '';
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{t('runs.detail.title')}</DialogTitle>
              {isTest && (
                <Badge variant="accent" className="gap-1 text-[10px]">
                  <FlaskConical className="h-3 w-3" />
                  {t('runs.testChip')}
                </Badge>
              )}
              {run && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={runStatusStyle(run.status)}
                >
                  {t(`runs.statuses.${run.status}`, { defaultValue: run.status })}
                </span>
              )}
            </div>
            <DialogDescription>{t('runs.detail.description')}</DialogDescription>
          </DialogHeader>

          {canCancel && (
            <div className="flex justify-end -mt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isCancelling}
              >
                {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                {t('runs.cancelButton')}
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-2">
            {loading && !run && (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner />
              </div>
            )}

            {error && !run && (
              <Card className="p-8 text-center">
                <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                <h3 className="mb-2 text-xl font-semibold">{t('runs.detail.errorTitle')}</h3>
                <p className="text-foreground">{error.message}</p>
              </Card>
            )}

            {run && (!run.stepRuns || run.stepRuns.length === 0) && (
              <Card className="p-8 text-center">
                <p className="text-foreground">{t('runs.detail.noSteps')}</p>
              </Card>
            )}

            {run?.stepRuns?.length > 0 && (
              <div className="space-y-3">
                {run.stepRuns.map((step: any) => {
                  const StepIcon = getStepIcon(step.nodeType);
                  const duration = formatDuration(step.startedAt, step.finishedAt);
                  return (
                    <Collapsible key={step.id}>
                      <Card className="p-4">
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-start gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ backgroundColor: 'var(--tf-icon-gray, #f1f1f3)' }}
                            >
                              <StepIcon className="h-4 w-4" style={{ color: 'var(--tf-dark)' }} />
                            </div>

                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  {getStepStatusIcon(step.status)}
                                  <h4 className="font-semibold text-primary truncate">{getStepLabel(step.nodeType)}</h4>
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                                    style={stepStatusStyle(step.status)}
                                  >
                                    {t(`runs.detail.stepStatuses.${step.status}`, { defaultValue: step.status })}
                                  </span>
                                  {step.attempt > 1 && (
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                      {t('runs.detail.attempt', { values: { count: step.attempt } })}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                                  {duration && <span>{duration}</span>}
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{formatTimestamp(step.startedAt)}</p>

                              {step.status === 'FAILED' && step.errorMessage && (
                                <div className="mt-2 text-sm text-destructive bg-[var(--tf-error-bg)] px-3 py-2 rounded">
                                  {step.errorMessage}
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="mt-3 space-y-3 pl-11">
                            {step.output != null && (
                              <div>
                                <h5 className="text-sm font-semibold text-foreground mb-2">{t('runs.detail.output')}</h5>
                                <pre className="text-xs bg-background p-3 rounded overflow-x-auto border">
                                  {JSON.stringify(step.output, null, 2)}
                                </pre>
                              </div>
                            )}
                            {step.errorMessage && (
                              <div>
                                <h5 className="text-sm font-semibold text-foreground mb-2">{t('runs.detail.error')}</h5>
                                <pre className="text-xs bg-background p-3 rounded overflow-x-auto border text-destructive">
                                  {step.errorMessage}
                                </pre>
                              </div>
                            )}
                            <div>
                              <h5 className="text-sm font-semibold text-foreground mb-1">{t('runs.detail.nodeId')}</h5>
                              <code className="text-xs text-foreground bg-background px-2 py-1 rounded">{step.nodeId}</code>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('runs.cancelConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('runs.cancelConfirm.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCancelConfirm(false)}>
              {t('runs.cancelConfirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} variant="destructive">
              {t('runs.cancelConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
