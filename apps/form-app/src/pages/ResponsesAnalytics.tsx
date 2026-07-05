import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from '../hooks/useTranslation';
import { Button, LoadingSpinner, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { useFormAnalytics } from '../hooks/useFormAnalytics';
import { AlertCircle, ArrowLeft, BarChart3, PieChart } from 'lucide-react';

const formatTime = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

const ResponsesAnalytics: React.FC = () => {
  const { t } = useTranslation('responsesAnalytics');
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const navigate = useNavigate();
  const actualFormId = formId || id;

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

  const { submissionAnalyticsData, submissionConversionRate } = useFormAnalytics({
    formId: actualFormId || '',
    initialTimeRange: '30d',
  });

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
            <div className="h-52 flex flex-col items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--tf-faint)' }}>
              <PieChart className="h-10 w-10 mb-2 text-[var(--tf-icon-gray)]" />
              <p className="text-sm font-medium text-muted-foreground">{t('charts.fieldAnalytics.title')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--tf-muted)', opacity: 0.7 }}>{t('charts.fieldAnalytics.comingSoon')}</p>
            </div>
          </ChartCard>
        </div>

        {/* Summary stats */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          <h3 className="text-sm font-semibold mb-4 text-primary">{t('charts.responseSummary.title')}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { value: submissionAnalyticsData?.totalSubmissions ?? form.responseCount, label: t('charts.responseSummary.totalSubmissions'), bg: 'var(--tf-icon-teal)', color: 'var(--tf-green)' },
              { value: submissionAnalyticsData ? `${submissionConversionRate}%` : '—', label: t('charts.responseSummary.completionRate'), bg: 'var(--tf-icon-lavender)', color: '#5c2e6b' },
              { value: formatTime(submissionAnalyticsData?.averageCompletionTime ?? null), label: t('charts.responseSummary.avgTimeToComplete'), bg: '#fbe19d', color: '#8b6a18' },
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
