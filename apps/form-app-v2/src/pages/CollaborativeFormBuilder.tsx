import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@dculus/ui-v2';
import { AppSidebar } from '@/components/app-sidebar';
import { FormPermissionProvider, type PermissionLevel } from '@/contexts/FormPermissionContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { LayoutTab, PageBuilderTab, PreviewTab, SettingsTab } from '@/components/collaborate/tabs';
import { GET_FORM_BY_ID } from '@/graphql/queries';
import { useTranslate } from '@/i18n';
import { getFormViewerUrl } from '@/lib/config';

type BuilderTab = 'layout' | 'page-builder' | 'preview' | 'settings';

const VALID_TABS: BuilderTab[] = ['layout', 'page-builder', 'preview', 'settings'];
const DEFAULT_TAB: BuilderTab = 'page-builder';

interface FormQueryResponse {
  form: {
    id: string;
    title: string;
    description?: string | null;
    shortUrl?: string | null;
    userPermission?: PermissionLevel | null;
    isPublished: boolean;
    updatedAt: string;
  } | null;
}

const LoadingView = () => {
  const t = useTranslate();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10">
      <Spinner className="h-6 w-6 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {t('collaborate.loading.title')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          {t('collaborate.loading.subtitle')}
        </p>
      </div>
    </div>
  );
};

const ErrorView = ({ message }: { message: string }) => {
  const t = useTranslate();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center gap-3">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <CardTitle className="text-xl font-semibold">
            {t('collaborate.error.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{message}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export const CollaborativeFormBuilder = () => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { formId, tab } = useParams<{ formId: string; tab?: string }>();

  const activeTab: BuilderTab = useMemo(() => {
    if (tab && VALID_TABS.includes(tab as BuilderTab)) {
      return tab as BuilderTab;
    }
    return DEFAULT_TAB;
  }, [tab]);

  const { data, loading: formLoading, error: formError } = useQuery<FormQueryResponse>(
    GET_FORM_BY_ID,
    {
      variables: { id: formId },
      skip: !formId,
      errorPolicy: 'all',
    },
  );

  const {
    isConnected,
    isLoading,
    pages,
    selectedPageId,
    initializeCollaboration,
    disconnectCollaboration,
    setSelectedPage,
    setSelectedField,
  } = useFormBuilderStore();

  const form = data?.form ?? null;
  const userPermission: PermissionLevel = (form?.userPermission as PermissionLevel) ?? 'VIEWER';

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (!formId) return;
      const target = VALID_TABS.includes(nextTab as BuilderTab) ? nextTab : DEFAULT_TAB;
      navigate(`/dashboard/form/${formId}/collaborate/${target}`, { replace: true });
    },
    [formId, navigate],
  );

  const handleBack = useCallback(() => {
    if (!formId) {
      navigate('/dashboard');
      return;
    }
    navigate(`/dashboard/form/${formId}`);
  }, [formId, navigate]);

  useEffect(() => {
    if (!formId || tab) {
      return;
    }
    navigate(`/dashboard/form/${formId}/collaborate/${DEFAULT_TAB}`, { replace: true });
  }, [formId, tab, navigate]);

  useEffect(() => {
    if (!formId) return;
    initializeCollaboration(formId).catch((error) => {
      console.error('Failed to initialize collaboration', error);
    });
    return () => {
      disconnectCollaboration();
    };
  }, [formId, initializeCollaboration, disconnectCollaboration]);

  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPage(pages[0].id);
      setSelectedField(null);
    }
  }, [pages, selectedPageId, setSelectedField, setSelectedPage]);

  if (!formId) {
    return <ErrorView message={t('collaborate.error.missingFormId')} />;
  }

  if (formError) {
    const fallback = formError.message || t('collaborate.error.generic');
    return <ErrorView message={fallback} />;
  }

  if (formLoading || isLoading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <LoadingView />
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!form) {
    return <ErrorView message={t('collaborate.error.notFound')} />;
  }

  const viewerUrl = form.shortUrl ? getFormViewerUrl(form.shortUrl) : null;

  return (
    <FormPermissionProvider userPermission={userPermission}>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur">
            <div className="flex flex-1 items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-6" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">
                      {t('collaborate.breadcrumb.root')}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="hidden sm:block">
                    <BreadcrumbLink href="/dashboard">
                      {t('collaborate.breadcrumb.dashboard')}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{form.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="hidden items-center gap-2 pr-4 sm:flex">
              <Badge variant="outline">
                {t('collaborate.header.permissionBadge', { level: userPermission })}
              </Badge>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected
                  ? t('collaborate.status.connected')
                  : t('collaborate.status.connecting')}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('collaborate.header.back')}
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-muted/30 via-background to-muted/20">
            <div className="px-4 py-6 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {form.title || t('collaborate.header.titleFallback')}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {form.description
                      ? form.description
                      : t('collaborate.header.subtitle')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={form.isPublished ? 'default' : 'secondary'}>
                    {form.isPublished
                      ? t('collaborate.header.statusLive')
                      : t('collaborate.header.statusDraft')}
                  </Badge>
                  {user?.name ? (
                    <Badge variant="outline">{user.name}</Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-1 flex-col">
              <div className="sticky top-16 z-10 border-b border-border/60 bg-background/90 backdrop-blur">
                <div className="px-4 sm:px-6 lg:px-8">
                  <TabsList className="h-12 justify-start gap-2 overflow-x-auto">
                    <TabsTrigger value="layout">
                      {t('collaborate.tabs.layout')}
                    </TabsTrigger>
                    <TabsTrigger value="page-builder">
                      {t('collaborate.tabs.pageBuilder')}
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      {t('collaborate.tabs.preview')}
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                      {t('collaborate.tabs.settings')}
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <TabsContent
                value="layout"
                className="flex-1 overflow-hidden px-4 py-6 sm:px-6 lg:px-8"
              >
                <LayoutTab
                  pages={pages}
                  isConnected={isConnected}
                  selectedPageId={selectedPageId}
                  onSelectPage={(pageId) => {
                    setSelectedPage(pageId);
                    setSelectedField(null);
                  }}
                />
              </TabsContent>

              <TabsContent
                value="page-builder"
                className="flex-1 overflow-hidden px-4 py-6 sm:px-6 lg:px-8"
              >
                <PageBuilderTab isConnected={isConnected} />
              </TabsContent>

              <TabsContent
                value="preview"
                className="flex-1 overflow-hidden px-4 py-6 sm:px-6 lg:px-8"
              >
                <PreviewTab viewerUrl={viewerUrl} shortUrl={form.shortUrl ?? null} />
              </TabsContent>

              <TabsContent
                value="settings"
                className="flex-1 overflow-hidden px-4 py-6 sm:px-6 lg:px-8"
              >
                <SettingsTab formTitle={form.title} />
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </FormPermissionProvider>
  );
};

export default CollaborativeFormBuilder;
