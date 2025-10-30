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
import { useTranslation } from '../hooks/useTranslation';
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
  const { t } = useTranslation('pluginConfiguration');
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
        t('toasts.pluginCreated.title'),
        t('toasts.pluginCreated.description', { values: { name: data.name } })
      );

      // Navigate back to plugins page
      navigate(`/dashboard/form/${formId}/plugins`);
    } catch (error: any) {
      toastError(t('toasts.pluginCreated.error'), error.message || t('toasts.pluginCreated.errorDescription'));
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
        t('toasts.pluginUpdated.title'),
        t('toasts.pluginUpdated.description', { values: { name: data.name } })
      );

      // Navigate back to plugins page
      navigate(`/dashboard/form/${formId}/plugins`);
    } catch (error: any) {
      toastError(t('toasts.pluginUpdated.error'), error.message || t('toasts.pluginUpdated.errorDescription'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = mode === 'edit' ? handleUpdate : handleCreate;

  if (formLoading || (pluginId && pluginLoading)) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.plugins'), href: `/dashboard/form/${formId}/plugins` },
          { label: t('layout.breadcrumbs.configure'), href: '#' },
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
          { label: t('layout.breadcrumbs.plugins'), href: `/dashboard/form/${formId}/plugins` },
          { label: t('layout.breadcrumbs.configure'), href: '#' },
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
                {t('errors.unknownPluginType.title')}
              </h3>
              <p className="text-gray-600 mb-6">
                {t('errors.unknownPluginType.description', { values: { pluginType: currentPluginType } })}
              </p>
              <Button onClick={() => navigate(`/dashboard/form/${formId}/plugins`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('actions.backToPlugins')}
              </Button>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { 
        values: { 
          mode: mode === 'edit' ? t('layout.breadcrumbs.edit') : t('layout.breadcrumbs.configure'),
          pluginType: currentPluginType ? currentPluginType.charAt(0).toUpperCase() + currentPluginType.slice(1) : t('layout.pluginFallback')
        }
      })}
      breadcrumbs={[
        { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbs.plugins'), href: `/dashboard/form/${formId}/plugins` },
        { label: mode === 'edit' ? t('layout.breadcrumbs.edit') : t('layout.breadcrumbs.configure'), href: '#' },
      ]}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderPluginConfig()}
      </div>
    </MainLayout>
  );
};

export default PluginConfiguration;
