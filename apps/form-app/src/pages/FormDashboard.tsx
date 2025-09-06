import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Separator,
  LoadingSpinner,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { FormHeader } from '../components/FormDashboard/FormHeader';
import { StatsGrid } from '../components/FormDashboard/StatsGrid';
import { QuickActions } from '../components/FormDashboard/QuickActions';
import { FormStructure, RecentResponses } from '../components/FormDashboard/RecentResponses';
import { ResponseTable } from '../components/FormDashboard/ResponseTable';
import { DeleteDialog, UnpublishDialog, CollectResponsesDialog } from '../components/FormDashboard/Dialogs';
import { useFormDashboard } from '../hooks/useFormDashboard';
import { AlertCircle } from 'lucide-react';

const FormDashboard: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  
  const {
    form,
    responses,
    dashboardStats,
    formLoading,
    responsesLoading,
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

  if (formLoading || responsesLoading) {
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
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
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
          updateLoading={updateLoading}
          deleteLoading={deleteLoading}
        />

        <Separator />

        <StatsGrid stats={dashboardStats} />

        <QuickActions formId={formId!} />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <FormStructure formId={formId!} />
          <RecentResponses
            responses={dashboardStats.recentResponses}
            totalResponses={dashboardStats.totalResponses}
          />
        </div>

        <ResponseTable
          responses={responses}
          totalResponses={dashboardStats.totalResponses}
        />

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
      </div>
    </MainLayout>
  );
};

export default FormDashboard;
