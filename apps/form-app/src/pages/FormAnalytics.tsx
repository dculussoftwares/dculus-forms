import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { 
  Card, 
  LoadingSpinner,
  Button
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { AlertCircle, BarChart3, Download, ExternalLink } from 'lucide-react';
import { useFormAnalytics } from '../hooks/useFormAnalytics';
import { TimeRangeSelector } from '../components/Analytics/TimeRangeSelector';
import { AnalyticsOverview } from '../components/Analytics/AnalyticsOverview';
import { GeographicChart } from '../components/Analytics/GeographicChart';
import { BrowserOSCharts } from '../components/Analytics/BrowserOSCharts';
import { ViewsOverTimeChart } from '../components/Analytics/ViewsOverTimeChart';

const FormAnalytics: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  
  const { data, loading, error } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const {
    analyticsData,
    loading: analyticsLoading,
    error: analyticsError,
    timeRangePreset,
    customTimeRange,
    updateTimeRange,
    refreshData,
    conversionRate,
    topCountry,
    topBrowser,
    hasData,
    isEmpty,
    isAuthenticated
  } = useFormAnalytics({ 
    formId: formId || '', 
    initialTimeRange: '30d' 
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

  const handleViewForm = () => {
    const formViewerUrl = `http://localhost:5173/f/${form.shortUrl}`;
    window.open(formViewerUrl, '_blank');
  };

  const handleExportReport = () => {
    // TODO: Implement export functionality
    console.log('Export report for form:', formId);
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
              Detailed insights and reports for <span className="font-medium">{form.title}</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <TimeRangeSelector
              value={timeRangePreset}
              customRange={customTimeRange}
              onChange={updateTimeRange}
              onRefresh={refreshData}
              loading={analyticsLoading}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportReport}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" size="sm" onClick={handleViewForm}>
                <ExternalLink className="w-4 h-4 mr-2" />
                View Form
              </Button>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <AnalyticsOverview
          data={analyticsData}
          conversionRate={conversionRate}
          topCountry={topCountry}
          topBrowser={topBrowser}
          loading={analyticsLoading}
        />

        {/* Charts Section */}
        {analyticsError && (
          <Card className="p-8 border-red-200">
            <div className="text-center text-red-600">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Unable to Load Analytics</h3>
              <p className="text-sm">
                {analyticsError.message || 'There was an error loading the analytics data.'}
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
                You need to be logged in to view form analytics. Please sign in to access detailed insights about your form's performance.
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
                Your form analytics will appear here once visitors start accessing your form. 
                Share your form to start collecting valuable insights about your audience.
              </p>
              <div className="mt-6">
                <Button onClick={handleViewForm}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Your Form
                </Button>
              </div>
              
              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Privacy First:</strong> Our analytics system is designed with privacy in mind. 
                  We collect only anonymous data without storing personal information or IP addresses.
                </p>
              </div>
            </div>
          </Card>
        )}

        {!analyticsError && isAuthenticated && hasData && (
          <>
            {/* Views Over Time Chart */}
            <ViewsOverTimeChart
              data={analyticsData?.viewsOverTime || []}
              loading={analyticsLoading}
              timeRange={timeRangePreset}
            />

            {/* Geographic Distribution */}
            <GeographicChart
              data={analyticsData?.topCountries || []}
              totalViews={analyticsData?.totalViews || 0}
              loading={analyticsLoading}
            />

            {/* Browser and OS Charts */}
            <BrowserOSCharts
              osData={analyticsData?.topOperatingSystems || []}
              browserData={analyticsData?.topBrowsers || []}
              loading={analyticsLoading}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default FormAnalytics;