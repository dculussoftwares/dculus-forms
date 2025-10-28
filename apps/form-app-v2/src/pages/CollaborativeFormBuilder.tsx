import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from '@dculus/ui-v2';
import { FormPermissionProvider, type PermissionLevel } from '@/contexts/FormPermissionContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import {
  LayoutTab,
  PageBuilderTab,
  PreviewTab,
  SettingsTab,
} from '@/components/collaborate/tabs';
import {
  TabKeyboardShortcuts,
  TabNavigation,
  type BuilderTab,
} from '@/components/collaborate/TabNavigation';
import { GET_FORM_BY_ID } from '@/graphql/queries';
import { useTranslate } from '@/i18n';
import { getFormViewerUrl } from '@/lib/config';

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
    (nextTab: BuilderTab) => {
      if (!formId) return;
      const target = VALID_TABS.includes(nextTab) ? nextTab : DEFAULT_TAB;
      navigate(`/dashboard/form/${formId}/collaborate/${target}`);
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
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-background to-blue-50/50">
        <LoadingView />
      </div>
    );
  }

  if (!form) {
    return <ErrorView message={t('collaborate.error.notFound')} />;
  }

  const viewerUrl = form.shortUrl ? getFormViewerUrl(form.shortUrl) : null;

  return (
    <FormPermissionProvider userPermission={userPermission}>
      <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-background to-blue-50/50 dark:from-slate-900 dark:via-background dark:to-blue-950/40">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-1 items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="shrink-0"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('collaborate.header.back')}
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold sm:text-2xl">
                  {form.title || t('collaborate.header.titleFallback')}
                </h1>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {form.description
                    ? form.description
                    : t('collaborate.header.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {user?.name ? (
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {user.name}
                </Badge>
              ) : null}
              <Badge variant={form.isPublished ? 'default' : 'secondary'}>
                {form.isPublished
                  ? t('collaborate.header.statusLive')
                  : t('collaborate.header.statusDraft')}
              </Badge>
              <Badge variant="outline">
                {t('collaborate.header.permissionBadge', { level: userPermission })}
              </Badge>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected
                  ? t('collaborate.status.connected')
                  : t('collaborate.status.connecting')}
              </Badge>
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-32 sm:px-6 lg:px-8">
            {activeTab === 'layout' ? (
              <LayoutTab
                pages={pages}
                isConnected={isConnected}
                selectedPageId={selectedPageId}
                onSelectPage={(pageId) => {
                  setSelectedPage(pageId);
                  setSelectedField(null);
                }}
              />
            ) : null}

            {activeTab === 'page-builder' ? (
              <PageBuilderTab isConnected={isConnected} />
            ) : null}

            {activeTab === 'preview' ? (
              <PreviewTab viewerUrl={viewerUrl} shortUrl={form.shortUrl ?? null} />
            ) : null}

            {activeTab === 'settings' ? <SettingsTab formTitle={form.title} /> : null}
          </div>
        </main>

        <TabNavigation
          activeTab={activeTab}
          isConnected={isConnected}
          collaboratorCount={0}
        />
        <TabKeyboardShortcuts onTabChange={handleTabChange} />
      </div>
    </FormPermissionProvider>
  );
};

export default CollaborativeFormBuilder;
