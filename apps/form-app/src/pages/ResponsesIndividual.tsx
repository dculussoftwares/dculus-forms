import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LoadingSpinner,
  TypographyH3,
  TypographyP,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  UserCheck,
} from 'lucide-react';

const ResponsesIndividual: React.FC = () => {
  const { t } = useTranslation('responsesIndividual');
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const navigate = useNavigate();
  
  // Use formId if available, otherwise fall back to id for backward compatibility
  const actualFormId = formId || id;

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

  // Mock responses data - replace with actual GraphQL query later
  const mockResponses = [
    {
      id: '1',
      submittedAt: '2024-01-15T10:30:00Z',
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Great form!',
      },
      status: 'completed',
    },
    {
      id: '2',
      submittedAt: '2024-01-14T15:45:00Z',
      data: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        message: 'Thanks for the service',
      },
      status: 'completed',
    },
    {
      id: '3',
      submittedAt: '2024-01-13T09:15:00Z',
      data: {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        message: 'Needs improvement',
      },
      status: 'completed',
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (formLoading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${actualFormId}` },
          { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${actualFormId}/responses` },
          { label: t('layout.breadcrumbs.individual'), href: `/dashboard/form/${actualFormId}/responses/individual` },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || !formData?.form) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${actualFormId}` },
          { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${actualFormId}/responses` },
          { label: t('layout.breadcrumbs.individual'), href: `/dashboard/form/${actualFormId}/responses/individual` },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">{t('errors.formNotFound.title')}</h3>
            <p className="text-slate-600">
              {t('errors.formNotFound.description')}
            </p>
          </Card>
        </div>
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
        { label: t('layout.breadcrumbs.individual'), href: `/dashboard/form/${actualFormId}/responses/individual` },
      ]}
    >
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/form/${actualFormId}/responses`)}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('navigation.backToResponses')}
            </Button>
          </div>
        </div>

        {/* Individual Responses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {t('content.individualResponseDetails.title')}
            </CardTitle>
            <CardDescription>
              {t('content.individualResponseDetails.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mockResponses.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <TypographyH3 className="text-gray-900 mb-2">
                  {t('content.emptyState.title')}
                </TypographyH3>
                <TypographyP className="text-gray-600 mb-6">
                  {t('content.emptyState.description')}
                </TypographyP>
              </div>
            ) : (
              <div className="space-y-6">
                {mockResponses.map((response) => (
                  <Card
                    key={response.id}
                    className="border-l-4 border-l-blue-500"
                  >
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {t('content.response.responseNumber', { values: { id: response.id } })}
                          </CardTitle>
                          <CardDescription>
                            {t('content.response.submittedOn', { values: { date: formatDate(response.submittedAt) } })}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {response.status}
                          </span>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            {t('content.response.viewDetails')}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="text-sm font-medium text-gray-500">
                              {t('content.fields.name')}
                            </label>
                            <p className="mt-1 text-sm text-gray-900">
                              {response.data.name}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">
                              {t('content.fields.email')}
                            </label>
                            <p className="mt-1 text-sm text-gray-900">
                              {response.data.email}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            {t('content.fields.message')}
                          </label>
                          <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                            {response.data.message}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ResponsesIndividual;