import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {
  Button,
  Card,
  CardContent,
  LoadingSpinner,
  TypographyH1,
  TypographyH3,
  TypographyP,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import {
  AlertCircle,
  ArrowLeft,
  Puzzle,
  Webhook,
  Mail,
  Database,
  Zap,
  Cloud,
  Lock,
} from 'lucide-react';

const FormPlugins: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  if (formLoading) {
    return (
      <MainLayout
        title="Plugins"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
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
        title="Plugins"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <TypographyH3 className="mb-2">Form Not Found</TypographyH3>
            <TypographyP className="text-slate-600">
              The form you're looking for doesn't exist or you don't have
              permission to view it.
            </TypographyP>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;

  const upcomingPlugins = [
    {
      name: 'Webhooks',
      description: 'Send form submissions to external APIs in real-time',
      icon: Webhook,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Email Notifications',
      description: 'Automated email alerts for new form submissions',
      icon: Mail,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Database Integration',
      description: 'Connect to external databases and sync data',
      icon: Database,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'Zapier Integration',
      description: 'Connect with 5000+ apps through Zapier',
      icon: Zap,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      name: 'Cloud Storage',
      description: 'Automatically save file uploads to cloud storage',
      icon: Cloud,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      name: 'OAuth Providers',
      description: 'Enable social login and authentication',
      icon: Lock,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <MainLayout
      title={`${form.title} - Plugins`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
      ]}
    >
      <div className="px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col space-y-4">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/dashboard/form/${formId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Button>
            </div>
            <TypographyH1 className="mb-2 flex items-center">
              <Puzzle className="mr-3 h-8 w-8 text-orange-600" />
              Plugins & Integrations
            </TypographyH1>
            <TypographyP className="text-slate-600">
              Extend "{form.title}" with powerful integrations and automations
            </TypographyP>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <Card className="border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Puzzle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Coming Soon
                </h3>
                <p className="text-slate-700 mb-4">
                  We're building a powerful plugin ecosystem to help you connect your forms
                  with the tools you already use. Soon you'll be able to automate workflows,
                  integrate with external services, and extend your forms with custom functionality.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-orange-700 border border-orange-200">
                    In Development
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200">
                    Q2 2025
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Plugins Grid */}
        <div>
          <TypographyH3 className="mb-4">Planned Integrations</TypographyH3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingPlugins.map((plugin) => {
              const Icon = plugin.icon;
              return (
                <Card
                  key={plugin.name}
                  className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] opacity-75"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <div className={`${plugin.bgColor} p-2 rounded-lg`}>
                        <Icon className={`h-5 w-5 ${plugin.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 mb-1">
                          {plugin.name}
                        </h4>
                        <p className="text-sm text-slate-600">
                          {plugin.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Feature Request CTA */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Have a plugin idea?
              </h3>
              <p className="text-slate-600 mb-4">
                We'd love to hear your suggestions for integrations and plugins you'd like to see.
              </p>
              <Button variant="outline" size="sm">
                Request a Plugin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default FormPlugins;
