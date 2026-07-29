import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import { z } from 'zod';
import { useAuthContext } from '../contexts/AuthContext';
import { AlertTriangle, X } from 'lucide-react';
import {
  FormPermissionProvider,
  PermissionLevel,
} from '../contexts/FormPermissionContext';
import { useTranslation } from '../hooks/useTranslation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import {
  FieldTypeDisplay,
  type FieldTypeConfig,
} from '../components/form-builder/FieldTypesPanel';
import { FormField } from '@dculus/types';
import { FormBuilderHeader, CompactFieldCard } from '@/components/form-builder';
import { LoadingState } from '../components/form-builder/LoadingState';
import { ErrorState } from '../components/form-builder/ErrorState';
import {
  TabNavigation,
  TabKeyboardShortcuts,
  PageBuilderTab,
  type BuilderTab,
} from '../components/form-builder/tabs';
import { ConditionsTab } from '../components/form-builder/conditions/ConditionsTab';
import { PreviewOverlay } from '../components/form-builder/PreviewOverlay';
import { TooltipProvider } from '@dculus/ui';
import Automations from './Automations';
import AutomationBuilder from './AutomationBuilder';
import AutomationRuns from './AutomationRuns';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useCollisionDetection } from '../hooks/useCollisionDetection';
import { useFieldCreation } from '../hooks/useFieldCreation';
import { useConditionCycles } from '../hooks/useConditionCycles';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { UPDATE_FORM } from '../graphql/mutations';
import AIEditDrawer from '../components/form-builder/AIEditDrawer';
import { AskAIPill } from '../components/form-builder/AskAIPill';
import { getFieldLabel } from '../components/form-builder/utils';
import type { AskAIBuilderContext } from '../lib/askAIContext';

interface CollaborativeFormBuilderProps {
  className?: string;
}

const VALID_TABS: readonly BuilderTab[] = ['content', 'logic', 'automations'] as const;
const DEFAULT_TAB: BuilderTab = 'content';

// Old 5-tab URLs → new 3-tab shell. See epic #226 / ticket #227.
const OLD_TAB_REDIRECTS: Record<string, { tab: BuilderTab; params?: Record<string, string> }> = {
  layout: { tab: 'content', params: { screen: 'intro' } },
  'page-builder': { tab: 'content' },
  conditions: { tab: 'logic' },
  preview: { tab: 'content', params: { preview: '1' } },
  settings: { tab: 'content', params: { settings: '1' } },
};

const CollaborativeFormBuilder: React.FC<CollaborativeFormBuilderProps> = ({
  className,
}) => {
  const { formId, tab, automationId } = useParams<{
    formId: string;
    tab?: string;
    automationId?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingBgApplied = useRef(false);
  const { t } = useTranslation('collaborativeFormBuilder');
  const { user } = useAuthContext();
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const aiMessageParam = searchParams.get('aiMessage');
  const [aiInitialMessage, setAIInitialMessage] = useState<string | undefined>(
    aiMessageParam ? decodeURIComponent(aiMessageParam) : undefined
  );

  const activeTab: BuilderTab = useMemo(() => {
    // /builder/automations/:automationId(/runs) routes carry no `:tab` segment of their
    // own (the "automations" path segment is literal there) — an automationId means
    // we're on one of those canonical nested routes. See ticket #233.
    if (automationId) return 'automations';
    return tab && VALID_TABS.includes(tab as BuilderTab)
      ? (tab as BuilderTab)
      : DEFAULT_TAB;
  }, [tab, automationId]);

  // Distinguishes /builder/automations/:automationId (canvas builder) from
  // /builder/automations/:automationId/runs — both match the same `automationId` param.
  const isAutomationRunsView = useMemo(
    () => !!automationId && location.pathname.endsWith('/runs'),
    [automationId, location.pathname]
  );

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
    errorPolicy: 'all',
  });

  const [updateForm, { loading: updateLoading }] = useMutation(UPDATE_FORM);

  // Get user permission from form data, default to VIEWER if not available. Computed
  // here (rather than after the loading/error early-returns below, where it used to
  // live) so the Cmd+K handler further down — which needs `canEdit` to gate AI access
  // the same way the pill is gated — can read it too.
  const mockPermissionParam = searchParams.get('mockPermission');
  const mockPermissionSchema = z.enum(['VIEWER']);
  const parsedMockPermission = mockPermissionSchema.safeParse(mockPermissionParam).data;

  const actualPermission = (formData?.form?.userPermission as PermissionLevel) || 'VIEWER';
  const userPermission =
    parsedMockPermission === 'VIEWER' && actualPermission !== 'NO_ACCESS'
      ? 'VIEWER'
      : actualPermission;
  const canEdit = userPermission === 'OWNER' || userPermission === 'EDITOR';

  // Single permission-checked path for opening the AI drawer — AI edits require edit
  // permission, so every entry point (pill, Cmd+K, ConditionsTab's describe-with-AI,
  // the ?aiMessage= deep link) routes through one of these two instead of calling
  // setIsAIDrawerOpen directly. See #232.
  const openAIDrawer = useCallback(() => {
    if (canEdit) setIsAIDrawerOpen(true);
  }, [canEdit]);

  const toggleAIDrawer = useCallback(() => {
    setIsAIDrawerOpen((prev) => (prev ? false : canEdit));
  }, [canEdit]);

  const {
    isConnected,
    isLoading,
    isCollaborationFailed,
    pages,
    selectedPageId,
    selection,
    conditions,

    initializeCollaboration,
    disconnectCollaboration,
    setSelectedPage,
    resetBuilder,

    addField,
    addFieldAtIndex,

    reorderFields,
    reorderPages,
    moveFieldBetweenPages,

    updateLayout,
    getSelectedField,
  } = useFormBuilderStore();

  // Seeds the AI drawer's context line + outgoing request payload with the active tab
  // and current rail selection (intro/page/field/thank-you). `pages` is a dep (not just
  // `getSelectedField`, whose identity is stable) so a live field-label rename while
  // that field is selected is reflected too. See ticket #232.
  const builderContext: AskAIBuilderContext = useMemo(() => {
    if (selection.kind === 'field') {
      const field = getSelectedField();
      return {
        activeTab,
        selection: {
          kind: 'field',
          pageId: selection.pageId,
          fieldId: selection.fieldId,
          fieldLabel: field ? getFieldLabel(field) : undefined,
        },
      };
    }
    return {
      activeTab,
      selection: { kind: selection.kind, pageId: selection.pageId },
    };
  }, [activeTab, selection, pages, getSelectedField]);

  // Builder rail health badges — Build field count, Logic circular-ref warning. See #167.
  const totalFieldCount = useMemo(
    () => pages.reduce((sum, p) => sum + p.fields.length, 0),
    [pages]
  );
  const circularRuleIds = useConditionCycles(conditions, pages);
  const logicHasWarning = circularRuleIds.size > 0;

  const { createFieldData } = useFieldCreation();
  const collisionDetectionStrategy = useCollisionDetection();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    // Phase 2A: Keyboard sensor for accessibility
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Redirect the 5 old builder URLs (+ no-tab) to the new 3-tab shell, preserving any
  // other query params already on the URL. See epic #226 / ticket #227.
  const redirectLegacyTab = useCallback(() => {
    if (!formId) return;
    if (automationId) return; // canonical nested automations route (#233) — nothing to redirect
    if (tab && VALID_TABS.includes(tab as BuilderTab)) return;

    const redirect = tab ? OLD_TAB_REDIRECTS[tab] : undefined;
    const targetTab = redirect?.tab ?? DEFAULT_TAB;
    const params = new URLSearchParams(location.search);
    if (redirect?.params) {
      Object.entries(redirect.params).forEach(([key, value]) => {
        if (!params.has(key)) params.set(key, value);
      });
    }
    const query = params.toString();
    // Preserve `location.state` (e.g. CreateFormWizard's `pendingBackgroundKey`, set on
    // its initial navigate to /builder/page-builder) through the redirect — otherwise the
    // background-image effect below never sees it.
    navigate(`/dashboard/form/${formId}/builder/${targetTab}${query ? `?${query}` : ''}`, {
      replace: true,
      state: location.state,
    });
  }, [formId, tab, automationId, navigate, location.search, location.state]);

  // Open the Preview / Settings overlays from a `?preview=1` / `?settings=1` deep link
  // (old `/builder/preview` and `/builder/settings` redirect here). See ticket #227.
  useEffect(() => {
    if (searchParams.get('preview') === '1') setIsPreviewOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('settings') === '1') setIsSettingsOpen(true);
  }, [searchParams]);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    if (searchParams.has('preview')) {
      const next = new URLSearchParams(searchParams);
      next.delete('preview');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
    if (searchParams.has('settings')) {
      const next = new URLSearchParams(searchParams);
      next.delete('settings');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleKeyboardTabChange = useCallback(
    (newTab: BuilderTab) => {
      if (formId) {
        navigate(`/dashboard/form/${formId}/builder/${newTab}${location.search}`);
      }
    },
    [formId, navigate, location.search]
  );

  const handleAddField = useCallback(
    (pageId: string, fieldType: FieldTypeConfig, insertIndex?: number) => {
      const fieldData = createFieldData(fieldType);

      if (insertIndex !== undefined) {
        addFieldAtIndex(pageId, fieldType.type, fieldData, insertIndex);
      } else {
        addField(pageId, fieldType.type, fieldData);
      }
    },
    [createFieldData, addField, addFieldAtIndex]
  );

  const {
    activeId,
    draggedItem,

    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useDragAndDrop({
    pages,
    onAddField: handleAddField,
    onReorderFields: reorderFields,
    onReorderPages: reorderPages,
    onMoveFieldBetweenPages: moveFieldBetweenPages,
  });

  const handleNavigateBack = useCallback(() => {
    navigate(`/dashboard/form/${formId}`);
  }, [formId, navigate]);

  const handlePublish = useCallback(() => {
    if (!formId) return;
    updateForm({
      variables: {
        id: formId,
        input: { isPublished: true },
      },
    });
  }, [formId, updateForm]);

  const handleUnpublish = useCallback(() => {
    if (!formId) return;
    updateForm({
      variables: {
        id: formId,
        input: { isPublished: false },
      },
    });
  }, [formId, updateForm]);

  const autoSelectFirstPage = useCallback(() => {
    // Read live store state rather than this closure's captured pages/selectedPageId/
    // selection — PageBuilderTab's useBuilderSelectionUrlSync effect can restore an
    // intro/thankYou selection from the URL in the same effect flush (mount happens
    // right as `isLoading` flips false), and since that runs via a plain Zustand
    // `set()` outside React's render cycle, this effect's own closure wouldn't see it
    // in time — reading getState() here avoids clobbering that fresh selection.
    const state = useFormBuilderStore.getState();
    // Don't hijack an intro/thank-you rail selection back to a page — those kinds
    // intentionally carry no selectedPageId (see selectionSlice's setSelection).
    if (state.selection.kind === 'intro' || state.selection.kind === 'thankYou') return;
    if (state.pages.length > 0 && !state.selectedPageId) {
      setSelectedPage(state.pages[0].id);
    }
    // pages/selectedPageId/selection.kind aren't read in the body above (it reads
    // getState() instead) — they're kept as deps purely to force this callback to
    // recompute (and its effect to re-run) whenever any of them change. Don't
    // remove them as "unused".
  }, [pages, selectedPageId, selection.kind, setSelectedPage]);

  useEffect(() => {
    redirectLegacyTab();
  }, [redirectLegacyTab]);

  useEffect(() => {
    if (!formId) return;

    initializeCollaboration(formId).catch((error) => {
      console.error('Failed to initialize collaboration:', error);
    });

    return () => {
      disconnectCollaboration();
    };
  }, [formId, initializeCollaboration, disconnectCollaboration]);

  useEffect(() => {
    autoSelectFirstPage();
  }, [autoSelectFirstPage]);

  // Apply background image key passed from the creation wizard via navigation state.
  // Wait for pages.length > 0 as a signal that the YJS document has fully hydrated
  // from Hocuspocus — writing before hydration loses to the server's initial sync.
  useEffect(() => {
    const pendingKey = (location.state as any)?.pendingBackgroundKey as string | undefined;
    if (!pendingKey || !isConnected || pages.length === 0 || pendingBgApplied.current) return;
    pendingBgApplied.current = true;
    updateLayout({ backgroundImageKey: pendingKey });
    navigate(location.pathname, { replace: true, state: {} });
  }, [isConnected, pages.length, location.state, location.pathname, updateLayout, navigate]);

  // P2-16: Reset layout and selection state when unmounting the builder
  useEffect(() => {
    return () => {
      resetBuilder();
    };
  }, [resetBuilder]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleAIDrawer();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        // Route the close path through handleClosePreview so `?preview=1` is stripped —
        // otherwise it lingers in location.search and the deep-link effect force-reopens
        // the overlay on the next tab switch (which preserves location.search).
        if (isPreviewOpen) {
          handleClosePreview();
        } else {
          setIsPreviewOpen(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen, handleClosePreview, toggleAIDrawer]);

  // Auto-open the AI drawer when navigated here with an aiMessage query param
  // (e.g. from "Fix with AI" in FieldAnalyticsViewer). Gated by canEdit via
  // openAIDrawer — a VIEWER following the link must not get the drawer (and its
  // request flow) opened. Waits for `formLoading` to settle (rather than firing
  // once on mount) since `canEdit` isn't resolved until `formData` loads; the ref
  // guard still ensures it only fires once, so editors get the same one-shot
  // behavior as before.
  const aiMessageHandledRef = useRef(false);
  useEffect(() => {
    if (aiMessageHandledRef.current || formLoading) return;
    aiMessageHandledRef.current = true;
    if (aiMessageParam) {
      openAIDrawer();
    }
  }, [formLoading, aiMessageParam, openAIDrawer]);

  const renderDragOverlay = useMemo(() => {
    if (!activeId || !draggedItem) return null;

    const draggedItemWithType = draggedItem as any;

    // Dragging a field type from the sidebar
    if (draggedItemWithType.type && !draggedItemWithType.id) {
      return (
        <div className="opacity-90">
          <FieldTypeDisplay fieldType={draggedItemWithType} isOverlay={true} />
        </div>
      );
    }

    // Dragging an existing FormField
    if (
      draggedItemWithType instanceof FormField ||
      (draggedItemWithType.id && draggedItemWithType.type)
    ) {
      return (
        <div className="transform scale-105 opacity-90 transition-all duration-200">
          <div className="shadow-2xl ring-4 ring-blue-500/20">
            <CompactFieldCard field={draggedItemWithType} variant="overlay" />
          </div>
        </div>
      );
    }

    // Dragging a page
    if (
      draggedItemWithType.id &&
      typeof draggedItemWithType.title === 'string'
    ) {
      const pageIndex = pages.findIndex((p) => p.id === draggedItemWithType.id);
      return (
        <div className="transform scale-105 transition-all duration-200">
          <div className="flex items-center justify-center w-14 h-14 bg-blue-500 text-white rounded-full shadow-2xl border-4 border-white ring-4 ring-blue-500/30 text-xl font-bold opacity-90">
            {pageIndex + 1}
          </div>
        </div>
      );
    }

    // Fallback
    return null;
  }, [activeId, draggedItem, pages]);

  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'content':
        return <PageBuilderTab onOpenPreview={() => setIsPreviewOpen(true)} />;
      case 'logic':
        return <ConditionsTab onDescribeWithAI={(description) => {
          setAIInitialMessage(`Create a condition rule from this request: ${description}. Use upsertConditionRule only. This must remain a pending suggestion for the user to review.`);
          openAIDrawer();
        }} />;
      case 'automations':
        // List → canvas builder → runs, all in-tab. See epic #226, ticket #233.
        // These views' Tooltips (Test button, etc.) relied on the TooltipProvider that
        // MainLayout's SidebarProvider used to supply ambiently on the old standalone
        // routes — re-provide it here now that they're embedded without MainLayout.
        return (
          <TooltipProvider>
            {automationId ? (
              isAutomationRunsView ? <AutomationRuns /> : <AutomationBuilder />
            ) : (
              <Automations />
            )}
          </TooltipProvider>
        );
      default:
        return <PageBuilderTab onOpenPreview={() => setIsPreviewOpen(true)} />;
    }
  }, [activeTab, automationId, isAutomationRunsView, openAIDrawer]);

  if (!formId) {
    return (
      <ErrorState
        title={t('errors.formIdRequired')}
        description={t('errors.formIdRequiredDescription')}
      />
    );
  }

  if (formError) {
    return (
      <ErrorState
        title={t('errors.errorLoadingForm')}
        description={
          formError.message || t('errors.errorLoadingFormDescription')
        }
      />
    );
  }

  if (isLoading || formLoading) {
    const statusTitle = isConnected
      ? t('loading.loadingFormData')
      : t('loading.connectingCollaboration');
    const statusDescription = isConnected
      ? t('loading.loadingFormDataDescription')
      : t('loading.connectingCollaborationDescription');

    return <LoadingState title={statusTitle} description={statusDescription} />;
  }

  return (
    <FormPermissionProvider userPermission={userPermission}>
      <DndContext
        sensors={canEdit ? sensors : []}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={canEdit ? handleDragStart : undefined}
        onDragOver={canEdit ? handleDragOver : undefined}
        onDragEnd={canEdit ? handleDragEnd : undefined}
        onDragCancel={canEdit ? handleDragCancel : undefined}
        autoScroll={{
          threshold: {
            x: 0.2,
            y: 0.2,
          },
          acceleration: 10,
          interval: 5,
        }}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              const item = active.data.current;
              if (item?.type === 'field' && item?.field) {
                const fieldLabel =
                  'label' in item.field ? item.field.label : 'Field';
                return `Picked up ${fieldLabel}. Use arrow keys to move.`;
              }
              if (item?.type === 'page-item' && item?.page) {
                return `Picked up page ${item.page.title}. Use arrow keys to reorder.`;
              }
              return 'Item picked up. Use arrow keys to move.';
            },
            onDragOver({ over }) {
              if (over) {
                const overData = over.data.current;
                if (overData?.type === 'field' && overData?.field) {
                  const overLabel =
                    'label' in overData.field ? overData.field.label : 'field';
                  return `Over ${overLabel}`;
                }
                if (overData?.type === 'page') {
                  return `Over page`;
                }
              }
              return undefined;
            },
            onDragEnd({ active, over }) {
              const item = active.data.current;
              if (!over) {
                return 'Item dropped. Position unchanged.';
              }
              if (item?.type === 'field' && item?.field) {
                const fieldLabel =
                  'label' in item.field ? item.field.label : 'Field';
                return `${fieldLabel} dropped successfully.`;
              }
              if (item?.type === 'page-item' && item?.page) {
                return `Page ${item.page.title} moved successfully.`;
              }
              return 'Item dropped successfully.';
            },
            onDragCancel({ active }) {
              const item = active.data.current;
              if (item?.type === 'field' && item?.field) {
                const fieldLabel =
                  'label' in item.field ? item.field.label : 'Field';
                return `${fieldLabel} move cancelled.`;
              }
              return 'Movement cancelled.';
            },
          },
        }}
      >
        <div
          data-testid="collaborative-form-builder"
          className={`min-h-screen bg-background dark:bg-background ${className || ''}`}
        >
          {/* Mobile — show friendly notice instead of broken canvas */}
          <div className="md:hidden fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-muted">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-primary mb-2">Best on a larger screen</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              The form builder uses drag-and-drop and works best on a desktop or tablet.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
          <div className="flex flex-col h-screen">
            <FormBuilderHeader
              formId={formId}
              formTitle={formData?.form?.title}
              formShortUrl={formData?.form?.shortUrl}
              isPublished={formData?.form?.isPublished}
              organizationId={formData?.form?.organization?.id}
              currentUserId={user?.id}
              isLoading={isLoading}
              isConnected={isConnected}
              onAddPage={() => {}}
              onNavigateBack={handleNavigateBack}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              updateLoading={updateLoading}
              isSettingsOpen={isSettingsOpen}
              onSettingsOpenChange={(open) => (open ? setIsSettingsOpen(true) : handleCloseSettings())}
              centerContent={
                <TabNavigation
                  activeTab={activeTab}
                  buildFieldCount={totalFieldCount}
                  logicHasWarning={logicHasWarning}
                />
              }
            />
            <PreviewOverlay formId={formId} isOpen={isPreviewOpen} onClose={handleClosePreview} />

            {/* P3-17: Collaboration failure banner — shown after MAX_RECONNECT_ATTEMPTS are exhausted */}
            {isCollaborationFailed && !isBannerDismissed && (
              <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 border-b border-orange-200 text-orange-800 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-600" />
                <span className="flex-1">{t('collaboration.syncLostBanner')}</span>
                <button
                  onClick={() => window.location.reload()}
                  className="font-medium underline hover:no-underline"
                >
                  {t('collaboration.syncLostReload')}
                </button>
                <button
                  onClick={() => setIsBannerDismissed(true)}
                  className="ml-2 text-orange-600 hover:text-orange-800"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-hidden relative">
                {renderTabContent()}
                <TabKeyboardShortcuts onTabChange={handleKeyboardTabChange} />
                {/* Unified Ask-AI pill — all three tabs, hidden for VIEWER (AI edits
                    require edit permission). See epic #226 / ticket #232. */}
                {canEdit && (
                  <AskAIPill isOpen={isAIDrawerOpen} onClick={toggleAIDrawer} />
                )}
              </div>
              <AIEditDrawer
                formId={formId!}
                organizationId={formData?.form?.organization?.id ?? ''}
                isOpen={isAIDrawerOpen}
                onClose={() => {
                  setIsAIDrawerOpen(false);
                  setAIInitialMessage(undefined);
                }}
                initialMessage={aiInitialMessage}
                builderContext={builderContext}
              />
            </div>
          </div>

          {activeTab === 'content' && (
            <DragOverlay>{renderDragOverlay}</DragOverlay>
          )}

        </div>
      </DndContext>
    </FormPermissionProvider>
  );
};

export default CollaborativeFormBuilder;
