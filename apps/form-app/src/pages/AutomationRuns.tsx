import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from '../hooks/useTranslation';
import {
  Badge,
  Button,
  LoadingSpinner,
  EmptyState,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_AUTOMATION, GET_AUTOMATION_RUNS } from '../graphql/automations';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FlaskConical, History, Loader2 } from 'lucide-react';
import { FormPermissionProvider, type PermissionLevel } from '../contexts/FormPermissionContext';
import { useFormPermissions } from '../hooks/useFormPermissions';
import { useTestAutomation } from '../hooks/useTestAutomation';
import { AutomationRunDetail } from '../components/automations/runs/AutomationRunDetail';
import { formatDuration, isRunActive, runStatusStyle } from '../components/automations/runs/runFormatting';

const PAGE_SIZE = 20;

const RunsContent: React.FC<{
  formId: string;
  automationId: string;
  automationName: string;
  hasResponses: boolean;
}> = ({ formId, automationId, automationName, hasResponses }) => {
  const { t, locale } = useTranslation('automations');
  const { canEdit } = useFormPermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [offset, setOffset] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const {
    data,
    loading,
    refetch,
    startPolling,
    stopPolling,
  } = useQuery(GET_AUTOMATION_RUNS, {
    variables: { automationId, limit: PAGE_SIZE + 1, offset },
    fetchPolicy: 'cache-and-network',
  });

  const allRuns = data?.automationRuns ?? [];
  const runs = allRuns.slice(0, PAGE_SIZE);
  const hasNextPage = allRuns.length > PAGE_SIZE;
  const hasPrevPage = offset > 0;
  const hasActiveRuns = runs.some((run: any) => isRunActive(run.status));

  useEffect(() => {
    if (hasActiveRuns) {
      startPolling(5000);
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [hasActiveRuns, startPolling, stopPolling]);

  // Deep-link support: opening from "Test automation" (list/builder) or a shared link.
  useEffect(() => {
    const runIdParam = searchParams.get('runId');
    if (runIdParam) {
      setSelectedRunId(runIdParam);
      setDetailOpen(true);
    }
  }, [searchParams]);

  const openRun = (runId: string) => {
    setSelectedRunId(runId);
    setDetailOpen(true);
  };

  const closeDetail = (open: boolean) => {
    setDetailOpen(open);
    if (!open && searchParams.has('runId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('runId');
      setSearchParams(next, { replace: true });
    }
  };

  const { runTest, isTesting } = useTestAutomation(formId, automationId);

  const handleTest = () =>
    runTest((runId) => {
      refetch();
      openRun(runId);
    });

  const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString(locale);

  return (
    <div className="space-y-5 max-w-4xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground -ml-2 mb-1"
            onClick={() => navigate(`/dashboard/form/${formId}/automations/${automationId}`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('runs.backButton')}
          </Button>
          <h1 className="text-lg font-semibold text-primary">{t('runs.title')}</h1>
          <p className="text-sm mt-1 text-muted-foreground">{automationName}</p>
        </div>

        {canEdit && (
          hasResponses ? (
            <Button onClick={handleTest} disabled={isTesting} data-testid="test-automation-button">
              {isTesting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-1.5 h-4 w-4" />}
              {t('builder.header.testButton')}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>
                    <FlaskConical className="mr-1.5 h-4 w-4" />
                    {t('builder.header.testButton')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('builder.header.testDisabledNoResponses')}</TooltipContent>
            </Tooltip>
          )
        )}
      </div>

      {loading && runs.length === 0 ? (
        <div className="flex justify-center items-center py-16">
          <LoadingSpinner />
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" style={{ color: '#3949ab' }} />}
          title={t('runs.empty.title')}
          description={t('runs.empty.description')}
        />
      ) : (
        <div
          className="rounded-xl bg-white dark:bg-card overflow-hidden"
          style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
        >
          <div
            className="grid gap-3 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            style={{ gridTemplateColumns: '110px 1fr 70px 160px 90px 70px', borderBottom: '1px solid var(--tf-border-light)' }}
          >
            <span>{t('runs.table.status')}</span>
            <span>{t('runs.table.trigger')}</span>
            <span>{t('runs.table.version')}</span>
            <span>{t('runs.table.started')}</span>
            <span>{t('runs.table.duration')}</span>
            <span className="text-right">{t('runs.table.actions')}</span>
          </div>

          {runs.map((run: any, i: number) => {
            const isTest = !!run.context?.test;
            const duration = formatDuration(run.startedAt, run.completedAt, t);
            return (
              <div
                key={run.id}
                className="grid gap-3 items-center px-5 py-3 text-sm cursor-pointer hover:bg-[rgba(87,84,91,0.03)]"
                style={{
                  gridTemplateColumns: '110px 1fr 70px 160px 90px 70px',
                  borderTop: i > 0 ? '1px solid var(--tf-border-light)' : undefined,
                }}
                onClick={() => openRun(run.id)}
              >
                <span className="flex items-center gap-1.5">
                  {isRunActive(run.status) && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={runStatusStyle(run.status)}>
                    {t(`runs.statuses.${run.status}`, { defaultValue: run.status })}
                  </span>
                </span>

                <span className="flex items-center gap-1.5 min-w-0">
                  {isTest && (
                    <Badge variant="accent" className="text-[10px] shrink-0">
                      {t('runs.testChip')}
                    </Badge>
                  )}
                  {run.responseId ? (
                    <Link
                      to={`/dashboard/form/${formId}/responses?responseId=${run.responseId}`}
                      className="text-primary hover:underline truncate inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('runs.responseLink')}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{t('runs.noResponse')}</span>
                  )}
                </span>

                <span className="text-muted-foreground">{t('card.version', { values: { version: run.automationVersion } })}</span>
                <span className="text-muted-foreground truncate">{formatTimestamp(run.startedAt)}</span>
                <span className="text-muted-foreground">
                  {duration ?? (isRunActive(run.status) ? t('runs.table.inProgress') : '—')}
                </span>
                <span className="text-right">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); openRun(run.id); }}>
                    {t('runs.viewButton')}
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(hasPrevPage || hasNextPage) && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={!hasPrevPage}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t('runs.pagination.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={!hasNextPage}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            {t('runs.pagination.next')}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <AutomationRunDetail
        open={detailOpen}
        onOpenChange={closeDetail}
        runId={selectedRunId}
        automationId={automationId}
      />
    </div>
  );
};

const AutomationRuns: React.FC = () => {
  const { formId, automationId } = useParams<{ formId: string; automationId: string }>();
  const { t } = useTranslation('automations');

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: automationData, loading: automationLoading, error: automationError } = useQuery(GET_AUTOMATION, {
    variables: { id: automationId },
    skip: !automationId,
  });

  const form = formData?.form;
  const automation = automationData?.automation;

  const breadcrumbs = [
    { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
    { label: form ? form.title : t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
    { label: t('layout.breadcrumbs.automations'), href: `/dashboard/form/${formId}/automations` },
    { label: automation ? automation.name : t('layout.breadcrumbs.builder'), href: `/dashboard/form/${formId}/automations/${automationId}` },
    { label: t('runs.breadcrumb') },
  ];

  if (formLoading || automationLoading) {
    return (
      <MainLayout title={t('runs.title')} breadcrumbs={breadcrumbs}>
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || automationError || !form || !automation) {
    return (
      <MainLayout title={t('runs.title')} breadcrumbs={breadcrumbs}>
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
    <MainLayout title={t('runs.dynamicTitle', { values: { name: automation.name } })} breadcrumbs={breadcrumbs}>
      <FormPermissionProvider userPermission={userPermission}>
        <RunsContent
          formId={formId!}
          automationId={automationId!}
          automationName={automation.name}
          hasResponses={(form.responseCount ?? 0) > 0}
        />
      </FormPermissionProvider>
    </MainLayout>
  );
};

export default AutomationRuns;
