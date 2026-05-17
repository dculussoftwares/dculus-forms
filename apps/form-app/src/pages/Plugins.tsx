import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import { LoadingSpinner, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_FORM_PLUGINS } from '../graphql/plugins';
import { AlertCircle, Plus, Plug } from 'lucide-react';
import { AddPluginDialog } from '../components/plugins/dialogs/AddPluginDialog';
import { PluginCard } from '../components/plugins/shared/PluginCard';
import { PluginDeliveryLog } from '../components/plugins/shared/PluginDeliveryLog';
import { PluginType } from '../components/plugins/shared/PluginGallery';

const Plugins: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('plugins');

  const [isAddPluginDialogOpen, setIsAddPluginDialogOpen] = useState(false);
  const [deliveryLogPlugin, setDeliveryLogPlugin] = useState<{ id: string; name: string } | null>(null);

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: pluginsData, loading: pluginsLoading, refetch: refetchPlugins } = useQuery(GET_FORM_PLUGINS, {
    variables: { formId },
    skip: !formId,
  });

  const handlePluginSelected = (pluginType: PluginType) => {
    setIsAddPluginDialogOpen(false);
    navigate(`/dashboard/form/${formId}/plugins/configure/${pluginType.id}`);
  };

  const handleEditPlugin = (plugin: any) => navigate(`/dashboard/form/${formId}/plugins/${plugin.id}/edit`);
  const handleViewDeliveries = (plugin: any) => setDeliveryLogPlugin({ id: plugin.id, name: plugin.name });
  const handleCloseDeliveryLog = () => setDeliveryLogPlugin(null);

  if (formLoading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.plugins') },
        ]}
      >
        <div className="flex justify-center items-center min-h-96"><LoadingSpinner /></div>
      </MainLayout>
    );
  }

  if (formError || !formData?.form) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.plugins') },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6" style={{ color: '#ce5d55' }} />}
          title={t('errors.formNotFound.title')}
          description={t('errors.formNotFound.description')}
        />
      </MainLayout>
    );
  }

  const form = formData.form;
  const plugins = pluginsData?.formPlugins || [];

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbs.plugins') },
      ]}
    >
      <div className="space-y-5">
        {/* ── Typeform-style page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold" style={{ color: '#3c323e' }}>{t('header.title')}</h1>
            <p className="text-xs mt-0.5" style={{ color: '#655d67' }}>
              {t('header.description', { values: { formTitle: form.title } })}
            </p>
          </div>

          <button
            onClick={() => setIsAddPluginDialogOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-white transition-all duration-150"
            style={{ backgroundColor: '#3c323e' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2e2530'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#3c323e'; }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('buttons.addIntegration')}
          </button>
        </div>

        {/* ── Content ── */}
        {pluginsLoading ? (
          <div className="flex justify-center items-center py-16"><LoadingSpinner /></div>
        ) : plugins.length === 0 ? (
          /* Empty state — Typeform-style */
          <div
            className="rounded-xl p-10 text-center bg-white"
            style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#fbe19d' }}>
              <Plug className="h-7 w-7" style={{ color: '#8b6a18' }} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: '#3c323e' }}>
              {t('emptyState.title')}
            </h3>
            <p className="text-xs max-w-sm mx-auto mb-5" style={{ color: '#655d67' }}>
              {t('emptyState.description')}
            </p>
            <button
              onClick={() => setIsAddPluginDialogOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#3c323e' }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('buttons.browseIntegrations')}
            </button>
          </div>
        ) : (
          /* Plugin list — Typeform integration list style */
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium" style={{ color: '#655d67' }}>
                {t('activeIntegrations.title', { values: { count: plugins.length } })}
              </h2>
            </div>
            <div
              className="rounded-xl bg-white overflow-hidden"
              style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}
            >
              {plugins.map((plugin: any, i: number) => (
                <div key={plugin.id} style={{ borderTop: i > 0 ? '1px solid rgba(81,76,84,0.08)' : undefined }}>
                  <PluginCard
                    plugin={plugin}
                    onEdit={() => handleEditPlugin(plugin)}
                    onViewDeliveries={() => handleViewDeliveries(plugin)}
                    onDeleted={refetchPlugins}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddPluginDialog
        open={isAddPluginDialogOpen}
        onOpenChange={setIsAddPluginDialogOpen}
        onPluginSelected={handlePluginSelected}
      />

      {deliveryLogPlugin && (
        <PluginDeliveryLog
          open={true}
          onOpenChange={(open) => { if (!open) handleCloseDeliveryLog(); }}
          pluginId={deliveryLogPlugin.id}
          pluginName={deliveryLogPlugin.name}
        />
      )}
    </MainLayout>
  );
};

export default Plugins;
