import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { useTranslation } from '../hooks/useTranslation';
import { GET_FORM_BY_ID, GET_RESPONSE_BY_ID } from '../graphql/queries';
import { useResponseEditHistory } from '../hooks/useResponseEditHistory';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Alert,
  AlertDescription,
  LoadingSpinner
} from '@dculus/ui';
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

  const handleViewSnapshot = (editId: string) => {
    // Could open a modal or navigate to a detailed view in the future
    console.log('View snapshot for edit:', editId);
  };

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
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-sm border border-slate-200/60">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">{t('errors.notFound.title')}</h3>
            <p className="text-slate-600">
              {t('errors.notFound.description')}
            </p>
          </div>
        </div>
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
        {/* Compact Header */}
        <div className="flex items-center gap-4 p-3 border-b border-slate-200/40 bg-white flex-shrink-0 w-full overflow-hidden rounded-t-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoToTable}
            className="hover:bg-slate-100 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('navigation.backToResponses')}
          </Button>
          <div className="h-4 w-px bg-slate-300 flex-shrink-0" />
          <div className="flex items-center space-x-2 flex-1">
            <History className="h-5 w-5 text-slate-600" />
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              {t('header.title')}
            </h1>
          </div>
          <Button onClick={handleGoToEdit} className="flex-shrink-0">
            <Edit3 className="h-4 w-4 mr-2" />
            {t('header.editResponse')}
          </Button>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden space-y-6 p-6">

          {/* Response Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('responseInfo.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-500">{t('responseInfo.responseId')}</span>
                  <div className="font-mono text-xs text-gray-700 mt-1">
                    {responseId}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-500">{t('responseInfo.submitted')}</span>
                  <div className="text-gray-700 mt-1">
                    {safeFormatDate(response.submittedAt, 'MMM dd, yyyy \'at\' h:mm a')}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-500">{t('responseInfo.totalEdits')}</span>
                  <div className="text-gray-700 mt-1">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {editHistory.length === 1 ? t('responseInfo.editsCount', { values: { count: editHistory.length } }) : t('responseInfo.editsCountPlural', { values: { count: editHistory.length } })}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
              <h2 className="text-lg font-semibold text-gray-900">
                {t('timeline.title', { 
                  values: { 
                    count: editHistory.length,
                    editText: editHistory.length === 1 ? t('timeline.editSingular') : t('timeline.editPlural')
                  }
                })}
              </h2>

              {editHistory.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>
                    {t('timeline.lastEdited', { values: { date: safeFormatDate(editHistory[0].editedAt, 'MMM dd, yyyy', 'unknown date') } })}
                  </span>
                </div>
              )}
            </div>

            <EditHistoryTimeline
              editHistory={editHistory}
              onViewSnapshot={handleViewSnapshot}
              isLoading={isLoadingHistory}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};