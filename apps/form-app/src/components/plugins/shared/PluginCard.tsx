import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  Button,
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
  GraduationCap,
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
} from '../../../graphql/plugins';
import { useTranslation } from '../../../hooks/useTranslation';

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
  const { t } = useTranslation('pluginCard');
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
        enabled ? t('toasts.enabledTitle') : t('toasts.disabledTitle'),
        t(enabled ? 'toasts.enabledMessage' : 'toasts.disabledMessage', { values: { name: plugin.name } })
      );
    } catch (error: any) {
      toastError(t('toasts.updateErrorTitle'), error.message);
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
      toastSuccess(t('toasts.testTriggeredTitle'), data.testFormPlugin.message);
    } catch (error: any) {
      toastError(t('toasts.testFailedTitle'), error.message);
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
      toastSuccess(t('toasts.deletedTitle'), t('toasts.deletedMessage', { values: { name: plugin.name } }));
      onDeleted();
    } catch (error: any) {
      toastError(t('toasts.deleteErrorTitle'), error.message);
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
      case 'quiz-grading':
        return <GraduationCap className="h-5 w-5" />;
      default:
        return <Webhook className="h-5 w-5" />;
    }
  };

  /* Typeform field-icon palette for plugin types */
  const getPluginIconStyle = () => {
    switch (plugin.type) {
      case 'webhook':      return { bg: '#fbe19d', color: '#8b6a18' };   /* yellow */
      case 'email':        return { bg: 'var(--tf-icon-salmon)', color: 'var(--tf-dark)' };   /* salmon */
      case 'quiz-grading': return { bg: 'var(--tf-icon-lavender)', color: '#5c2e6b' };   /* lavender */
      case 'slack':        return { bg: '#c4e3ba', color: '#2d6236' };   /* green */
      default:             return { bg: 'var(--tf-icon-gray)', color: 'var(--tf-text)' };   /* gray */
    }
  };
  const iconStyle = getPluginIconStyle();

  const getPluginTypeLabel = () => {
    switch (plugin.type) {
      case 'webhook':
        return t('types.webhook');
      case 'email':
        return t('types.email');
      case 'slack':
        return t('types.slack');
      case 'quiz-grading':
        return t('types.quiz-grading');
      default:
        return plugin.type;
    }
  };

  return (
    <>
      {/* ── Typeform-style horizontal integration row ── */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Field-icon style icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconStyle.bg }}>
          <span style={{ color: iconStyle.color }}>{getPluginIcon()}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium truncate text-primary">{plugin.name}</span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={plugin.enabled
                ? { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' }
                : { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' }
              }
            >
              {plugin.enabled ? t('status.enabled') : t('status.disabled')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {getPluginTypeLabel()} · {t('eventsCount', { values: { count: plugin.events.length } })}
          </p>
          {/* Event badges */}
          {plugin.events.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {plugin.events.map((event: string) => (
                <span key={event} className="px-2 py-0.5 rounded-lg text-[10px]" style={{ backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border-medium)' }}>
                  {event}
                </span>
              ))}
            </div>
          )}
          {/* Webhook URL */}
          {plugin.type === 'webhook' && plugin.config?.url && (
            <p className="text-[10px] font-mono mt-1.5 truncate max-w-xs text-muted-foreground">{plugin.config.url}</p>
          )}
        </div>

        {/* Actions menu */}
        <div className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 flex items-center justify-center rounded-lg p-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleToggleEnabled(!plugin.enabled)} disabled={isTogglingEnabled}>
                {isTogglingEnabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : plugin.enabled ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                {plugin.enabled ? t('actions.disable') : t('actions.enable')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleTest} disabled={isTesting}>
                {isTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                {t('actions.test')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewDeliveries}>
                <History className="mr-2 h-4 w-4" />
                {t('actions.viewDeliveries')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', { values: { name: plugin.name } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              {t('deleteDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              {t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
