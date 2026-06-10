import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { Button, LoadingSpinner, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { useTranslation } from '../hooks/useTranslation';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { AlertCircle, BarChart3, ExternalLink, TrendingUp } from 'lucide-react';
import { useFormAnalytics } from '../hooks/useFormAnalytics';
import { TimeRangeSelector } from '../components/Analytics/TimeRangeSelector';
import { AnalyticsOverview } from '../components/Analytics/AnalyticsOverview';
import { GeographicChart } from '../components/Analytics/GeographicChart';
import { BrowserOSCharts } from '../components/Analytics/BrowserOSCharts';
import { ViewsOverTimeChart } from '../components/Analytics/ViewsOverTimeChart';
import { CompletionTimeChart } from '../components/Analytics/CompletionTimeChart';
import { CompletionTimePercentiles } from '../components/Analytics/CompletionTimePercentiles';
import { FieldAnalyticsViewer } from '../components/Analytics/FieldAnalytics/FieldAnalyticsViewer';
import { getFormViewerUrl } from '@/lib/config';

const FormAnalytics: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('formAnalytics');

  const activeTab = (searchParams.get('tab') as 'overview' | 'fields') || 'overview';
  const selectedFieldId = searchParams.get('field') || null;

  const { data, loading, error } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const {
    analyticsData, submissionAnalyticsData, loading: analyticsLoading,
    error: analyticsError, timeRangePreset, customTimeRange, updateTimeRange,
    refreshData, conversionRate, submissionConversionRate, topCountry,
    topSubmissionCountry, hasData, isEmpty, isAuthenticated,
  } = useFormAnalytics({ formId: formId || '', initialTimeRange: '30d' });

  if (loading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbFormDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbAnalytics') },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (error || !data?.form) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbFormDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbAnalytics') },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound')}
          description={t('errors.formNotFoundMessage')}
        />
      </MainLayout>
    );
  }

  const form = data.form;

  const setActiveTab = (tab: 'overview' | 'fields') => {
    const p = new URLSearchParams(searchParams);
    p.set('tab', tab);
    if (tab === 'overview') p.delete('field');
    setSearchParams(p);
  };

  const handleViewForm = () => window.open(getFormViewerUrl(form.shortUrl), '_blank');

  return (
    <MainLayout
      title={t('layout.titleWithForm', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbAnalytics') },
      ]}
    >
      <div className="space-y-5">

        {/* ── Top toolbar: tabs + time range + view form ── */}
        <div className="flex items-center justify-between gap-4">
          {/* Typeform underline tabs */}
          <div className="flex items-center" style={{ borderBottom: '1px solid var(--tf-border)' }}>
            {([
              { id: 'overview', icon: BarChart3, label: t('tabs.overview') },
              { id: 'fields', icon: TrendingUp, label: t('tabs.fields') },
            ] as const).map(({ id, icon: Icon, label }) => (
              <Button
                key={id}
                onClick={() => setActiveTab(id)}
                variant="ghost"
                className="relative flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-none"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {activeTab === id && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-t-full" style={{ backgroundColor: 'var(--tf-dark)' }} />
                )}
              </Button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {activeTab === 'overview' && (
              <TimeRangeSelector
                value={timeRangePreset}
                customRange={customTimeRange}
                onChange={updateTimeRange}
                onRefresh={refreshData}
                loading={analyticsLoading}
              />
            )}
            <Button
              onClick={handleViewForm}
              variant="outline"
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('header.viewFormButton')}
            </Button>
          </div>
        </div>

        {/* ── Tab content ── */}
        {activeTab === 'overview' ? (
          <>
            <AnalyticsOverview
              data={analyticsData}
              submissionData={submissionAnalyticsData}
              conversionRate={conversionRate}
              submissionConversionRate={submissionConversionRate}
              topCountry={topCountry}
              topSubmissionCountry={topSubmissionCountry}
              loading={analyticsLoading}
            />

            {analyticsError && (
              <div
                className="p-5 rounded-xl flex items-start gap-3"
                style={{ backgroundColor: 'var(--tf-error-bg)', border: '1px solid var(--tf-error-bg-lg)' }}
              >
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
                <div>
                  <h3 className="text-sm font-medium mb-1 text-primary">
                    {t('errors.unableToLoadAnalytics')}
                  </h3>
                  <p className="text-xs mb-3 text-muted-foreground">
                    {analyticsError.message || t('errors.analyticsLoadError')}
                  </p>
                  <Button
                    onClick={refreshData}
                    variant="outline"
                    className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium"
                  >
                    {t('errors.tryAgain')}
                  </Button>
                </div>
              </div>
            )}

            {!isAuthenticated && (
              <div
                className="p-6 rounded-xl text-center"
                style={{ backgroundColor: 'var(--tf-faint)', border: '1px solid var(--tf-border-medium)' }}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#fbe19d' }}>
                  <AlertCircle className="h-7 w-7 text-[#8b6a18]" />
                </div>
                <h3 className="text-sm font-semibold mb-1 text-primary">
                  {t('states.authenticationRequired')}
                </h3>
                <p className="text-xs max-w-md mx-auto text-muted-foreground">
                  {t('states.authenticationMessage')}
                </p>
              </div>
            )}

            {!analyticsError && isAuthenticated && isEmpty && (
              <div
                className="p-8 rounded-xl text-center"
                style={{ backgroundColor: 'var(--tf-faint)', border: '1px solid var(--tf-border-medium)' }}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
                  <BarChart3 className="h-7 w-7 text-[#5c2e6b]" />
                </div>
                <h3 className="text-sm font-semibold mb-1 text-primary">
                  {t('states.noDataYet')}
                </h3>
                <p className="text-xs max-w-md mx-auto mb-5 text-muted-foreground">
                  {t('states.noDataMessage')}
                </p>
                <Button
                  onClick={handleViewForm}
                  className="inline-flex items-center gap-1.5 h-8 px-4 text-xs font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t('states.viewYourForm')}
                </Button>
                <div
                  className="mt-5 p-3 rounded-lg text-xs"
                  style={{ backgroundColor: 'var(--tf-icon-teal)', color: 'var(--tf-green)' }}
                >
                  {t('states.privacyNotice')}
                </div>
              </div>
            )}

            {!analyticsError && isAuthenticated && hasData && (
              <>
                <ViewsOverTimeChart
                  data={analyticsData?.viewsOverTime || []}
                  submissionData={submissionAnalyticsData?.submissionsOverTime || []}
                  loading={analyticsLoading}
                  timeRange={timeRangePreset}
                />
                <GeographicChart
                  data={analyticsData?.topCountries || []}
                  submissionData={submissionAnalyticsData?.topCountries || []}
                  regionData={analyticsData?.topRegions || []}
                  regionSubmissionData={submissionAnalyticsData?.topRegions || []}
                  cityData={analyticsData?.topCities || []}
                  citySubmissionData={submissionAnalyticsData?.topCities || []}
                  totalViews={analyticsData?.totalViews || 0}
                  totalSubmissions={submissionAnalyticsData?.totalSubmissions || 0}
                  loading={analyticsLoading}
                />
                <BrowserOSCharts
                  osData={analyticsData?.topOperatingSystems || []}
                  browserData={analyticsData?.topBrowsers || []}
                  osSubmissionData={submissionAnalyticsData?.topOperatingSystems || []}
                  browserSubmissionData={submissionAnalyticsData?.topBrowsers || []}
                  loading={analyticsLoading}
                />
                <CompletionTimePercentiles
                  data={submissionAnalyticsData?.completionTimePercentiles || null}
                  averageTime={submissionAnalyticsData?.averageCompletionTime || null}
                  loading={analyticsLoading}
                />
                <CompletionTimeChart
                  data={submissionAnalyticsData?.completionTimeDistribution || []}
                  loading={analyticsLoading}
                />
              </>
            )}
          </>
        ) : (
          <FieldAnalyticsViewer
            formId={formId || ''}
            organizationId={form.organization?.id || ''}
            initialSelectedFieldId={selectedFieldId}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default FormAnalytics;
