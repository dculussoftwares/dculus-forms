import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import { Button, LoadingSpinner, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { AlertCircle, ArrowLeft, Eye, UserCheck } from 'lucide-react';

const ResponsesIndividual: React.FC = () => {
  const { t } = useTranslation('responsesIndividual');
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const navigate = useNavigate();
  const actualFormId = formId || id;

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

  const mockResponses = [
    { id: '1', submittedAt: '2024-01-15T10:30:00Z', data: { name: 'John Doe', email: 'john@example.com', message: 'Great form!' }, status: 'completed' },
    { id: '2', submittedAt: '2024-01-14T15:45:00Z', data: { name: 'Jane Smith', email: 'jane@example.com', message: 'Thanks for the service' }, status: 'completed' },
    { id: '3', submittedAt: '2024-01-13T09:15:00Z', data: { name: 'Bob Johnson', email: 'bob@example.com', message: 'Needs improvement' }, status: 'completed' },
  ];

  const formatDate = (s: string) => new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const breadcrumbs = [
    { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
    { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${actualFormId}` },
    { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${actualFormId}/responses` },
    { label: t('layout.breadcrumbs.individual') },
  ];

  if (formLoading) return <MainLayout title={t('layout.title')} breadcrumbs={breadcrumbs}><div className="flex justify-center items-center min-h-96"><LoadingSpinner /></div></MainLayout>;

  if (formError || !formData?.form) {
    return (
      <MainLayout title={t('layout.title')} breadcrumbs={breadcrumbs}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-[#ce5d55]" />}
          title={t('errors.formNotFound.title')}
          description={t('errors.formNotFound.description')}
        />
      </MainLayout>
    );
  }

  const form = formData.form;

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${actualFormId}` },
        { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${actualFormId}/responses` },
        { label: t('layout.breadcrumbs.individual') },
      ]}
    >
      <div className="space-y-5">
        {/* Back */}
        <Button
          variant="ghost"
          onClick={() => navigate(`/dashboard/form/${actualFormId}/responses`)}
          className="flex items-center gap-1.5 text-xs h-auto p-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('navigation.backToResponses')}
        </Button>

        {/* Response cards */}
        <div
          className="rounded-xl bg-white overflow-hidden"
          style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(81,76,84,0.08)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f8cdd8' }}>
              <UserCheck className="h-4 w-4 text-[#3c323e]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#3c323e]">{t('content.individualResponseDetails.title')}</h2>
              <p className="text-xs text-[#655d67]">{t('content.individualResponseDetails.description')}</p>
            </div>
          </div>

          {mockResponses.length === 0 ? (
            <EmptyState
              icon={<UserCheck className="h-6 w-6 text-[#dedcde]" />}
              title={t('content.emptyState.title')}
              description={t('content.emptyState.description')}
            />
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(81,76,84,0.08)' }}>
              {mockResponses.map((response) => (
                <div key={response.id} className="p-5">
                  {/* Response header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-[#3c323e]">
                        {t('content.response.responseNumber', { values: { id: response.id } })}
                      </p>
                      <p className="text-xs mt-0.5 text-[#655d67]">
                        {t('content.response.submittedOn', { values: { date: formatDate(response.submittedAt) } })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'rgba(23,119,103,0.08)', color: '#177767', border: '1px solid rgba(23,119,103,0.16)' }}
                      >
                        {response.status}
                      </span>
                      <Button
                        variant="outline"
                        className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('content.response.viewDetails')}
                      </Button>
                    </div>
                  </div>

                  {/* Response fields */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium mb-1 text-[#655d67]">{t('content.fields.name')}</p>
                      <p className="text-sm text-[#3c323e]">{response.data.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1 text-[#655d67]">{t('content.fields.email')}</p>
                      <p className="text-sm text-[#3c323e]">{response.data.email}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-medium mb-1.5 text-[#655d67]">{t('content.fields.message')}</p>
                    <p className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#f7f7f8', color: '#4c414e' }}>
                      {response.data.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ResponsesIndividual;
