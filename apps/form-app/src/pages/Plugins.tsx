import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { Card, LoadingSpinner, Button } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_FORM_PLUGINS, CREATE_FORM_PLUGIN, UPDATE_FORM_PLUGIN } from '../graphql/plugins';
import { AlertCircle, Plus, Plug } from 'lucide-react';
import { AddPluginDialog } from '../components/plugins/AddPluginDialog';
import { WebhookPluginDialog } from '../components/plugins/WebhookPluginDialog';
import { EmailPluginDialog } from '../components/plugins/EmailPluginDialog';
import { SlackPluginDialog } from '../components/plugins/SlackPluginDialog';
import { PluginCard } from '../components/plugins/PluginCard';
import { PluginDeliveryLog } from '../components/plugins/PluginDeliveryLog';
import { PluginType } from '../components/plugins/PluginGallery';

interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

/**
 * Plugins Page - displays and manages plugins for form enhancements.
 */
const Plugins: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();

  // Dialog states
  const [isAddPluginDialogOpen, setIsAddPluginDialogOpen] = useState(false);
  const [isWebhookDialogOpen, setIsWebhookDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isSlackDialogOpen, setIsSlackDialogOpen] = useState(false);

  const [editingPlugin, setEditingPlugin] = useState<any | null>(null);
  const [deliveryLogPlugin, setDeliveryLogPlugin] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: pluginsData, loading: pluginsLoading, refetch: refetchPlugins } = useQuery(
    GET_FORM_PLUGINS,
    {
      variables: { formId },
      skip: !formId,
    }
  );

  const [createPlugin] = useMutation(CREATE_FORM_PLUGIN, {
    refetchQueries: [{ query: GET_FORM_PLUGINS, variables: { formId } }],
  });

  const [updatePlugin] = useMutation(UPDATE_FORM_PLUGIN, {
    refetchQueries: [{ query: GET_FORM_PLUGINS, variables: { formId } }],
  });

  const handlePluginSelected = (pluginType: PluginType) => {
    // Close the gallery dialog
    setIsAddPluginDialogOpen(false);

    // Open the appropriate configuration dialog
    switch (pluginType.id) {
      case 'webhook':
        setIsWebhookDialogOpen(true);
        break;
      case 'email':
        setIsEmailDialogOpen(true);
        break;
      case 'slack':
        setIsSlackDialogOpen(true);
        break;
      default:
        break;
    }
  };

  const handleCreateWebhook = async (data: {
    type: string;
    name: string;
    config: WebhookConfig;
    events: string[];
  }) => {
    await createPlugin({
      variables: {
        input: {
          formId,
          ...data,
        },
      },
    });
  };

  const handleUpdateWebhook = async (data: {
    type: string;
    name: string;
    config: WebhookConfig;
    events: string[];
  }) => {
    if (!editingPlugin) return;

    await updatePlugin({
      variables: {
        id: editingPlugin.id,
        input: {
          name: data.name,
          config: data.config,
          events: data.events,
        },
      },
    });
    setEditingPlugin(null);
  };

  const handleEditPlugin = (plugin: any) => {
    setEditingPlugin(plugin);

    // Open appropriate dialog based on plugin type
    switch (plugin.type) {
      case 'webhook':
        setIsWebhookDialogOpen(true);
        break;
      case 'email':
        setIsEmailDialogOpen(true);
        break;
      case 'slack':
        setIsSlackDialogOpen(true);
        break;
      default:
        break;
    }
  };

  const handleCloseWebhookDialog = () => {
    setIsWebhookDialogOpen(false);
    setEditingPlugin(null);
  };

  const handleViewDeliveries = (plugin: any) => {
    setDeliveryLogPlugin({ id: plugin.id, name: plugin.name });
  };

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
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">Form Not Found</h3>
            <p className="text-slate-600">
              The form you're looking for doesn't exist or you don't have
              permission to view its plugins.
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;
  const plugins = pluginsData?.formPlugins || [];

  return (
    <MainLayout
      title={`${form.title} - Plugins`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
      ]}
    >
      {/* Container with consistent styling */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
            <p className="text-gray-600 mt-1">
              Connect <span className="font-medium">{form.title}</span> with external services and automate workflows
            </p>
          </div>

          {/* Add Integration Button */}
          <Button onClick={() => setIsAddPluginDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>

        {/* Plugins List */}
        {pluginsLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : plugins.length === 0 ? (
          /* Empty State */
          <Card className="p-12">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-orange-100 mb-4">
                <Plug className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Integrations Yet
              </h3>
              <p className="text-gray-600 max-w-2xl mx-auto mb-6">
                Connect your forms to external services. Automate workflows, send data to CRMs, trigger notifications, and more with our growing collection of integrations.
              </p>
              <Button onClick={() => setIsAddPluginDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Browse Integrations
              </Button>
            </div>
          </Card>
        ) : (
          /* Plugin Cards */
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Active Integrations ({plugins.length})
              </h2>
            </div>
            <div className="space-y-4">
              {plugins.map((plugin: any) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  onEdit={() => handleEditPlugin(plugin)}
                  onViewDeliveries={() => handleViewDeliveries(plugin)}
                  onDeleted={refetchPlugins}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Plugin Gallery Dialog */}
      <AddPluginDialog
        open={isAddPluginDialogOpen}
        onOpenChange={setIsAddPluginDialogOpen}
        onPluginSelected={handlePluginSelected}
      />

      {/* Webhook Configuration Dialog */}
      <WebhookPluginDialog
        open={isWebhookDialogOpen}
        onOpenChange={handleCloseWebhookDialog}
        onSave={editingPlugin ? handleUpdateWebhook : handleCreateWebhook}
        initialData={editingPlugin}
        mode={editingPlugin ? 'edit' : 'create'}
      />

      {/* Email Configuration Dialog (Coming Soon) */}
      <EmailPluginDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
      />

      {/* Slack Configuration Dialog (Coming Soon) */}
      <SlackPluginDialog
        open={isSlackDialogOpen}
        onOpenChange={setIsSlackDialogOpen}
      />

      {/* Delivery Log Dialog */}
      {deliveryLogPlugin && (
        <PluginDeliveryLog
          open={!!deliveryLogPlugin}
          onOpenChange={(open) => !open && setDeliveryLogPlugin(null)}
          pluginId={deliveryLogPlugin.id}
          pluginName={deliveryLogPlugin.name}
        />
      )}
    </MainLayout>
  );
};

export default Plugins;
