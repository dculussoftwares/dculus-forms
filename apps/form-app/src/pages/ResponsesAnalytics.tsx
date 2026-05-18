import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import { Button, LoadingSpinner, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { AlertCircle, ArrowLeft, BarChart3, PieChart } from 'lucide-react';

const ResponsesAnalytics: React.FC = () => {
  const { t } = useTranslation('responsesAnalytics');
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const navigate = useNavigate();
  const actualFormId = formId || id;

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

  /* Mock data — replace with real query */
  const mockResponses = [
    { id: '1', submittedAt: '2024-01-15T10:30:00Z', data: { name: 'John Doe', email: 'john@example.com', message: 'Great form!' }, status: 'completed' },
    { id: '2', submittedAt: '2024-01-14T15:45:00Z', data: { name: 'Jane Smith', email: 'jane@example.com', message: 'Thanks for the service' }, status: 'completed' },
    { id: '3', submittedAt: '2024-01-13T09:15:00Z', data: { name: 'Bob Johnson', email: 'bob@example.com', message: 'Needs improvement' }, status: 'completed' },
  ];

  const breadcrumbs = [
    { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
    { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${actualFormId}` },
    { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${actualFormId}/responses` },
    { label: t('layout.breadcrumbs.analytics') },
  ];

  if (formLoading) return <MainLayout title={t('layout.title')} breadcrumbs={breadcrumbs}><div className="flex justify-center items-center min-h-96"><LoadingSpinner /></div></MainLayout>;

  if (formError || !formData?.form) {
    return (
      <MainLayout title={t('layout.title')} breadcrumbs={breadcrumbs}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound.title')}
          description={t('errors.formNotFound.description')}
        />
      </MainLayout>
    );
  }

  const form = formData.form;

  /* Reusable chart card */
  const ChartCard: React.FC<{ icon: React.ElementType; iconColor: string; iconBg: string; title: string; description: string; children: React.ReactNode }> = ({
    icon: Icon, iconColor, iconBg, title, description, children
  }) => (
    <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-primary">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${actualFormId}` },
        { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${actualFormId}/responses` },
        { label: t('layout.breadcrumbs.analytics') },
      ]}
    >
      <div className="space-y-5">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate(`/dashboard/form/${actualFormId}/responses`)}
          className="flex items-center gap-1.5 text-xs h-auto p-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('navigation.backToResponses')}
        </Button>

        {/* Charts grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard icon={BarChart3} iconBg="var(--tf-icon-teal)" iconColor="var(--tf-green)" title={t('charts.responseTrends.title')} description={t('charts.responseTrends.description')}>
            <div className="h-52 flex flex-col items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--tf-faint)' }}>
              <BarChart3 className="h-10 w-10 mb-2 text-[var(--tf-icon-gray)]" />
              <p className="text-sm font-medium text-muted-foreground">{t('charts.responseTrends.placeholder')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--tf-muted)', opacity: 0.7 }}>{t('charts.responseTrends.comingSoon')}</p>
            </div>
          </ChartCard>

          <ChartCard icon={PieChart} iconBg="var(--tf-icon-lavender)" iconColor="#5c2e6b" title={t('charts.fieldAnalytics.title')} description={t('charts.fieldAnalytics.description')}>
            <div className="space-y-3">
              {[
                { label: t('charts.fieldAnalytics.nameFieldCompletion'), pct: 100, color: 'var(--tf-green)' },
                { label: t('charts.fieldAnalytics.emailFieldCompletion'), pct: 100, color: 'var(--tf-green)' },
                { label: t('charts.fieldAnalytics.messageFieldCompletion'), pct: 85, color: '#a25fba' },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-medium text-primary">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--tf-faint)' }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* Summary stats */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          <h3 className="text-sm font-semibold mb-4 text-primary">{t('charts.responseSummary.title')}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { value: mockResponses.length, label: t('charts.responseSummary.totalSubmissions'), bg: 'var(--tf-icon-teal)', color: 'var(--tf-green)' },
              { value: '100%', label: t('charts.responseSummary.completionRate'), bg: 'var(--tf-icon-lavender)', color: '#5c2e6b' },
              { value: '2.5 min', label: t('charts.responseSummary.avgTimeToComplete'), bg: '#fbe19d', color: '#8b6a18' },
            ].map(({ value, label, bg, color }) => (
              <div key={label} className="p-4 rounded-xl" style={{ backgroundColor: bg }}>
                <p className="text-2xl font-light" style={{ color }}>{value}</p>
                <p className="text-xs mt-0.5 font-medium" style={{ color }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ResponsesAnalytics;
