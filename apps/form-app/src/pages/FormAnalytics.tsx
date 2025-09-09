import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { Button, Card, LoadingSpinner } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
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

const FormAnalytics: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get tab from URL, default to 'overview'
  const activeTab = (searchParams.get('tab') as 'overview' | 'fields') || 'overview';
  
  // Get selected field from URL for field analytics
  const selectedFieldId = searchParams.get('field') || null;

  const { data, loading, error } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const {
    analyticsData,
    submissionAnalyticsData,
    loading: analyticsLoading,
    error: analyticsError,
    timeRangePreset,
    customTimeRange,
    updateTimeRange,
    refreshData,
    conversionRate,
    submissionConversionRate,
    topCountry,
    topSubmissionCountry,
    hasData,
    isEmpty,
    isAuthenticated,
  } = useFormAnalytics({
    formId: formId || '',
    initialTimeRange: '30d',
  });

  if (loading) {
    return (
      <MainLayout
        title="Form Analytics"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Analytics', href: `/dashboard/form/${formId}/analytics` },
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
        title="Form Analytics"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Analytics', href: `/dashboard/form/${formId}/analytics` },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">Form Not Found</h3>
            <p className="text-slate-600">
              The form you're looking for doesn't exist or you don't have
              permission to view its analytics.
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = data.form;

  const setActiveTab = (tab: 'overview' | 'fields') => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', tab);
    // Clear field selection when switching to overview tab
    if (tab === 'overview') {
      newSearchParams.delete('field');
    }
    setSearchParams(newSearchParams);
  };

  const handleViewForm = () => {
    const formViewerUrl = `http://localhost:5173/f/${form.shortUrl}`;
    window.open(formViewerUrl, '_blank');
  };

  return (
    <MainLayout
      title={`${form.title} - Analytics`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: 'Analytics', href: `/dashboard/form/${formId}/analytics` },
      ]}
    >
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Form Analytics</h1>
            <p className="text-gray-600 mt-1">
              Detailed insights and reports for{' '}
              <span className="font-medium">{form.title}</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {activeTab === 'overview' && (
              <TimeRangeSelector
                value={timeRangePreset}
                customRange={customTimeRange}
                onChange={updateTimeRange}
                onRefresh={refreshData}
                loading={analyticsLoading}
              />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleViewForm}>
                <ExternalLink className="w-4 h-4 mr-2" />
                View Form
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Form Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab('fields')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'fields'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Field Insights
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' ? (
          <>
            {/* Overview Cards */}
            <AnalyticsOverview
              data={analyticsData}
              submissionData={submissionAnalyticsData}
              conversionRate={conversionRate}
              submissionConversionRate={submissionConversionRate}
              topCountry={topCountry}
              topSubmissionCountry={topSubmissionCountry}
              loading={analyticsLoading}
            />

            {/* Charts Section */}
            {analyticsError && (
              <Card className="p-8 border-red-200">
                <div className="text-center text-red-600">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Unable to Load Analytics
                  </h3>
                  <p className="text-sm">
                    {analyticsError.message ||
                      'There was an error loading the analytics data.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={refreshData}
                  >
                    Try Again
                  </Button>
                </div>
              </Card>
            )}

            {!isAuthenticated && (
              <Card className="p-8">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100">
                    <AlertCircle className="h-8 w-8 text-yellow-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    Authentication Required
                  </h3>
                  <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
                    You need to be logged in to view form analytics. Please sign
                    in to access detailed insights about your form's
                    performance.
                  </p>
                </div>
              </Card>
            )}

            {!analyticsError && isAuthenticated && isEmpty && (
              <Card className="p-8">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    No Analytics Data Yet
                  </h3>
                  <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
                    Your form analytics will appear here once visitors start
                    accessing your form. Share your form to start collecting
                    valuable insights about your audience.
                  </p>
                  <div className="mt-6">
                    <Button onClick={handleViewForm}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Your Form
                    </Button>
                  </div>

                  <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Privacy First:</strong> Our analytics system is
                      designed with privacy in mind. We collect only anonymous
                      data without storing personal information or IP addresses.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!analyticsError && isAuthenticated && hasData && (
              <>
                {/* Views & Submissions Over Time Chart */}
                <ViewsOverTimeChart
                  data={analyticsData?.viewsOverTime || []}
                  submissionData={
                    submissionAnalyticsData?.submissionsOverTime || []
                  }
                  loading={analyticsLoading}
                  timeRange={timeRangePreset}
                />

                {/* Geographic Distribution */}
                <GeographicChart
                  data={analyticsData?.topCountries || []}
                  submissionData={submissionAnalyticsData?.topCountries || []}
                  totalViews={analyticsData?.totalViews || 0}
                  totalSubmissions={
                    submissionAnalyticsData?.totalSubmissions || 0
                  }
                  loading={analyticsLoading}
                />

                {/* Browser and OS Charts */}
                <BrowserOSCharts
                  osData={analyticsData?.topOperatingSystems || []}
                  browserData={analyticsData?.topBrowsers || []}
                  osSubmissionData={
                    submissionAnalyticsData?.topOperatingSystems || []
                  }
                  browserSubmissionData={
                    submissionAnalyticsData?.topBrowsers || []
                  }
                  loading={analyticsLoading}
                />

                {/* Completion Time Statistics */}
                <CompletionTimePercentiles
                  data={
                    submissionAnalyticsData?.completionTimePercentiles || null
                  }
                  averageTime={
                    submissionAnalyticsData?.averageCompletionTime || null
                  }
                  loading={analyticsLoading}
                />

                {/* Completion Time Distribution */}
                <CompletionTimeChart
                  data={
                    submissionAnalyticsData?.completionTimeDistribution || []
                  }
                  loading={analyticsLoading}
                />
              </>
            )}
          </>
        ) : (
          <FieldAnalyticsViewer 
            formId={formId || ''} 
            initialSelectedFieldId={selectedFieldId}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default FormAnalytics;