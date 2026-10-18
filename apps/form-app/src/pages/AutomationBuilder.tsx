import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useApolloClient, useQuery, useMutation } from '@apollo/client/react';
import { deserializeFormSchema, FillableFormField, type FormSchema } from '@dculus/types';
import { useTranslation } from '../hooks/useTranslation';
import { Button, Input, Badge, LoadingSpinner, EmptyState, Tooltip, TooltipContent, TooltipTrigger, toastSuccess, toastError } from '@dculus/ui';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_PDF_GENERATORS } from '../graphql/pdfGenerators';
import { GET_AUTOMATION, UPDATE_AUTOMATION } from '../graphql/automations';
import { AlertCircle, ArrowLeft, History, Pencil } from 'lucide-react';
import { AutomationCanvas } from '../components/automations/builder/AutomationCanvas';
import { useAutomationBuilderStore } from '../store/useAutomationBuilderStore';
import { FormPermissionProvider, type PermissionLevel } from '../contexts/FormPermissionContext';
import { useFormPermissions } from '../hooks/useFormPermissions';
import { useAutomationAutosave } from '../hooks/useAutomationAutosave';
import { SaveStatusIndicator } from '../components/automations/builder/SaveStatusIndicator';
import { IssuesPill } from '../components/automations/builder/IssuesPill';
import { PublishControls } from '../components/automations/builder/PublishControls';
import { DraftConflictBanner } from '../components/automations/builder/DraftConflictBanner';
import { formatRelativeTime } from '../components/automations/relativeTime';
import { isIntentionalNavigationPending } from '../lib/intentionalNavigation';
import { CombinedGraphQLErrors } from '@apollo/client';

/** Longest Back/leave will wait for a pending autosave before moving on (the edit stays on this device). */
const LEAVE_FLUSH_TIMEOUT_MS = 3000;

function getErrorMessage(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) return error.message;
  if (error instanceof Error) return error.message;
  // Covers error-like values that aren't real Error instances — e.g. a plain object crossing a
  // serialization boundary ({ name: 'NetworkError', message: '...' }) — so its message isn't
  // lost behind a useless "[object Object]" from the String(error) fallback below.
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return String(error);
}

const AutomationBuilderContent: React.FC<{ form: any; automation: any }> = ({ form, automation }) => {
  const { t, locale } = useTranslation('automations');
  const navigate = useNavigate();
  const client = useApolloClient();
  const { canEdit } = useFormPermissions();

  const automationId = automation.id;
  const formId = form.id;

  const loadGraph = useAutomationBuilderStore((s) => s.loadGraph);
  const setPdfGenerators = useAutomationBuilderStore((s) => s.setPdfGenerators);
  const hasUnpublishedChanges = useAutomationBuilderStore((s) => s.hasUnpublishedChanges);
  const structuralErrors = useAutomationBuilderStore((s) => s.structuralErrors);
  const discardDraft = useAutomationBuilderStore((s) => s.discardDraft);

  // Fillable fields for the condition rule editor's field picker (#200) — same extraction
  // pattern Responses.tsx uses for its filter panel.
  const formFields = useMemo(() => {
    if (!form.formSchema) return [];
    const formSchema: FormSchema = deserializeFormSchema(form.formSchema);
    const fields: FillableFormField[] = [];
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field instanceof FillableFormField && !field.deleted) fields.push(field);
      });
    });
    return fields;
  }, [form.formSchema]);

  // Enabled PDF generators for this form (#347 review) — powers the digest filter editor's
  // per-generator "Has PDF: <name>" meta fields, same extraction pattern Responses.tsx uses.
  const { data: pdfGeneratorsData, error: pdfGeneratorsError } = useQuery(GET_PDF_GENERATORS, {
    variables: { formId },
    skip: !formId,
  });
  const pdfGenerators = useMemo(
    () =>
      (pdfGeneratorsData?.pdfGenerators ?? [])
        .filter((g: any) => g.enabled)
        .map((g: any) => ({ id: g.id, name: g.name })),
    [pdfGeneratorsData]
  );

  // Kept independent of the once-per-automationId loadGraph effect below — GET_PDF_GENERATORS
  // has its own loading/error lifecycle, so tying it to that one-time load would either block
  // the graph from ever loading on a query error, or (if only gated on `loading`) permanently
  // commit an empty list with no way for a later successful refetch to update it (#347 review).
  // Only commits on an actual successful result, so a transient error leaves whatever
  // generators list is already in the store untouched rather than clearing it.
  useEffect(() => {
    if (pdfGeneratorsData && !pdfGeneratorsError) setPdfGenerators(pdfGenerators);
  }, [pdfGenerators, pdfGeneratorsData, pdfGeneratorsError, setPdfGenerators]);

  // Resets immediately on a form change (distinct from the automation-scoped resets above —
  // this global store can in principle be reused across forms without a full remount, e.g.
  // browser back/forward between two different forms' automation builders). Without this, a
  // slow or failed GET_PDF_GENERATORS request for the new form could leave the PREVIOUS
  // form's generator list sitting in the store, which the digest editor would then offer as
  // if it belonged to the current form (#347 review). The success effect above repopulates
  // it correctly as soon as the new form's query resolves.
  useEffect(() => {
    setPdfGenerators([]);
  }, [formId, setPdfGenerators]);

  // Loads a server snapshot into the builder. The builder works on the autosaved draft when one
  // exists, so what an editor sees is what they last left — but viewers get no draft from the
  // server and so see exactly what runs.
  const loadFromServer = useCallback(
    (source: any) => {
      loadGraph({
        automationId,
        formTitle: form.title,
        formFields,
        quizEnabled: !!form.settings?.quiz?.enabled,
        triggerType: automation.triggerType,
        triggerConfig: source.draftTriggerConfig ?? source.triggerConfig,
        graph: source.draftGraph ?? source.graph,
        isReadOnly: !canEdit,
        draftRevision: source.draftRevision ?? 0,
        hasUnpublishedChanges: !!source.hasUnpublishedChanges,
      });
    },
    [automationId, automation.triggerType, form.title, form.settings?.quiz?.enabled, formFields, canEdit, loadGraph]
  );

  // Only (re)load the graph into the store when the automation actually changes — the cache
  // updates `automation` after every autosave/Publish mutation (same id), and re-running loadGraph
  // then would stomp on in-progress local edits with what we just persisted.
  const loadedAutomationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadedAutomationIdRef.current === automationId) return;
    loadedAutomationIdRef.current = automationId;
    loadFromServer(automation);
  }, [automationId, automation, loadFromServer]);

  const { flush, retry, overwriteWithMine } = useAutomationAutosave({ enabled: canEdit });

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(automation.name);
  useEffect(() => {
    setNameDraft(automation.name);
  }, [automation.name]);

  const [renameAutomation, { loading: isRenaming }] = useMutation(UPDATE_AUTOMATION);

  const handleCommitName = async () => {
    setIsEditingName(false);
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === automation.name) {
      setNameDraft(automation.name);
      return;
    }
    try {
      const result = await renameAutomation({ variables: { id: automationId, name: trimmed } });
      if (result.error) throw result.error;
      toastSuccess(t('toasts.renamedTitle'), t('toasts.renamedMessage', { values: { name: trimmed } }));
    } catch (error: unknown) {
      setNameDraft(automation.name);
      toastError(t('toasts.renameErrorTitle'), getErrorMessage(error));
    }
  };

  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issuesBlockingPublish, setIssuesBlockingPublish] = useState(false);
  const openBlockingIssues = () => {
    setIssuesBlockingPublish(true);
    setIssuesOpen(true);
  };

  // Another editor (or another tab) saved since this tab last synced. "Load latest" refetches and
  // replaces the builder with the server draft; "Keep my version" re-saves over it.
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const handleLoadLatest = async () => {
    setIsResolvingConflict(true);
    try {
      const { data, error } = await client.query({ query: GET_AUTOMATION, variables: { id: automationId }, fetchPolicy: 'network-only' });
      if (error || !data?.automation) throw error ?? new Error('Automation not found');
      discardDraft();
      loadFromServer(data.automation);
    } catch (error: unknown) {
      toastError(t('builder.conflict.loadErrorTitle'), getErrorMessage(error));
    } finally {
      setIsResolvingConflict(false);
    }
  };
  const handleKeepMine = async () => {
    // Nothing of mine to keep (the conflict came from a publish) — just take the latest.
    if (!useAutomationBuilderStore.getState().isDirty) return handleLoadLatest();
    setIsResolvingConflict(true);
    try {
      await overwriteWithMine();
    } finally {
      setIsResolvingConflict(false);
    }
  };

  // Warn on tab close/refresh only while edits are not yet on the server. Once autosave has
  // acknowledged them there is nothing to lose, so the common case closes silently. Skipped when
  // the navigation is one the app itself intentionally triggered and already knows is safe —
  // e.g. the Google/Microsoft Sheets "Connect" buttons redirect this same tab to the OAuth
  // provider, and the unsynced edits are already mirrored to sessionStorage (see
  // draftStorage.ts) — without this check the browser's native "leave site?" prompt intercepts
  // that redirect before the user ever reaches the sign-in page.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!useAutomationBuilderStore.getState().isDirty || isIntentionalNavigationPending()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Cmd/Ctrl+S: there is no Save button any more, but people press it anyway — flush instead of
  // letting the browser open its "save page" dialog.
  useEffect(() => {
    if (!canEdit) return undefined;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void flush();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canEdit, flush]);

  const handleBack = async () => {
    if (useAutomationBuilderStore.getState().isDirty) {
      const saved = await Promise.race([
        flush(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), LEAVE_FLUSH_TIMEOUT_MS)),
      ]);
      // The edit is still mirrored in sessionStorage and re-sent from there on return.
      if (!saved) toastError(t('builder.header.saveErrorTitle'), t('builder.header.leaveSaveFailed'));
    }
    navigate(`/dashboard/form/${formId}/builder/automations`);
  };

  const isNeverPublished = automation.status === 'DRAFT';
  const showUnpublishedChip = hasUnpublishedChanges && !isNeverPublished;
  const isActive = automation.status === 'ACTIVE';

  return (
    <div className="flex flex-col h-full min-h-[520px]">
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
            {!isNeverPublished && ` · ${t('card.version', { values: { version: automation.version } })}`}
          </Badge>
          {showUnpublishedChip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: 'rgba(190,153,58,0.08)', color: '#9c7818', border: '1px solid rgba(190,153,58,0.16)' }}
                  data-testid="automation-unpublished-chip"
                >
                  {t('builder.header.unpublishedChip')}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {automation.draftUpdatedAt
                  ? t('builder.header.unpublishedTooltip', {
                      values: {
                        time: formatRelativeTime(automation.draftUpdatedAt, locale),
                        name: automation.draftUpdatedBy?.name ?? t('card.meta.unknownEditor'),
                        version: automation.version,
                      },
                    })
                  : t('builder.header.unpublishedTooltipGeneric', { values: { version: automation.version } })}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {canEdit && <SaveStatusIndicator onRetry={() => void retry()} />}
          {canEdit && (
            <IssuesPill
              open={issuesOpen}
              onOpenChange={(open) => {
                setIssuesOpen(open);
                if (!open) setIssuesBlockingPublish(false);
              }}
              blockingPublish={issuesBlockingPublish}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(`/dashboard/form/${formId}/builder/automations/${automationId}/runs`)}
          >
            <History className="h-3.5 w-3.5" />
            {t('builder.header.runsButton')}
          </Button>
          {canEdit && (
            <PublishControls
              automation={automation}
              flush={flush}
              onDiscarded={(restored) => {
                discardDraft();
                loadFromServer(restored);
              }}
              onBlockedByIssues={openBlockingIssues}
            />
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="text-xs text-muted-foreground px-1 pb-2" data-testid="automation-builder-readonly-notice">
          {t('builder.readOnlyNotice')}
          {automation.hasUnpublishedChanges && ` ${t('builder.readOnlyDraftNotice')}`}
        </p>
      )}

      {canEdit && <DraftConflictBanner onLoadLatest={handleLoadLatest} onKeepMine={handleKeepMine} busy={isResolvingConflict} />}

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
    // This tab remounts on every visit (CollaborativeFormBuilder's tab switch is a full
    // element swap, not a visibility toggle), but Apollo's default cache-first policy would
    // still serve whatever the Content tab's own GET_FORM_BY_ID fetched at page load — so
    // field edits (required toggle, label, options, ...) made after that never show up here.
    // cache-and-network shows the cached form immediately, then revalidates from the server.
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: automationData,
    loading: automationLoading,
    error: automationError,
  } = useQuery(GET_AUTOMATION, {
    variables: { id: automationId },
    skip: !automationId,
    // The builder seeds itself from `draftGraph`; a cached copy from an earlier visit (or from a
    // draft this session has since discarded/published) would silently resurrect stale edits.
    fetchPolicy: 'network-only',
  });

  const form = formData?.form;
  const automation = automationData?.automation;

  if (formLoading || automationLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner fullScreen={false} />
      </div>
    );
  }

  if (automationError || !automation || !form) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.automationNotFound.title')}
          description={t('errors.automationNotFound.description')}
        />
      </div>
    );
  }

  const userPermission = (form.userPermission as PermissionLevel) || 'VIEWER';

  return (
    <div className="h-full p-4">
      <FormPermissionProvider userPermission={userPermission}>
        <AutomationBuilderContent form={form} automation={automation} />
      </FormPermissionProvider>
    </div>
  );
};

export default AutomationBuilder;
