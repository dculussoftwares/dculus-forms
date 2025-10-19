import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import {
  Card,
  Button,
  Badge,
  toastSuccess,
  toastError,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@dculus/ui';
import {
  Webhook,
  Mail,
  MessageSquare,
  MoreVertical,
  Edit,
  Trash2,
  PlayCircle,
  History,
  Loader2,
  Power,
  PowerOff,
} from 'lucide-react';
import {
  UPDATE_FORM_PLUGIN,
  DELETE_FORM_PLUGIN,
  TEST_FORM_PLUGIN,
} from '../../graphql/plugins';

interface PluginCardProps {
  plugin: {
    id: string;
    type: string;
    name: string;
    enabled: boolean;
    config: any;
    events: string[];
    createdAt: string;
    updatedAt: string;
  };
  onEdit: () => void;
  onViewDeliveries: () => void;
  onDeleted: () => void;
}

export const PluginCard: React.FC<PluginCardProps> = ({
  plugin,
  onEdit,
  onViewDeliveries,
  onDeleted,
}) => {
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [updatePlugin] = useMutation(UPDATE_FORM_PLUGIN);
  const [deletePlugin] = useMutation(DELETE_FORM_PLUGIN);
  const [testPlugin] = useMutation(TEST_FORM_PLUGIN);

  const handleToggleEnabled = async (enabled: boolean) => {
    setIsTogglingEnabled(true);
    try {
      await updatePlugin({
        variables: {
          id: plugin.id,
          input: { enabled },
        },
        refetchQueries: ['GetFormPlugins'],
      });
      toastSuccess(
        enabled ? 'Plugin Enabled' : 'Plugin Disabled',
        `"${plugin.name}" has been ${enabled ? 'enabled' : 'disabled'}`
      );
    } catch (error: any) {
      toastError('Failed to Update Plugin', error.message);
    } finally {
      setIsTogglingEnabled(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const { data } = await testPlugin({
        variables: { id: plugin.id },
      });
      toastSuccess('Test Triggered', data.testFormPlugin.message);
    } catch (error: any) {
      toastError('Test Failed', error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);
    try {
      await deletePlugin({
        variables: { id: plugin.id },
      });
      toastSuccess('Plugin Deleted', `"${plugin.name}" has been deleted`);
      onDeleted();
    } catch (error: any) {
      toastError('Failed to Delete Plugin', error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getPluginIcon = () => {
    switch (plugin.type) {
      case 'webhook':
        return <Webhook className="h-5 w-5" />;
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'slack':
        return <MessageSquare className="h-5 w-5" />;
      default:
        return <Webhook className="h-5 w-5" />;
    }
  };

  const getPluginIconColor = () => {
    switch (plugin.type) {
      case 'webhook':
        return 'text-orange-600';
      case 'email':
        return 'text-blue-600';
      case 'slack':
        return 'text-purple-600';
      default:
        return 'text-orange-600';
    }
  };

  const getPluginIconBgColor = () => {
    switch (plugin.type) {
      case 'webhook':
        return 'bg-orange-100';
      case 'email':
        return 'bg-blue-100';
      case 'slack':
        return 'bg-purple-100';
      default:
        return 'bg-orange-100';
    }
  };

  const getPluginTypeLabel = () => {
    switch (plugin.type) {
      case 'webhook':
        return 'Webhook';
      case 'email':
        return 'Email Notification';
      case 'slack':
        return 'Slack';
      default:
        return plugin.type;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        {/* Left Section - Icon and Info */}
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-2 rounded-lg ${getPluginIconBgColor()} ${getPluginIconColor()}`}>
            {getPluginIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {plugin.name}
              </h3>
              <Badge variant={plugin.enabled ? 'default' : 'secondary'}>
                {plugin.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <p className="text-sm text-gray-500 mb-3">
              {getPluginTypeLabel()} • {plugin.events.length} event
              {plugin.events.length !== 1 ? 's' : ''}
            </p>

            {/* Event Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {plugin.events.map((event) => (
                <Badge key={event} variant="outline" className="text-xs">
                  {event}
                </Badge>
              ))}
            </div>

            {/* Config Summary */}
            {plugin.type === 'webhook' && plugin.config?.url && (
              <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded truncate max-w-md">
                {plugin.config.url}
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Controls */}
        <div className="flex items-center gap-3">
          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => handleToggleEnabled(!plugin.enabled)}
                disabled={isTogglingEnabled}
              >
                {isTogglingEnabled ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : plugin.enabled ? (
                  <PowerOff className="mr-2 h-4 w-4" />
                ) : (
                  <Power className="mr-2 h-4 w-4" />
                )}
                {plugin.enabled ? 'Disable' : 'Enable'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleTest} disabled={isTesting}>
                {isTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Test Plugin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewDeliveries}>
                <History className="mr-2 h-4 w-4" />
                View Deliveries
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="text-red-600 focus:text-red-600"
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plugin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{plugin.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
