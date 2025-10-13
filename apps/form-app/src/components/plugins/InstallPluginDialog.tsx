/**
 * Install Plugin from URL Dialog
 *
 * Allows users to install external plugins by providing a URL
 */

import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  toastSuccess,
  toastError,
  Alert,
  AlertDescription,
} from '@dculus/ui';
import { INSTALL_EXTERNAL_PLUGIN } from '../../graphql/plugins';
import { Download, AlertCircle, Globe } from 'lucide-react';

interface InstallPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InstallPluginDialog({
  open,
  onOpenChange,
  onSuccess,
}: InstallPluginDialogProps) {
  const [pluginUrl, setPluginUrl] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);

  const [installExternalPlugin] = useMutation(INSTALL_EXTERNAL_PLUGIN);

  const handleInstall = async () => {
    if (!pluginUrl || !pluginUrl.startsWith('http')) {
      toastError('Invalid URL', 'Please enter a valid HTTP or HTTPS URL');
      return;
    }

    setIsInstalling(true);

    try {
      const result = await installExternalPlugin({
        variables: {
          input: {
            url: pluginUrl,
          },
        },
      });

      if (result.data?.installExternalPlugin?.success) {
        toastSuccess(
          'Plugin Installed',
          `${result.data.installExternalPlugin.pluginId} installed successfully`
        );
        setPluginUrl('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toastError(
          'Installation Failed',
          result.data?.installExternalPlugin?.message || 'Unknown error'
        );
      }
    } catch (error: any) {
      console.error('Plugin installation error:', error);
      toastError(
        'Installation Failed',
        error.message || 'Failed to install plugin. Please check the URL and try again.'
      );
    } finally {
      setIsInstalling(false);
    }
  };

  const handleClose = () => {
    if (!isInstalling) {
      setPluginUrl('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Install Plugin from URL
          </DialogTitle>
          <DialogDescription>
            Install an external plugin by providing the URL to its manifest
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="plugin-url">Plugin URL</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="plugin-url"
                type="url"
                placeholder="https://example.com/plugins/my-plugin"
                value={pluginUrl}
                onChange={(e) => setPluginUrl(e.target.value)}
                disabled={isInstalling}
                className="pl-10"
                autoFocus
              />
            </div>
            <p className="text-sm text-gray-500">
              The URL should point to a directory containing manifest.json
            </p>
          </div>

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>How it works:</strong> The system will download the plugin manifest, validate
              it, and install the plugin bundles. The plugin will be available for use in your
              forms immediately.
            </AlertDescription>
          </Alert>

          {/* Example URLs */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Example URLs:</p>
            <div className="space-y-1 rounded-md bg-gray-50 p-3">
              <code className="block text-xs text-gray-600">
                http://localhost:3001 (Hello World Plugin)
              </code>
              <code className="block text-xs text-gray-600">
                http://localhost:3002 (Webhook Notifier Plugin)
              </code>
              <code className="block text-xs text-gray-600">
                https://cdn.example.com/plugins/my-plugin
              </code>
            </div>
          </div>

          {/* Warning */}
          {pluginUrl && (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Security Notice:</strong> Only install plugins from trusted sources. Plugins
                have access to form data within your organization.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isInstalling}>
            Cancel
          </Button>
          <Button onClick={handleInstall} disabled={!pluginUrl || isInstalling}>
            {isInstalling ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Install Plugin
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
