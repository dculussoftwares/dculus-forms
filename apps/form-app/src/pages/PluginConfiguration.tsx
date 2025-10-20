import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import {
  Card,
  CardContent,
  LoadingSpinner,
  Button,
  toastSuccess,
  toastError
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import {
  GET_FORM_PLUGIN,
  CREATE_FORM_PLUGIN,
  UPDATE_FORM_PLUGIN
} from '../graphql/plugins';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { EmailPluginConfig } from '../components/plugins/config/email/EmailPluginConfig';
import { WebhookPluginConfig } from '../components/plugins/config/webhook/WebhookPluginConfig';
import { QuizGradingPluginConfig } from '../components/plugins/config/quiz/QuizGradingPluginConfig';

/**
 * Plugin Configuration Page
 * Unified page for configuring all plugin types (Email, Webhook, Slack, etc.)
 */
const PluginConfiguration: React.FC = () => {
  const { formId, pluginId, pluginType } = useParams<{
    formId: string;
    pluginId?: string;
    pluginType?: string;
  }>();
  const navigate = useNavigate();

  const [isSaving, setIsSaving] = useState(false);

  // Fetch form data
  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  // Fetch existing plugin data if editing
  const { data: pluginData, loading: pluginLoading } = useQuery(GET_FORM_PLUGIN, {
    variables: { id: pluginId },
    skip: !pluginId,
  });

  const [createPlugin] = useMutation(CREATE_FORM_PLUGIN);
  const [updatePlugin] = useMutation(UPDATE_FORM_PLUGIN);

  const mode = pluginId ? 'edit' : 'create';
  const currentPluginType = pluginId ? pluginData?.formPlugin?.type : pluginType;

  // Handle save for create mode
  const handleCreate = async (data: {
    type: string;
    name: string;
    config: any;
    events: string[];
  }) => {
    setIsSaving(true);
    try {
      await createPlugin({
        variables: {
          input: {
            formId,
            ...data,
          },
        },
        refetchQueries: ['GetFormPlugins'],
      });

      toastSuccess(
        'Plugin Created',
        `"${data.name}" has been created successfully`
      );

      // Navigate back to plugins page
      navigate(`/dashboard/form/${formId}/plugins`);
    } catch (error: any) {
      toastError('Failed to Create Plugin', error.message || 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle save for edit mode
  const handleUpdate = async (data: {
    type: string;
    name: string;
    config: any;
    events: string[];
  }) => {
    if (!pluginId) return;

    setIsSaving(true);
    try {
      await updatePlugin({
        variables: {
          id: pluginId,
          input: {
            name: data.name,
            config: data.config,
            events: data.events,
          },
        },
        refetchQueries: ['GetFormPlugins'],
      });

      toastSuccess(
        'Plugin Updated',
        `"${data.name}" has been updated successfully`
      );

      // Navigate back to plugins page
      navigate(`/dashboard/form/${formId}/plugins`);
    } catch (error: any) {
      toastError('Failed to Update Plugin', error.message || 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = mode === 'edit' ? handleUpdate : handleCreate;

  if (formLoading || (pluginId && pluginLoading)) {
    return (
      <MainLayout
        title="Configure Plugin"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
          { label: 'Configure', href: '#' },
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
        title="Configure Plugin"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
          { label: 'Configure', href: '#' },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">Form Not Found</h3>
            <p className="text-slate-600">
              The form you're looking for doesn't exist or you don't have permission to configure plugins.
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;
  const existingPlugin = pluginData?.formPlugin;

  // Render appropriate configuration component based on plugin type
  const renderPluginConfig = () => {
    switch (currentPluginType) {
      case 'email':
        return (
          <EmailPluginConfig
            form={form}
            initialData={existingPlugin}
            mode={mode}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => navigate(`/dashboard/form/${formId}/plugins`)}
          />
        );

      case 'webhook':
        return (
          <WebhookPluginConfig
            initialData={existingPlugin}
            mode={mode}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => navigate(`/dashboard/form/${formId}/plugins`)}
          />
        );

      case 'quiz-grading':
        return (
          <QuizGradingPluginConfig
            form={form}
            initialData={existingPlugin}
            mode={mode}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={() => navigate(`/dashboard/form/${formId}/plugins`)}
          />
        );

      default:
        return (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Unknown Plugin Type
              </h3>
              <p className="text-gray-600 mb-6">
                The plugin type "{currentPluginType}" is not recognized.
              </p>
              <Button onClick={() => navigate(`/dashboard/form/${formId}/plugins`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Plugins
              </Button>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <MainLayout
      title={`${mode === 'edit' ? 'Edit' : 'Configure'} ${currentPluginType ? currentPluginType.charAt(0).toUpperCase() + currentPluginType.slice(1) : 'Plugin'}`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
        { label: mode === 'edit' ? 'Edit' : 'Configure', href: '#' },
      ]}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderPluginConfig()}
      </div>
    </MainLayout>
  );
};

export default PluginConfiguration;
