import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { LoadingSpinner, Button, toastSuccess, toastError, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { useTranslation } from '../hooks/useTranslation';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_FORM_PLUGIN, GET_FORM_PLUGINS, CREATE_FORM_PLUGIN, UPDATE_FORM_PLUGIN } from '../graphql/plugins';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { getFrontendPlugin } from '../plugins/core/registry';
import '../plugins/index';

const PluginConfiguration: React.FC = () => {
  const { t } = useTranslation('pluginConfiguration');
  const { formId, pluginId, pluginType } = useParams<{
    formId: string;
    pluginId?: string;
    pluginType?: string;
  }>();
  const navigate = useNavigate();

  const [isSaving, setIsSaving] = useState(false);

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
    fetchPolicy: 'cache-and-network',
  });

  const { data: pluginData, loading: pluginLoading } = useQuery(GET_FORM_PLUGIN, {
    variables: { id: pluginId },
    skip: !pluginId,
  });

  const [createPlugin] = useMutation(CREATE_FORM_PLUGIN);
  const [updatePlugin] = useMutation(UPDATE_FORM_PLUGIN);

  const mode = pluginId ? 'edit' : 'create';
  const currentPluginType = pluginId ? pluginData?.formPlugin?.type : pluginType;

  const handleCreate = async (data: { type: string; name: string; config: any; events: string[] }) => {
    setIsSaving(true);
    try {
      await createPlugin({
        variables: { input: { formId, ...data } },
        refetchQueries: [{ query: GET_FORM_PLUGINS, variables: { formId } }],
      });
      toastSuccess(
        t('toasts.pluginCreated.title'),
        t('toasts.pluginCreated.description', { values: { name: data.name } })
      );
      navigate(`/dashboard/form/${formId}/integrations`);
    } catch (error: any) {
      toastError(t('toasts.pluginCreated.error'), error.message || t('toasts.pluginCreated.errorDescription'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: { type: string; name: string; config: any; events: string[] }) => {
    if (!pluginId) return;
    setIsSaving(true);
    try {
      await updatePlugin({
        variables: { id: pluginId, input: { name: data.name, config: data.config, events: data.events } },
        refetchQueries: [{ query: GET_FORM_PLUGINS, variables: { formId } }],
      });
      toastSuccess(
        t('toasts.pluginUpdated.title'),
        t('toasts.pluginUpdated.description', { values: { name: data.name } })
      );
      navigate(`/dashboard/form/${formId}/integrations`);
    } catch (error: any) {
      toastError(t('toasts.pluginUpdated.error'), error.message || t('toasts.pluginUpdated.errorDescription'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = mode === 'edit' ? handleUpdate : handleCreate;
  const backToPlugins = () => navigate(`/dashboard/form/${formId}/integrations`);

  if (formLoading || (pluginId && pluginLoading)) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.plugins'), href: `/dashboard/form/${formId}/integrations` },
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
          { label: t('layout.breadcrumbs.plugins'), href: `/dashboard/form/${formId}/integrations` },
          { label: t('layout.breadcrumbs.configure'), href: '#' },
        ]}
      >
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
  const existingPlugin = pluginData?.formPlugin;
  const plugin = getFrontendPlugin(currentPluginType);

  const renderPluginConfig = () => {
    if (plugin) {
      const { ConfigForm } = plugin;
      return (
        <ConfigForm
          form={form}
          initialData={existingPlugin}
          mode={mode}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={backToPlugins}
        />
      );
    }

    return (
      <div
        className="rounded-xl bg-white p-10 text-center"
        style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#fbe19d' }}
        >
          <AlertCircle className="h-6 w-6 text-[#8b6a18]" />
        </div>
        <h3 className="text-sm font-semibold mb-1 text-primary">{t('errors.unknownPluginType.title')}</h3>
        <p className="text-xs mb-5 text-muted-foreground">
          {t('errors.unknownPluginType.description', { values: { pluginType: currentPluginType } })}
        </p>
        <Button onClick={backToPlugins}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('actions.backToPlugins')}
        </Button>
      </div>
    );
  };

  return (
    <MainLayout
      title={t('layout.dynamicTitle', {
        values: {
          mode: mode === 'edit' ? t('layout.breadcrumbs.edit') : t('layout.breadcrumbs.configure'),
          pluginType: currentPluginType
            ? currentPluginType.charAt(0).toUpperCase() + currentPluginType.slice(1)
            : t('layout.pluginFallback'),
        },
      })}
      breadcrumbs={[
        { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbs.plugins'), href: `/dashboard/form/${formId}/integrations` },
        { label: mode === 'edit' ? t('layout.breadcrumbs.edit') : t('layout.breadcrumbs.configure'), href: '#' },
      ]}
    >
      <div className="max-w-3xl mx-auto w-full">{renderPluginConfig()}</div>
    </MainLayout>
  );
};

export default PluginConfiguration;
