import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from '../hooks/useTranslation';
import { Button, Input, Badge, LoadingSpinner, EmptyState, toastSuccess, toastError } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_AUTOMATION, UPDATE_AUTOMATION, SET_AUTOMATION_STATUS } from '../graphql/automations';
import { AlertCircle, ArrowLeft, Pencil, Play, Loader2 } from 'lucide-react';
import { AutomationCanvas } from '../components/automations/builder/AutomationCanvas';
import { useAutomationBuilderStore } from '../store/useAutomationBuilderStore';
import { FormPermissionProvider, type PermissionLevel } from '../contexts/FormPermissionContext';
import { useFormPermissions } from '../hooks/useFormPermissions';
import { extractValidationErrors } from '../components/automations/builder/validation';

const AutomationBuilderContent: React.FC<{ form: any; automation: any }> = ({ form, automation }) => {
  const { t } = useTranslation('automations');
  const navigate = useNavigate();
  const { canEdit } = useFormPermissions();

  const automationId = automation.id;
  const formId = form.id;

  const loadGraph = useAutomationBuilderStore((s) => s.loadGraph);
  const resetBuilder = useAutomationBuilderStore((s) => s.resetBuilder);
  const isDirty = useAutomationBuilderStore((s) => s.isDirty);
  const structuralErrors = useAutomationBuilderStore((s) => s.structuralErrors);
  const setValidationErrors = useAutomationBuilderStore((s) => s.setValidationErrors);
  const clearValidationErrors = useAutomationBuilderStore((s) => s.clearValidationErrors);
  const getSerializableGraph = useAutomationBuilderStore((s) => s.getSerializableGraph);
  const markSaved = useAutomationBuilderStore((s) => s.markSaved);

  // Only (re)load the graph into the store when the automation actually changes — the cache
  // updates `automation` after every Save/Activate mutation (same id), and re-running loadGraph
  // then would stomp on in-progress local edits with what we just persisted.
  const loadedAutomationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadedAutomationIdRef.current === automationId) return;
    loadedAutomationIdRef.current = automationId;
    loadGraph({
      automationId,
      formTitle: form.title,
      graph: automation.graph,
      isReadOnly: !canEdit,
    });
  }, [automationId, automation.graph, form.title, canEdit, loadGraph]);

  useEffect(() => () => resetBuilder(), [resetBuilder]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(automation.name);
  useEffect(() => {
    setNameDraft(automation.name);
  }, [automation.name]);

  const [updateAutomation, { loading: isSavingGraph }] = useMutation(UPDATE_AUTOMATION);
  const [renameAutomation, { loading: isRenaming }] = useMutation(UPDATE_AUTOMATION);
  const [setStatus, { loading: isActivating }] = useMutation(SET_AUTOMATION_STATUS);

  const handleCommitName = async () => {
    setIsEditingName(false);
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === automation.name) {
      setNameDraft(automation.name);
      return;
    }
    try {
      await renameAutomation({ variables: { id: automationId, name: trimmed } });
      toastSuccess(t('toasts.renamedTitle'), t('toasts.renamedMessage', { values: { name: trimmed } }));
    } catch (error: any) {
      setNameDraft(automation.name);
      toastError(t('toasts.renameErrorTitle'), error.message);
    }
  };

  const handleSave = async () => {
    try {
      const graph = getSerializableGraph();
      await updateAutomation({ variables: { id: automationId, graph } });
      markSaved();
      clearValidationErrors();
      toastSuccess(t('builder.header.saveSuccessTitle'), t('builder.header.saveSuccessMessage'));
    } catch (error: any) {
      toastError(t('builder.header.saveErrorTitle'), error.message);
    }
  };

  const handleActivateToggle = async () => {
    const nextStatus = automation.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await setStatus({ variables: { id: automationId, status: nextStatus } });
      clearValidationErrors();
      toastSuccess(
        nextStatus === 'ACTIVE' ? t('toasts.activatedTitle') : t('toasts.pausedTitle'),
        nextStatus === 'ACTIVE'
          ? t('toasts.activatedMessage', { values: { name: automation.name } })
          : t('toasts.pausedMessage', { values: { name: automation.name } })
      );
    } catch (error: any) {
      const validationErrors = extractValidationErrors(error);
      if (validationErrors) {
        setValidationErrors(validationErrors);
        toastError(t('builder.header.activateInvalidTitle'), t('builder.header.activateInvalidMessage'));
      } else {
        toastError(t('toasts.statusErrorTitle'), error.message);
      }
    }
  };

  // Warn on tab close/refresh while there are unsaved graph changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleBack = () => {
    if (isDirty && !window.confirm(t('builder.header.unsavedChangesConfirm'))) return;
    navigate(`/dashboard/form/${formId}/automations`);
  };

  const isActive = automation.status === 'ACTIVE';

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[520px]">
      <div className="flex items-center gap-3 px-1 pb-3 shrink-0">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground shrink-0" onClick={handleBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('builder.backButton')}
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isEditingName && canEdit ? (
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleCommitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') {
                  setNameDraft(automation.name);
                  setIsEditingName(false);
                }
              }}
              className="h-8 max-w-xs text-sm font-semibold"
              disabled={isRenaming}
            />
          ) : (
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-semibold truncate min-w-0 disabled:cursor-default"
              style={{ color: 'var(--tf-dark)' }}
              onClick={() => canEdit && setIsEditingName(true)}
              disabled={!canEdit}
            >
              <span className="truncate">{automation.name}</span>
              {canEdit && <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />}
            </button>
          )}
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] ${isActive ? 'border-[var(--tf-green-bg-md)] bg-[var(--tf-green-bg)] text-[var(--tf-green)]' : ''}`}
          >
            {t(`statuses.${automation.status}`)}
          </Badge>
          {isDirty && (
            <span className="text-xs shrink-0" style={{ color: 'var(--tf-light-muted)' }}>
              {t('builder.header.unsavedIndicator')}
            </span>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={!isDirty || isSavingGraph}>
              {isSavingGraph && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {t('builder.header.saveButton')}
            </Button>
            <Button size="sm" onClick={handleActivateToggle} disabled={isActivating}>
              {isActivating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isActive ? t('builder.header.pauseButton') : t('builder.header.activateButton')}
            </Button>
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="text-xs text-muted-foreground px-1 pb-2" data-testid="automation-builder-readonly-notice">
          {t('builder.readOnlyNotice')}
        </p>
      )}

      {structuralErrors.length > 0 && (
        <div
          className="mx-1 mb-3 rounded-lg px-4 py-2.5 space-y-1"
          style={{ background: 'var(--tf-error-bg)', border: '1px solid var(--tf-error-bg-md)' }}
        >
          {structuralErrors.map((err, i) => (
            <p key={i} className="text-xs" style={{ color: 'var(--tf-error)' }}>
              {err.message}
            </p>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-xl overflow-hidden" style={{ border: '1px solid var(--tf-border-medium)' }}>
        <AutomationCanvas form={form} />
      </div>
    </div>
  );
};

const AutomationBuilder: React.FC = () => {
  const { formId, automationId } = useParams<{ formId: string; automationId: string }>();
  const { t } = useTranslation('automations');

  const { data: formData, loading: formLoading } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const {
    data: automationData,
    loading: automationLoading,
    error: automationError,
  } = useQuery(GET_AUTOMATION, {
    variables: { id: automationId },
    skip: !automationId,
  });

  const form = formData?.form;
  const automation = automationData?.automation;

  const breadcrumbs = [
    { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
    { label: form ? form.title : t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
    { label: t('layout.breadcrumbs.automations'), href: `/dashboard/form/${formId}/automations` },
    { label: automation ? automation.name : t('layout.breadcrumbs.builder') },
  ];

  if (formLoading || automationLoading) {
    return (
      <MainLayout title={t('builder.title')} breadcrumbs={breadcrumbs}>
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (automationError || !automation || !form) {
    return (
      <MainLayout title={t('builder.title')} breadcrumbs={breadcrumbs}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.automationNotFound.title')}
          description={t('errors.automationNotFound.description')}
        />
      </MainLayout>
    );
  }

  const userPermission = (form.userPermission as PermissionLevel) || 'VIEWER';

  return (
    <MainLayout title={automation.name} breadcrumbs={breadcrumbs}>
      <FormPermissionProvider userPermission={userPermission}>
        <AutomationBuilderContent form={form} automation={automation} />
      </FormPermissionProvider>
    </MainLayout>
  );
};

export default AutomationBuilder;
