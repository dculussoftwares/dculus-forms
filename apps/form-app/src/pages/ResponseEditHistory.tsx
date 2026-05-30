import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { useTranslation } from '../hooks/useTranslation';
import { GET_FORM_BY_ID, GET_RESPONSE_BY_ID } from '../graphql/queries';
import { useResponseEditHistory } from '../hooks/useResponseEditHistory';
import { Alert, AlertDescription, Button, LoadingSpinner, EmptyState } from '@dculus/ui';
import {
  ArrowLeft,
  History,
  Edit3,
  Clock,
  AlertCircle
} from 'lucide-react';
import { EditHistoryTimeline } from '../components/response-history/EditHistoryTimeline';
import { MainLayout } from '../components/MainLayout';

// Helper function to safely format dates
const safeFormatDate = (dateString: string | null | undefined, formatString: string, fallback = 'Unknown date'): string => {
  if (!dateString) return fallback;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? fallback : format(date, formatString);
};

export const ResponseEditHistory: React.FC = () => {
  const { t } = useTranslation('responseEditHistory');
  const { formId, responseId } = useParams<{
    formId: string;
    responseId: string;
  }>();
  const navigate = useNavigate();

  // const [selectedEditId, setSelectedEditId] = useState<string | null>(null);

  // Fetch form data
  const { data: formData, loading: formLoading } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId
  });

  // Fetch response data
  const { data: responseData, loading: responseLoading } = useQuery(GET_RESPONSE_BY_ID, {
    variables: { id: responseId },
    skip: !responseId
  });

  // Fetch edit history
  const {
    editHistory,
    isLoadingHistory,
    historyError
  } = useResponseEditHistory({
    responseId: responseId!,
    enabled: !!responseId
  });

  const form = formData?.form;
  const response = responseData?.response;
  const isLoading = formLoading || responseLoading || isLoadingHistory;

  const handleGoToEdit = () => {
    if (formId && responseId) {
      navigate(`/dashboard/form/${formId}/responses/${responseId}/edit`);
    }
  };

  const handleGoToTable = () => {
    if (formId) {
      navigate(`/dashboard/form/${formId}/responses`);
    }
  };

  if (isLoading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${formId}/responses` },
          { label: t('layout.breadcrumbs.editHistory'), href: `/dashboard/form/${formId}/responses/${responseId}/history` },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (!form || !response) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${formId}/responses` },
          { label: t('layout.breadcrumbs.editHistory'), href: `/dashboard/form/${formId}/responses/${responseId}/history` },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.notFound.title')}
          description={t('errors.notFound.description')}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${formId}/responses` },
        { label: t('layout.breadcrumbs.editHistory'), href: `/dashboard/form/${formId}/responses/${responseId}/history` },
      ]}
    >
      <div className="flex flex-col h-full w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--tf-border-medium)' }}>
          <Button
            onClick={handleGoToTable}
            variant="ghost"
            className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'var(--tf-border)' }} />
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
            <History className="h-4 w-4 text-[#5c2e6b]" />
          </div>
          <h1 className="text-sm font-semibold truncate flex-1 text-primary">{t('header.title')}</h1>
          <Button
            onClick={handleGoToEdit}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium shrink-0"
          >
            <Edit3 className="h-3.5 w-3.5" />
            {t('header.editResponse')}
          </Button>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden space-y-6 p-6">

          {/* Response Info */}
          <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
            <h3 className="text-sm font-semibold mb-4 text-primary">{t('responseInfo.title')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: t('responseInfo.responseId'), value: <span className="font-mono text-xs">{responseId}</span> },
                { label: t('responseInfo.submitted'), value: safeFormatDate(response.submittedAt, "MMM dd, yyyy 'at' h:mm a") },
                {
                  label: t('responseInfo.totalEdits'),
                  value: (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#f6fafd', color: '#01487f', border: '1px solid rgb(189,221,249)' }}>
                      {editHistory.length === 1 ? t('responseInfo.editsCount', { values: { count: editHistory.length } }) : t('responseInfo.editsCountPlural', { values: { count: editHistory.length } })}
                    </span>
                  )
                },
              ].map(({ label, value }) => (
                <div key={label as string}>
                  <p className="text-xs font-medium mb-1 text-muted-foreground">{label}</p>
                  <p className="text-sm text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Error States */}
          {historyError && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('errors.historyLoadError')}
              </AlertDescription>
            </Alert>
          )}

          {/* Edit History Timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">
                {t('timeline.title', { values: { count: editHistory.length, editText: editHistory.length === 1 ? t('timeline.editSingular') : t('timeline.editPlural') } })}
              </h2>

              {editHistory.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t('timeline.lastEdited', { values: { date: safeFormatDate(editHistory[0].editedAt, 'MMM dd, yyyy', 'unknown date') } })}
                </div>
              )}
            </div>

            <EditHistoryTimeline
              editHistory={editHistory}
              isLoading={isLoadingHistory}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};