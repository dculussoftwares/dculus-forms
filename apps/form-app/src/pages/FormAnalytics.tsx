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
import { AlertCircle, BarChart3, Globe, Monitor, Users } from 'lucide-react';

const FormAnalytics: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  
  const { data, loading, error } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Form Analytics</h1>
            <p className="text-gray-600 mt-1">
              Detailed insights and reports for <span className="font-medium">{form.title}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="sm">
              <Globe className="w-4 h-4 mr-2" />
              View Form
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">--</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Coming soon: Real-time view tracking
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unique Sessions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">--</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Monitor className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Anonymous session tracking
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Country</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">--</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Globe className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Geographic visitor data
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Browser</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">--</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Browser usage statistics
            </p>
          </Card>
        </div>

        {/* Coming Soon Section */}
        <Card className="p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Comprehensive Analytics Dashboard
            </h3>
            <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
              We're building a powerful analytics system that will provide detailed insights about your form visitors, 
              including geographic distribution, device types, browser usage, and viewing patterns.
            </p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Globe className="h-5 w-5 text-blue-600 mr-2" />
                  <h4 className="font-medium text-gray-900">Geographic Insights</h4>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Country-wise visitor distribution</li>
                  <li>• Regional viewing patterns</li>
                  <li>• Time zone analysis</li>
                </ul>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Monitor className="h-5 w-5 text-green-600 mr-2" />
                  <h4 className="font-medium text-gray-900">Technical Analytics</h4>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Operating system breakdown</li>
                  <li>• Browser usage statistics</li>
                  <li>• Device type analysis</li>
                </ul>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Users className="h-5 w-5 text-purple-600 mr-2" />
                  <h4 className="font-medium text-gray-900">Visitor Behavior</h4>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• View count tracking</li>
                  <li>• Session duration analysis</li>
                  <li>• Privacy-first design</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Privacy First:</strong> Our analytics system is designed with privacy in mind. 
                We collect only anonymous data without storing personal information or IP addresses.
              </p>
            </div>
          </div>
        </Card>

        {/* Technical Implementation Status */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Implementation Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-green-800">Database Schema</span>
              </div>
              <span className="text-xs text-green-600 font-medium">✓ Complete</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-green-800">Analytics Service</span>
              </div>
              <span className="text-xs text-green-600 font-medium">✓ Complete</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-green-800">Data Collection</span>
              </div>
              <span className="text-xs text-green-600 font-medium">✓ Complete</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-yellow-800">Dashboard Integration</span>
              </div>
              <span className="text-xs text-yellow-600 font-medium">⏳ In Progress</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-600">Visual Charts</span>
              </div>
              <span className="text-xs text-gray-500 font-medium">📋 Planned</span>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default FormAnalytics;