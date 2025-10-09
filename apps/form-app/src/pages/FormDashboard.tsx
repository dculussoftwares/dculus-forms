import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  LoadingSpinner,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { FormHeader } from '../components/FormDashboard/FormHeader';
import { StatsGrid } from '../components/FormDashboard/StatsGrid';
import { QuickActions } from '../components/FormDashboard/QuickActions';
import { DeleteDialog, UnpublishDialog, CollectResponsesDialog } from '../components/FormDashboard/Dialogs';
import { ShareModal } from '../components/sharing/ShareModal';
import { useFormDashboard } from '../hooks/useFormDashboard';
import { useAuth } from '../contexts/AuthContext';
import { useAppConfig } from '@/hooks';
import { AlertCircle } from 'lucide-react';

const FormDashboard: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId } = useAppConfig();
  const [showShareModal, setShowShareModal] = useState(false);

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
    handleDelete,
    handlePublish,
    handleUnpublish,
    handleCollectResponses,
    handleCopyLink,
    handleOpenFormViewer,
  } = useFormDashboard(formId);

  // Share functionality
  const handleShare = () => {
    setShowShareModal(true);
  };

  if (formLoading) {
    return (
      <MainLayout
        title="Form Dashboard"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
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
        title="Form Dashboard"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">Form Not Found</h3>
            <p className="text-slate-600">
              The form you're looking for doesn't exist or you don't have
              permission to view it.
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={`${form.title} - Dashboard`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
      ]}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
          {/* Header Section */}
          <FormHeader
            form={form}
            onPublish={handlePublish}
            onUnpublish={() => setShowUnpublishDialog(true)}
            onDelete={() => setShowDeleteDialog(true)}
            onCollectResponses={handleCollectResponses}
            onPreview={() => {
              const formViewerUrl = `http://localhost:5173/f/${form.shortUrl}`;
              window.open(formViewerUrl, '_blank');
            }}
            onViewAnalytics={() => {
              navigate(`/dashboard/form/${formId}/analytics`);
            }}
            onShare={handleShare}
            updateLoading={updateLoading}
            deleteLoading={deleteLoading}
          />

          {/* Stats Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-1">
                Performance Overview
              </h2>
              <p className="text-sm text-slate-600">
                Track your form's key metrics and engagement
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
          formUrl={`http://localhost:5173/f/${form.shortUrl}`}
          formTitle={form.title}
          onCopyLink={handleCopyLink}
          onOpenForm={handleOpenFormViewer}
        />

        {/* Share Modal */}
        {showShareModal && organizationId && user && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            formId={form.id}
            formTitle={form.title}
            formShortUrl={form.shortUrl}
            organizationId={organizationId}
            currentUserId={user.id}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default FormDashboard;
