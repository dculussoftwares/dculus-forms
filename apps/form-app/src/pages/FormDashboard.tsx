import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LoadingSpinner,
  EmptyState,
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Progress,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { FormHeader } from '../components/FormDashboard/FormHeader';
import { StatsGrid } from '../components/FormDashboard/StatsGrid';
import { QuickActions } from '../components/FormDashboard/QuickActions';
import { DeleteDialog, UnpublishDialog, CollectResponsesDialog } from '../components/FormDashboard/Dialogs';
import { ShareModal } from '../components/sharing/ShareModal';
import { PublishSuccessAnimation } from '../components/FormDashboard/PublishSuccessAnimation';
import { useFormDashboard } from '../hooks/useFormDashboard';
import { useAuth } from '../contexts/AuthContext';
import { useAppConfig } from '@/hooks';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useMutation } from '@apollo/client';
import { DUPLICATE_FORM } from '../graphql/mutations';
import { getFormViewerUrl } from '@/lib/config';

const FormDashboard: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId } = useAppConfig();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateProgress, setDuplicateProgress] = useState(0);
  const { t } = useTranslation('formDashboard');
  const [duplicateFormMutation, { loading: isDuplicating }] = useMutation(DUPLICATE_FORM);

  const {
    form,
    dashboardStats,
    formLoading,
    deleteLoading,
    updateLoading,
    formError,
    showDeleteDialog,
    setShowDeleteDialog,
    showUnpublishDialog,
    setShowUnpublishDialog,
    showCollectResponsesDialog,
    setShowCollectResponsesDialog,
    showPublishAnimation,
    setShowPublishAnimation,
    handleDelete,
    handlePublish,
    handleUnpublish,
    handleCollectResponses,
    handleCopyLink,
    handleOpenFormViewer,
  } = useFormDashboard(formId);

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

  // Share functionality
  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleDuplicate = () => {
    if (!form) {
      return;
    }
    setDuplicateProgress(0);
    setShowDuplicateDialog(true);
  };

  const performDuplicate = async () => {
    if (!form || isDuplicating) {
      return;
    }

    try {
      const { data } = await duplicateFormMutation({
        variables: { id: form.id }
      });

      if (data?.duplicateForm) {
        setDuplicateProgress(100);
        toastSuccess(
          t('toast.duplicateSuccess.title'),
          t('toast.duplicateSuccess.description', {
            values: { title: data.duplicateForm.title }
          })
        );
        setShowDuplicateDialog(false);
        navigate(`/dashboard/form/${data.duplicateForm.id}`);
      }
    } catch (error) {
      console.error('Failed to duplicate form', error);
      toastError(
        t('toast.duplicateError.title'),
        t('toast.duplicateError.description')
      );
      setDuplicateProgress(0);
    }
  };

  const handleDuplicateDialogClose = (open: boolean) => {
    if (!open && isDuplicating) {
      return;
    }

    setShowDuplicateDialog(open);

    if (!open) {
      setDuplicateProgress(0);
    }
  };

  // Handle copy link from animation
  const handleAnimationCopyLink = () => {
    handleCopyLink();
    toastSuccess(t('toast.copied.title'), t('toast.copied.description'));
  };

  // Handle view form from animation
  const handleAnimationViewForm = () => {
    handleOpenFormViewer();
  };

  if (formLoading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbRoot'), href: '/dashboard' },
          { label: t('layout.breadcrumbSelf'), href: `/dashboard/form/${formId}` },
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
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbRoot'), href: '/dashboard' },
          { label: t('layout.breadcrumbSelf'), href: `/dashboard/form/${formId}` },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-[#ce5d55]" />}
          title={t('error.title')}
          description={t('error.description')}
        />
      </MainLayout>
    );
  }

  const formViewerUrl = getFormViewerUrl(form.shortUrl);

  return (
    <MainLayout
      title={`${form.title} - ${t('layout.title')}`}
      breadcrumbs={[
        { label: t('layout.breadcrumbRoot'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
      ]}
    >
      <>
      <div className="space-y-6">
          {/* Header Section */}
          <FormHeader
            form={form}
            onPublish={handlePublish}
            onUnpublish={() => setShowUnpublishDialog(true)}
            onDelete={() => setShowDeleteDialog(true)}
            onCollectResponses={handleCollectResponses}
            onPreview={() => {
              window.open(formViewerUrl, '_blank');
            }}
            onViewAnalytics={() => {
              navigate(`/dashboard/form/${formId}/analytics`);
            }}
            onShare={handleShare}
            onDuplicate={handleDuplicate}
            updateLoading={updateLoading}
            deleteLoading={deleteLoading}
            duplicateLoading={isDuplicating}
          />

          {/* Stats Section */}
          <div>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[#3c323e]">
                {t('overview.heading')}
              </h2>
              <p className="text-xs mt-0.5 text-[#655d67]">
                {t('overview.description')}
              </p>
            </div>
            <StatsGrid stats={dashboardStats} />
          </div>

          {/* Quick Actions Section */}
          <QuickActions formId={formId!} />

      </div>

        {/* Dialogs */}
        <DeleteDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDelete}
          formTitle={form.title}
          loading={deleteLoading}
        />

        <UnpublishDialog
          open={showUnpublishDialog}
          onOpenChange={setShowUnpublishDialog}
          onConfirm={handleUnpublish}
          formTitle={form.title}
          loading={updateLoading}
        />

        <CollectResponsesDialog
          open={showCollectResponsesDialog}
          onOpenChange={setShowCollectResponsesDialog}
          formUrl={formViewerUrl}
          formTitle={form.title}
          onCopyLink={handleCopyLink}
          onOpenForm={handleOpenFormViewer}
        />

        <AlertDialog open={showDuplicateDialog} onOpenChange={handleDuplicateDialogClose}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('duplicateDialog.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('duplicateDialog.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {isDuplicating && (
              <div className="space-y-2">
                <div className="text-sm text-[#655d67]">
                  {t('duplicateDialog.progressLabel')}
                </div>
                <Progress value={Math.min(duplicateProgress, 100)} />
              </div>
            )}
            <AlertDialogFooter>
              <div className="flex w-full justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleDuplicateDialogClose(false)}
                  disabled={isDuplicating}
                >
                  {t('duplicateDialog.cancel')}
                </Button>
                <Button onClick={performDuplicate} disabled={isDuplicating}>
                  {isDuplicating ? t('duplicateDialog.working') : t('duplicateDialog.confirm')}
                </Button>
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Share Modal */}
        {showShareModal && organizationId && user && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            formId={form.id}
            formTitle={form.title}
            organizationId={organizationId}
            currentUserId={user.id}
          />
        )}

        {/* Publish Success Animation */}
        {showPublishAnimation && (
          <PublishSuccessAnimation
            formTitle={form.title}
            formUrl={formViewerUrl}
            onClose={() => setShowPublishAnimation(false)}
            onCopyLink={handleAnimationCopyLink}
            onViewForm={handleAnimationViewForm}
          />
        )}
      </>
    </MainLayout>
  );
};

export default FormDashboard;
