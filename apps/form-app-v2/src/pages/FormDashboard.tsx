import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppSidebar } from '@/components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardContent,
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Skeleton,
} from '@dculus/ui-v2';
import { AlertCircle } from 'lucide-react';
import {
  CollectResponsesDialog,
  DeleteDialog,
  FormHeader,
  QuickActions,
  StatsGrid,
  UnpublishDialog,
} from '../components/form-dashboard';
import { ShareModal } from '../components/form-dashboard/ShareModal';
import { useFormDashboard } from '../hooks/useFormDashboard';
import { useTranslate } from '../i18n';
import { getFormViewerUrl } from '../lib/config';

export const FormDashboard = () => {
  const t = useTranslate();
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
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

  if (formLoading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex flex-1 items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-6" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">
                      {t('formDashboard.breadcrumb.root')}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/dashboard">
                      {t('formDashboard.breadcrumb.dashboard')}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {t('formDashboard.breadcrumb.loading')}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="space-y-6">
              <Skeleton className="h-24 w-full" />
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (formError || !form) {
    return (
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex flex-1 items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-6" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">
                      {t('formDashboard.breadcrumb.root')}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/dashboard">
                      {t('formDashboard.breadcrumb.dashboard')}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {t('formDashboard.breadcrumb.error')}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
            <Card className="max-w-md">
              <CardContent className="space-y-4 p-8 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <h3 className="text-xl font-semibold">
                  {t('formDashboard.error.title')}
                </h3>
                <p className="text-muted-foreground">
                  {t('formDashboard.error.description')}
                </p>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">
                    {t('formDashboard.breadcrumb.root')}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">
                    {t('formDashboard.breadcrumb.dashboard')}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{form.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-12 overflow-y-auto bg-gradient-to-br from-muted/30 via-background to-muted/20 px-4 py-10 sm:px-6 lg:px-8">
          {/* Header Section */}
          <FormHeader
            form={form}
            onPublish={handlePublish}
            onUnpublish={() => setShowUnpublishDialog(true)}
            onDelete={() => setShowDeleteDialog(true)}
            onCollectResponses={handleCollectResponses}
            onPreview={() => {
              if (form.shortUrl) {
                const viewerUrl = getFormViewerUrl(form.shortUrl);
                window.open(viewerUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            onViewAnalytics={() => {
              navigate(`/dashboard/form/${formId}/analytics`);
            }}
            onShare={() => setShowShareModal(true)}
            updateLoading={updateLoading}
            deleteLoading={deleteLoading}
          />

          {/* Stats Section */}
          <div>
            <div className="mb-6">
              <h2 className="mb-1 text-xl font-semibold">
                {t('formDashboard.sections.stats.title')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('formDashboard.sections.stats.description')}
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
          formUrl={form.shortUrl ? getFormViewerUrl(form.shortUrl) : ''}
          formTitle={form.title}
          onCopyLink={handleCopyLink}
          onOpenForm={handleOpenFormViewer}
        />

        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          formId={formId!}
          formTitle={form.title}
          shortUrl={form.shortUrl}
        />
      </SidebarInset>
    </SidebarProvider>
  );
};
