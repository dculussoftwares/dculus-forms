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
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  PieChart,
} from 'lucide-react';

const ResponsesAnalytics: React.FC = () => {
  const { t } = useTranslation('responsesAnalytics');
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

  if (formLoading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${actualFormId}` },
          { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${actualFormId}/responses` },
          { label: t('layout.breadcrumbs.analytics'), href: `/dashboard/form/${actualFormId}/responses/analytics` },
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
          { label: t('layout.breadcrumbs.analytics'), href: `/dashboard/form/${actualFormId}/responses/analytics` },
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
        { label: t('layout.breadcrumbs.analytics'), href: `/dashboard/form/${actualFormId}/responses/analytics` },
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

        {/* Analytics Content */}
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('charts.responseTrends.title')}
                </CardTitle>
                <CardDescription>
                  {t('charts.responseTrends.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">{t('charts.responseTrends.placeholder')}</p>
                    <p className="text-sm text-gray-500">
                      {t('charts.responseTrends.comingSoon')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  {t('charts.fieldAnalytics.title')}
                </CardTitle>
                <CardDescription>
                  {t('charts.fieldAnalytics.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {t('charts.fieldAnalytics.nameFieldCompletion')}
                    </span>
                    <span className="text-sm font-semibold">100%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: '100%' }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {t('charts.fieldAnalytics.emailFieldCompletion')}
                    </span>
                    <span className="text-sm font-semibold">100%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: '100%' }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {t('charts.fieldAnalytics.messageFieldCompletion')}
                    </span>
                    <span className="text-sm font-semibold">85%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full"
                      style={{ width: '85%' }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('charts.responseSummary.title')}</CardTitle>
              <CardDescription>
                {t('charts.responseSummary.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {mockResponses.length}
                  </div>
                  <div className="text-sm text-blue-800">
                    {t('charts.responseSummary.totalSubmissions')}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    100%
                  </div>
                  <div className="text-sm text-green-800">
                    {t('charts.responseSummary.completionRate')}
                  </div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    2.5 min
                  </div>
                  <div className="text-sm text-orange-800">
                    {t('charts.responseSummary.avgTimeToComplete')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default ResponsesAnalytics;