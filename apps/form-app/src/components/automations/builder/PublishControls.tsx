import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { ChevronDown, Loader2, Pause, Play, Rocket, Undo2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toastError,
  toastSuccess,
} from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import {
  DISCARD_AUTOMATION_DRAFT,
  PUBLISH_AUTOMATION,
  SET_AUTOMATION_STATUS,
} from '../../../graphql/automations';
import { extractValidationErrors } from './validation';
import { describeCron } from './cronDescription';

export interface PublishableAutomation {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  triggerType: string;
  triggerConfig?: { cron?: string; timezone?: string } | null;
  graph: { nodes: Array<{ id: string; type: string; data?: any }> };
  version: number;
}

interface PublishControlsProps {
  automation: PublishableAutomation;
  /** Sends pending autosaves and resolves true when the server has everything on screen. */
  flush: () => Promise<boolean>;
  /** Called after a discard so the page can reload the builder from the returned live version. */
  onDiscarded: (automation: any) => void;
  /** Called when a publish was refused for validation issues, so the issues list can open. */
  onBlockedByIssues: () => void;
}

interface PendingConfirmation {
  activate: boolean;
  removedSteps: string[];
  scheduleChange: string | null;
}

const countIssues = () => {
  const { validationErrorsByNode, structuralErrors } = useAutomationBuilderStore.getState();
  return Object.values(validationErrorsByNode).reduce((sum, list) => sum + list.length, 0) + structuralErrors.length;
};

/**
 * The header's primary action. Which button shows depends on whether the automation is live and
 * whether it has unpublished edits — see the state table in docs/automations-autosave-ux-proposal.md.
 * There is no Save: edits autosave to the draft, and this is the only thing that changes what runs.
 */
export const PublishControls: React.FC<PublishControlsProps> = ({ automation, flush, onDiscarded, onBlockedByIssues }) => {
  const { t } = useTranslation('automations');
  const hasUnpublishedChanges = useAutomationBuilderStore((s) => s.hasUnpublishedChanges);
  const saveState = useAutomationBuilderStore((s) => s.saveState);

  const [publishMutation, { loading: isPublishing }] = useMutation(PUBLISH_AUTOMATION);
  const [statusMutation, { loading: isChangingStatus }] = useMutation(SET_AUTOMATION_STATUS);
  const [discardMutation, { loading: isDiscarding }] = useMutation(DISCARD_AUTOMATION_DRAFT);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const isNeverPublished = automation.status === 'DRAFT';
  const isActive = automation.status === 'ACTIVE';
  const hasUnpublished = hasUnpublishedChanges && !isNeverPublished;
  const isBusy = isPublishing || isChangingStatus || isDiscarding;

  const reportValidation = (error: unknown, titleKey: string, messageKey: string): boolean => {
    const issues = CombinedGraphQLErrors.is(error) ? extractValidationErrors(error) : undefined;
    if (!issues) return false;
    useAutomationBuilderStore.getState().setValidationErrors(issues);
    toastError(t(titleKey), t(messageKey));
    onBlockedByIssues();
    return true;
  };

  const reportConflict = (error: unknown): boolean => {
    if (!CombinedGraphQLErrors.is(error)) return false;
    const match = error.errors.find((e) => e.extensions?.code === 'AUTOMATION_DRAFT_CONFLICT');
    if (!match) return false;
    const ext = match.extensions as Record<string, any>;
    useAutomationBuilderStore.getState().setConflict({
      draftRevision: ext.draftRevision ?? null,
      draftUpdatedAt: ext.draftUpdatedAt ?? null,
      draftUpdatedById: ext.draftUpdatedById ?? null,
    });
    return true;
  };

  // Changes worth a second look before they go live: steps that stop running, or a new schedule.
  const describeImpact = (activate: boolean): PendingConfirmation | null => {
    if (isNeverPublished) return null;
    const { nodes, triggerConfig } = useAutomationBuilderStore.getState();
    const keptIds = new Set(nodes.map((n) => n.id));
    const removedSteps = automation.graph.nodes
      .filter((n) => n.type === 'action' && !keptIds.has(n.id))
      .map((n) => n.data?.name ?? n.data?.actionType ?? n.id);

    const live = automation.triggerConfig;
    const scheduleChanged =
      automation.triggerType === 'schedule' &&
      (live?.cron !== triggerConfig?.cron || live?.timezone !== triggerConfig?.timezone);
    const scheduleChange = scheduleChanged ? describeCron(triggerConfig?.cron, t) : null;

    return removedSteps.length > 0 || scheduleChange ? { activate, removedSteps, scheduleChange } : null;
  };

  const runPublish = async (activate: boolean) => {
    const before = useAutomationBuilderStore.getState();
    try {
      const result = await publishMutation({
        variables: { id: automation.id, baseRevision: before.serverDraftRevision, activate },
      });
      if (result.error) throw result.error;
      const published = result.data.publishAutomation;

      useAutomationBuilderStore.getState().ackSave({
        automationId: automation.id,
        loadEpoch: before.loadEpoch,
        sentLocalRevision: before.localRevision,
        draftRevision: published.draftRevision,
        hasUnpublishedChanges: false,
        issues: [],
      });

      if (isNeverPublished && activate) {
        toastSuccess(t('toasts.activatedTitle'), t('toasts.activatedMessage', { values: { name: automation.name } }));
      } else {
        toastSuccess(
          t('builder.header.publishedToastTitle', { values: { version: published.version } }),
          t('builder.header.publishedToastMessage')
        );
      }
    } catch (error: unknown) {
      if (reportConflict(error)) return;
      if (reportValidation(error, 'builder.header.publishErrorTitle', 'builder.header.publishInvalidMessage')) return;
      toastError(t('builder.header.publishErrorTitle'), error instanceof Error ? error.message : String(error));
    }
  };

  const handlePublish = async (activate: boolean) => {
    if (!(await flush())) {
      if (useAutomationBuilderStore.getState().saveState !== 'conflict') {
        toastError(t('builder.header.publishErrorTitle'), t('builder.header.publishSaveFailedMessage'));
      }
      return;
    }
    if (countIssues() > 0) {
      onBlockedByIssues();
      return;
    }
    const impact = describeImpact(activate);
    if (impact) {
      setConfirmation(impact);
      return;
    }
    await runPublish(activate);
  };

  const handleSetStatus = async (status: 'ACTIVE' | 'PAUSED') => {
    try {
      const result = await statusMutation({ variables: { id: automation.id, status } });
      if (result.error) throw result.error;
      useAutomationBuilderStore.getState().clearValidationErrors();
      toastSuccess(
        status === 'ACTIVE' ? t('toasts.activatedTitle') : t('toasts.pausedTitle'),
        status === 'ACTIVE'
          ? t('toasts.activatedMessage', { values: { name: automation.name } })
          : t('toasts.pausedMessage', { values: { name: automation.name } })
      );
    } catch (error: unknown) {
      if (reportValidation(error, 'builder.header.activateInvalidTitle', 'builder.header.activateInvalidMessage')) return;
      toastError(t('toasts.statusErrorTitle'), error instanceof Error ? error.message : String(error));
    }
  };

  const handleDiscard = async () => {
    setShowDiscardDialog(false);
    try {
      const result = await discardMutation({ variables: { id: automation.id } });
      if (result.error) throw result.error;
      onDiscarded(result.data.discardAutomationDraft);
      toastSuccess(t('builder.header.discardedToastTitle'), t('builder.header.discardedToastMessage'));
    } catch (error: unknown) {
      toastError(t('builder.header.discardErrorTitle'), error instanceof Error ? error.message : String(error));
    }
  };

  // Which button is primary, and what it does.
  let primary: { label: string; icon: React.ReactNode; onClick: () => void; outline?: boolean };
  let secondary: { label: string; onClick: () => void }[] = [];

  if (isNeverPublished) {
    primary = { label: t('builder.header.activateButton'), icon: <Play className="h-3.5 w-3.5 mr-1.5" />, onClick: () => handlePublish(true) };
  } else if (isActive && !hasUnpublished) {
    primary = { label: t('builder.header.pauseButton'), icon: <Pause className="h-3.5 w-3.5 mr-1.5" />, onClick: () => handleSetStatus('PAUSED'), outline: true };
  } else if (isActive) {
    primary = { label: t('builder.header.publishButton'), icon: <Rocket className="h-3.5 w-3.5 mr-1.5" />, onClick: () => handlePublish(false) };
    secondary = [{ label: t('builder.header.pauseButton'), onClick: () => handleSetStatus('PAUSED') }];
  } else if (!hasUnpublished) {
    primary = { label: t('builder.header.resumeButton'), icon: <Play className="h-3.5 w-3.5 mr-1.5" />, onClick: () => handleSetStatus('ACTIVE') };
  } else {
    primary = { label: t('builder.header.publishAndResumeButton'), icon: <Rocket className="h-3.5 w-3.5 mr-1.5" />, onClick: () => handlePublish(true) };
    secondary = [{ label: t('builder.header.publishWithoutResume'), onClick: () => handlePublish(false) }];
  }

  return (
    <>
      {hasUnpublished && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => setShowDiscardDialog(true)}
          disabled={isBusy}
          data-testid="automation-discard-button"
        >
          <Undo2 className="h-3.5 w-3.5" />
          {t('builder.header.discardButton')}
        </Button>
      )}

      <div className="flex items-center">
        <Button
          size="sm"
          variant={primary.outline ? 'outline' : 'default'}
          className={secondary.length > 0 ? 'rounded-r-none' : undefined}
          onClick={primary.onClick}
          disabled={isBusy || saveState === 'conflict'}
          data-testid="automation-primary-action"
        >
          {isBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : primary.icon}
          {primary.label}
        </Button>
        {secondary.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="rounded-l-none border-l border-white/30 px-2"
                disabled={isBusy || saveState === 'conflict'}
                aria-label={t('builder.header.moreActions')}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {secondary.map((item) => (
                <DropdownMenuItem key={item.label} onClick={item.onClick}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('builder.discardDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('builder.discardDialog.description', { values: { version: automation.version } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('builder.discardDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDiscard}>
              {t('builder.discardDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmation} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('builder.publishDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {[
                confirmation?.scheduleChange &&
                  t('builder.publishDialog.scheduleChanged', { values: { schedule: confirmation.scheduleChange } }),
                confirmation && confirmation.removedSteps.length > 0
                  ? t('builder.publishDialog.removedSteps', { values: { names: confirmation.removedSteps.join(', ') } })
                  : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('builder.publishDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = confirmation;
                setConfirmation(null);
                if (pending) void runPublish(pending.activate);
              }}
            >
              {t('builder.publishDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
