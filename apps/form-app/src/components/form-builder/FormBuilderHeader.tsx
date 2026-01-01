import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Progress,
  toastError,
  toastSuccess,
} from '@dculus/ui';
import {
  ArrowLeft,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  MoreVertical,
  Share2,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import { ShareModal } from '../sharing/ShareModal';
import { PermissionBadge } from './PermissionBadge';
import { UndoRedoButtons } from './UndoRedoButtons';
import { CollaboratorAvatars } from './CollaboratorAvatars';
import { DUPLICATE_FORM, UPDATE_FORM } from '../../graphql/mutations';
import { getFormViewerUrl } from '../../lib/config';

interface FormBuilderHeaderProps {
  formId: string;
  formTitle?: string;
  formShortUrl?: string;
  isPublished?: boolean;
  organizationId?: string;
  currentUserId?: string;
  isLoading: boolean;
  isConnected: boolean;
  onAddPage: () => void;
  onNavigateBack?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  updateLoading?: boolean;
}

export const FormBuilderHeader: React.FC<FormBuilderHeaderProps> = ({
  formId: _formId,
  formTitle: initialFormTitle,
  formShortUrl,
  isPublished,
  organizationId,
  currentUserId,
  isLoading,
  isConnected,
  onAddPage: _onAddPage,
  onNavigateBack,
  onPublish,
  onUnpublish,
  updateLoading = false,
}) => {
  const { t } = useTranslation('formBuilderHeader');
  const [formTitle, setFormTitle] = useState(
    initialFormTitle || t('defaultTitle')
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateProgress, setDuplicateProgress] = useState(0);
  const permissions = useFormPermissions();
  const navigate = useNavigate();
  const [duplicateFormMutation, { loading: isDuplicating }] =
    useMutation(DUPLICATE_FORM);
  const [updateFormMutation] = useMutation(UPDATE_FORM);

  // Update local state when prop changes
  useEffect(() => {
    if (initialFormTitle) {
      setFormTitle(initialFormTitle);
    }
  }, [initialFormTitle]);

  useEffect(() => {
    if (!isDuplicating) {
      return undefined;
    }

    setDuplicateProgress(10);
    const interval = setInterval(() => {
      setDuplicateProgress((prev) => {
        if (prev >= 90) {
          return prev;
        }
        return prev + Math.random() * 12;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [isDuplicating]);

  useEffect(() => {
    if (!isDuplicating && duplicateProgress > 0 && duplicateProgress < 100) {
      setDuplicateProgress(100);
    }
  }, [isDuplicating, duplicateProgress]);

  useEffect(() => {
    if (!showDuplicateDialog && !isDuplicating) {
      setDuplicateProgress(0);
    }
  }, [showDuplicateDialog, isDuplicating]);

  const handleSaveTitle = async () => {
    const trimmedTitle = formTitle.trim();

    if (!trimmedTitle) {
      // Revert to original title if empty
      setFormTitle(initialFormTitle || t('defaultTitle'));
      setIsEditingTitle(false);
      return;
    }

    if (trimmedTitle !== initialFormTitle && permissions.canEdit) {
      try {
        await updateFormMutation({
          variables: {
            id: _formId,
            input: {
              title: trimmedTitle,
            },
          },
        });

        toastSuccess(
          t('toasts.updateTitleSuccess.title'),
          t('toasts.updateTitleSuccess.description')
        );
      } catch (error) {
        console.error('Failed to update form title:', error);
        toastError(
          t('toasts.updateTitleError.title'),
          t('toasts.updateTitleError.description')
        );
        // Revert to original title on error
        setFormTitle(initialFormTitle || t('defaultTitle'));
      }
    }

    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setFormTitle(initialFormTitle || t('defaultTitle'));
    setIsEditingTitle(false);
  };

  const handleDuplicateForm = () => {
    if (!permissions.canEdit) {
      return;
    }
    setDuplicateProgress(0);
    setShowDuplicateDialog(true);
  };

  const performDuplicate = async () => {
    if (!permissions.canEdit || isDuplicating) {
      return;
    }

    try {
      const { data } = await duplicateFormMutation({
        variables: { id: _formId },
      });

      if (data?.duplicateForm) {
        setDuplicateProgress(100);
        toastSuccess(
          t('toasts.duplicateSuccess.title'),
          t('toasts.duplicateSuccess.description', {
            values: { title: data.duplicateForm.title },
          })
        );
        setShowDuplicateDialog(false);
        navigate(`/dashboard/form/${data.duplicateForm.id}`);
      }
    } catch (error) {
      console.error('Failed to duplicate form', error);
      toastError(
        t('toasts.duplicateError.title'),
        t('toasts.duplicateError.description')
      );
      setDuplicateProgress(0);
    }
  };

  const handleViewLiveForm = () => {
    if (formShortUrl) {
      const viewerUrl = getFormViewerUrl(formShortUrl);
      window.open(viewerUrl, '_blank');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Back button, Form title and status */}
          <div className="flex items-center space-x-4">
            {onNavigateBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateBack}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <div className="flex items-center space-x-3">
              <div>
                {isEditingTitle && permissions.canEdit ? (
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveTitle();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                    className="text-lg font-semibold border-0 shadow-none p-0 h-auto focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      permissions.canEdit && setIsEditingTitle(true)
                    }
                    className="text-lg font-semibold hover:text-gray-600 dark:hover:text-gray-300 flex items-center space-x-1 h-auto p-0"
                    disabled={!permissions.canEdit}
                    title={
                      !permissions.canEdit ? t('tooltips.noEditPermission') : ''
                    }
                  >
                    <span>{formTitle}</span>
                    {permissions.canEdit && (
                      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Permission Badge and Connection Status */}
            <div className="flex items-center space-x-3">
              <PermissionBadge />
              <UndoRedoButtons />
              <CollaboratorAvatars />
              <div className="flex items-center space-x-2">
                {isLoading ? (
                  <>
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('status.connecting')}
                    </span>
                  </>
                ) : isConnected ? (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('status.live')}
                    </span>
                    <Users className="w-4 h-4 text-gray-400" />
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('status.offline')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-3">
            {/* Publish/Unpublish Button */}
            {permissions.canEdit &&
              (isPublished ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-600 dark:text-gray-400 border-amber-200 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                  onClick={onUnpublish}
                  disabled={updateLoading}
                  title={t('tooltips.unpublishFormTooltip')}
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  {updateLoading
                    ? t('buttons.unpublishing')
                    : t('buttons.unpublishForm')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={onPublish}
                  disabled={updateLoading}
                  title={t('tooltips.publishFormTooltip')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {updateLoading
                    ? t('buttons.publishing')
                    : t('buttons.publishForm')}
                </Button>
              ))}

            {/* View Live Form Button */}
            {isPublished && formShortUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-400"
                onClick={handleViewLiveForm}
                title={t('tooltips.viewLiveFormTooltip')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('buttons.viewLiveForm')}
              </Button>
            )}

            {permissions.canShareForm() && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-400"
                onClick={() => setShowShareModal(true)}
                disabled={!organizationId || !currentUserId || !formShortUrl}
                title={
                  !permissions.canShareForm()
                    ? t('tooltips.noSharePermission')
                    : ''
                }
              >
                <Share2 className="w-4 h-4 mr-2" />
                {t('buttons.share')}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleDuplicateForm}
                  disabled={!permissions.canEdit}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {t('menu.duplicateForm')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && organizationId && currentUserId && formShortUrl && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          formId={_formId}
          formTitle={formTitle}
          organizationId={organizationId}
          currentUserId={currentUserId}
        />
      )}

      <AlertDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('duplicateDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('duplicateDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isDuplicating && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('duplicateDialog.progressLabel')}
              </div>
              <Progress value={Math.min(duplicateProgress, 100)} />
            </div>
          )}
          <AlertDialogFooter>
            <div className="flex w-full justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (isDuplicating) {
                    return;
                  }
                  setShowDuplicateDialog(false);
                  setDuplicateProgress(0);
                }}
                disabled={isDuplicating}
              >
                {t('duplicateDialog.cancel')}
              </Button>
              <Button onClick={performDuplicate} disabled={isDuplicating}>
                {isDuplicating
                  ? t('duplicateDialog.working')
                  : t('duplicateDialog.confirm')}
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
