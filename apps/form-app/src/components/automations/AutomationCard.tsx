import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@apollo/client/react';
import {
  Button,
  Input,
  toastSuccess,
  toastError,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@dculus/ui';
import { MoreVertical, Trash2, Power, PowerOff, PencilLine, Loader2, Workflow, History, FlaskConical, AlertTriangle, Copy } from 'lucide-react';
import {
  UPDATE_AUTOMATION,
  SET_AUTOMATION_STATUS,
  DELETE_AUTOMATION,
  DUPLICATE_AUTOMATION,
  GET_FORM_AUTOMATIONS,
} from '../../graphql/automations';
import { useTranslation } from '../../hooks/useTranslation';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTestAutomation } from '../../hooks/useTestAutomation';
import { triggerTypeI18nKey } from './triggerTypes';

export interface Automation {
  id: string;
  formId: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  triggerType: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Outcome of the most recent run — null until this automation has run at all. */
  lastRunStatus?: string | null;
  lastRunAt?: string | null;
  consecutiveFailureCount?: number;
}

interface AutomationCardProps {
  automation: Automation;
  hasResponses: boolean;
}

const statusStyle = (status: Automation['status']) => {
  switch (status) {
    case 'ACTIVE':
      return { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' };
    case 'PAUSED':
      return { backgroundColor: 'rgba(190,153,58,0.08)', color: '#9c7818', border: '1px solid rgba(190,153,58,0.16)' };
    default:
      return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

export const AutomationCard: React.FC<AutomationCardProps> = ({ automation, hasResponses }) => {
  const { t, locale } = useTranslation('automations');
  const { canEdit } = useFormPermissions();
  const navigate = useNavigate();

  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState(automation.name);
  const [isRenaming, setIsRenaming] = useState(false);

  const refetchQueries = [{ query: GET_FORM_AUTOMATIONS, variables: { formId: automation.formId } }];

  const [updateAutomation] = useMutation(UPDATE_AUTOMATION);
  const [setAutomationStatus] = useMutation(SET_AUTOMATION_STATUS);
  const [deleteAutomation] = useMutation(DELETE_AUTOMATION);
  const [duplicateAutomation] = useMutation(DUPLICATE_AUTOMATION);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const { runTest, isTesting } = useTestAutomation(automation.formId, automation.id);

  // A schedule automation has no triggering response — its data comes from its Filter Responses
  // step — so it is testable even on a form that has never been submitted.
  const canTest = hasResponses || automation.triggerType === 'schedule';

  const openBuilder = () => navigate(`/dashboard/form/${automation.formId}/builder/automations/${automation.id}`);
  const openRuns = () => navigate(`/dashboard/form/${automation.formId}/builder/automations/${automation.id}/runs`);

  const handleTest = (e: React.MouseEvent) => {
    e.stopPropagation();
    runTest();
  };

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = automation.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setIsTogglingStatus(true);
    try {
      await setAutomationStatus({ variables: { id: automation.id, status: nextStatus }, refetchQueries });
      toastSuccess(
        nextStatus === 'ACTIVE' ? t('toasts.activatedTitle') : t('toasts.pausedTitle'),
        nextStatus === 'ACTIVE'
          ? t('toasts.activatedMessage', { values: { name: automation.name } })
          : t('toasts.pausedMessage', { values: { name: automation.name } })
      );
    } catch (error: any) {
      toastError(t('toasts.statusErrorTitle'), error.message);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDuplicating(true);
    try {
      const { data } = await duplicateAutomation({ variables: { id: automation.id }, refetchQueries });
      toastSuccess(
        t('toasts.duplicatedTitle'),
        // Apollo can resolve with `data` undefined (a partial GraphQL error, say). Reading through
        // it unguarded would throw inside the try and show the "couldn't duplicate" toast over a
        // copy that was in fact created.
        t('toasts.duplicatedMessage', {
          values: { name: data?.duplicateAutomation?.name ?? automation.name },
        })
      );
    } catch (error: any) {
      toastError(t('toasts.duplicateErrorTitle'), error.message);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleRenameConfirm = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === automation.name) {
      setShowRenameDialog(false);
      return;
    }
    setIsRenaming(true);
    try {
      await updateAutomation({ variables: { id: automation.id, name: trimmed }, refetchQueries });
      toastSuccess(t('toasts.renamedTitle'), t('toasts.renamedMessage', { values: { name: trimmed } }));
      setShowRenameDialog(false);
    } catch (error: any) {
      toastError(t('toasts.renameErrorTitle'), error.message);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);
    try {
      await deleteAutomation({ variables: { id: automation.id }, refetchQueries });
      toastSuccess(t('toasts.deletedTitle'), t('toasts.deletedMessage', { values: { name: automation.name } }));
    } catch (error: any) {
      toastError(t('toasts.deleteErrorTitle'), error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Only unhealthy outcomes are surfaced: a green "last run succeeded" line on every card is
  // noise, whereas a failure that nobody sees is the entire problem this solves.
  const failures = automation.consecutiveFailureCount ?? 0;
  const healthLabel =
    failures >= 1
      ? t('card.health.failing', { values: { count: failures } })
      : automation.lastRunStatus === 'PARTIAL'
        ? t('card.health.partial')
        : null;
  const healthColor = failures >= 1 ? 'var(--tf-error)' : '#9c7818';

  const updatedAtLabel = new Date(automation.updatedAt).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[rgba(87,84,91,0.03)]"
        onClick={openBuilder}
        role="button"
        aria-label={automation.name}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#e8eaf6' }}
        >
          <Workflow className="h-5 w-5" style={{ color: '#3949ab' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium truncate text-primary">{automation.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={statusStyle(automation.status)}>
              {t(`statuses.${automation.status}`)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`triggerTypes.${triggerTypeI18nKey(automation.triggerType)}`, { defaultValue: automation.triggerType })}
            {' · '}
            {t('card.updatedAt', { values: { date: updatedAtLabel } })}
          </p>

          {/* Health of the last run. Without this an automation whose integration expired looks
              identical to a healthy one until someone opens its run history. */}
          {healthLabel && (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: healthColor }}>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {healthLabel}
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            canTest ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs gap-1.5 text-muted-foreground"
                onClick={handleTest}
                disabled={isTesting}
              >
                {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                {t('card.actions.test')}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5 text-muted-foreground" disabled>
                      <FlaskConical className="h-3.5 w-3.5" />
                      {t('card.actions.test')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('builder.header.testDisabledNoResponses')}</TooltipContent>
              </Tooltip>
            )
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 flex items-center justify-center rounded-lg p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRuns(); }}>
                <History className="mr-2 h-4 w-4" />
                {t('card.actions.runHistory')}
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleToggleStatus} disabled={isTogglingStatus}>
                    {isTogglingStatus
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : automation.status === 'ACTIVE'
                        ? <PowerOff className="mr-2 h-4 w-4" />
                        : <Power className="mr-2 h-4 w-4" />}
                    {automation.status === 'ACTIVE' ? t('card.actions.pause') : t('card.actions.activate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); setRenameValue(automation.name); setShowRenameDialog(true); }}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    {t('card.actions.rename')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
                    {isDuplicating
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Copy className="mr-2 h-4 w-4" />}
                    {t('card.actions.duplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive"
                  >
                    {isDeleting
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Trash2 className="mr-2 h-4 w-4" />}
                    {t('card.actions.delete')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('renameDialog.title')}</DialogTitle>
            <DialogDescription>{t('renameDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="automation-rename-input">{t('renameDialog.nameLabel')}</Label>
            <Input
              id="automation-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              {t('renameDialog.cancel')}
            </Button>
            <Button onClick={handleRenameConfirm} disabled={isRenaming || !renameValue.trim()}>
              {isRenaming ? t('renameDialog.saving') : t('renameDialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', { values: { name: automation.name } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              {t('deleteDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} variant="destructive">
              {t('deleteDialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
