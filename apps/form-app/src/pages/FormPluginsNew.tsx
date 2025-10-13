/**
 * Form Plugins Page - Microsoft Teams-style Plugin Marketplace
 *
 * Allows users to browse, install, configure, and manage plugins for their forms.
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import {
  Button,
  Card,
  CardContent,
  LoadingSpinner,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import {
  GET_AVAILABLE_PLUGINS,
  GET_FORM_PLUGIN_CONFIGS,
  INSTALL_PLUGIN,
  UPDATE_PLUGIN_CONFIG,
  TOGGLE_PLUGIN,
  UNINSTALL_PLUGIN,
} from '../graphql/plugins';
import {
  ArrowLeft,
  Settings,
  Power,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { HelloWorldConfigDialog } from '../plugins/hello-world/ConfigDialog';

const FormPluginsNew: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [selectedPlugin, setSelectedPlugin] = useState<any>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false);
  const [pluginToUninstall, setPluginToUninstall] = useState<any>(null);

  // GraphQL Queries
  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const {
    data: pluginsData,
    loading: pluginsLoading,
  } = useQuery(GET_AVAILABLE_PLUGINS);

  const {
    data: configsData,
    loading: configsLoading,
    refetch: refetchConfigs,
  } = useQuery(GET_FORM_PLUGIN_CONFIGS, {
    variables: { formId },
    skip: !formId,
  });

  // GraphQL Mutations
  const [installPlugin] = useMutation(INSTALL_PLUGIN);
  const [updatePluginConfig] = useMutation(UPDATE_PLUGIN_CONFIG);
  const [togglePlugin] = useMutation(TOGGLE_PLUGIN);
  const [uninstallPlugin] = useMutation(UNINSTALL_PLUGIN);

  const form = formData?.form;
  const availablePlugins = pluginsData?.availablePlugins || [];
  const installedConfigs = configsData?.formPluginConfigs || [];

  // Helper to check if plugin is installed
  const isPluginInstalled = (pluginId: string) => {
    return installedConfigs.some((config: any) => config.pluginId === pluginId);
  };

  // Get installed config for a plugin
  const getInstalledConfig = (pluginId: string) => {
    return installedConfigs.find((config: any) => config.pluginId === pluginId);
  };

  // Handle plugin installation
  const handleInstallClick = (plugin: any) => {
    setSelectedPlugin(plugin);
    setConfigDialogOpen(true);
  };

  // Handle plugin configuration save
  const handleConfigSave = async (config: any) => {
    try {
      const existingConfig = getInstalledConfig(selectedPlugin.id);

      if (existingConfig) {
        // Update existing configuration
        await updatePluginConfig({
          variables: {
            input: {
              id: existingConfig.id,
              config: config,
            },
          },
        });
        toastSuccess(
          'Plugin Updated',
          `${selectedPlugin.name} configuration has been updated.`
        );
      } else {
        // Install new plugin
        await installPlugin({
          variables: {
            input: {
              formId,
              pluginId: selectedPlugin.id,
              organizationId: form.organization.id,
              config: config,
            },
          },
        });
        toastSuccess(
          'Plugin Installed',
          `${selectedPlugin.name} has been installed successfully.`
        );
      }

      await refetchConfigs();
      setConfigDialogOpen(false);
      setSelectedPlugin(null);
    } catch (error: any) {
      console.error('Error saving plugin config:', error);
      toastError(
        'Error',
        error.message || 'Failed to save plugin configuration'
      );
    }
  };

  // Handle plugin toggle
  const handleToggle = async (configId: string, currentState: boolean) => {
    try {
      await togglePlugin({
        variables: {
          input: {
            id: configId,
            isEnabled: !currentState,
          },
        },
      });
      await refetchConfigs();
      toastSuccess(
        'Plugin ' + (!currentState ? 'Enabled' : 'Disabled'),
        'Plugin state has been updated.'
      );
    } catch (error: any) {
      console.error('Error toggling plugin:', error);
      toastError('Error', error.message || 'Failed to toggle plugin');
    }
  };

  // Handle plugin uninstall
  const handleUninstall = async () => {
    if (!pluginToUninstall) return;

    try {
      await uninstallPlugin({
        variables: {
          id: pluginToUninstall.id,
        },
      });
      await refetchConfigs();
      toastSuccess(
        'Plugin Uninstalled',
        `${pluginToUninstall.plugin.name} has been removed.`
      );
      setUninstallDialogOpen(false);
      setPluginToUninstall(null);
    } catch (error: any) {
      console.error('Error uninstalling plugin:', error);
      toastError('Error', error.message || 'Failed to uninstall plugin');
    }
  };

  if (formLoading || pluginsLoading || configsLoading) {
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

  if (formError || !form) {
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
            <h3 className="text-xl font-semibold mb-2">Form Not Found</h3>
            <p className="text-slate-600">
              The form you're looking for doesn't exist or you don't have
              permission to view it.
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const installedPlugins = installedConfigs.filter(
    (config: any) => config.isEnabled
  );

  return (
    <MainLayout
      title={`${form.title} - Plugins`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: 'Plugins', href: `/dashboard/form/${formId}/plugins` },
      ]}
    >
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/form/${formId}`)}
              className="mb-3"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Plugins</h1>
            <p className="text-slate-600 text-lg">
              Extend your forms with powerful integrations
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Installed Plugins Section */}
          {installedPlugins.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-slate-900">
                  Installed Plugins
                </h2>
                <Badge variant="secondary" className="text-sm">
                  {installedPlugins.length} Active
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {installedConfigs.map((config: any) => (
                  <Card
                    key={config.id}
                    className={`border-2 ${
                      config.isEnabled
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-slate-200'
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{config.plugin.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-slate-900">
                              {config.plugin.name}
                            </h3>
                            {config.isEnabled && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                            {config.plugin.description}
                          </p>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPlugin(config.plugin);
                                setConfigDialogOpen(true);
                              }}
                            >
                              <Settings className="h-3 w-3 mr-1" />
                              Configure
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleToggle(config.id, config.isEnabled)
                              }
                            >
                              <Power className="h-3 w-3 mr-1" />
                              {config.isEnabled ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPluginToUninstall(config);
                                setUninstallDialogOpen(true);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Available Plugins Section */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              Available Plugins
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePlugins.map((plugin: any) => {
                const installed = isPluginInstalled(plugin.id);
                return (
                  <Card
                    key={plugin.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{plugin.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 mb-1">
                            {plugin.name}
                          </h3>
                          <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                            {plugin.description}
                          </p>

                          <Button
                            size="sm"
                            onClick={() => handleInstallClick(plugin)}
                            disabled={installed}
                            className="w-full"
                          >
                            {installed ? 'Installed' : 'Install'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Configuration Dialog */}
        {selectedPlugin?.id === 'hello-world' && (
          <HelloWorldConfigDialog
            open={configDialogOpen}
            onOpenChange={setConfigDialogOpen}
            initialConfig={getInstalledConfig(selectedPlugin.id)?.config}
            onSave={handleConfigSave}
            isEditing={isPluginInstalled(selectedPlugin.id)}
          />
        )}

        {/* Uninstall Confirmation Dialog */}
        <Dialog open={uninstallDialogOpen} onOpenChange={setUninstallDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Uninstall Plugin</DialogTitle>
              <DialogDescription>
                Are you sure you want to uninstall{' '}
                <strong>{pluginToUninstall?.plugin.name}</strong>? This will
                remove the plugin configuration and it will stop executing.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUninstallDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleUninstall}>
                Uninstall
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default FormPluginsNew;
