import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
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
  LayoutTab,
  PageBuilderTab,
  PreviewTab,
  type BuilderTab,
} from '../components/form-builder/tabs';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useCollisionDetection } from '../hooks/useCollisionDetection';
import { useFieldCreation } from '../hooks/useFieldCreation';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { UPDATE_FORM } from '../graphql/mutations';
import AIEditDrawer from '../components/form-builder/AIEditDrawer';

interface CollaborativeFormBuilderProps {
  className?: string;
}

const VALID_TABS: readonly BuilderTab[] = [
  'layout',
  'page-builder',
  'preview',
] as const;
const DEFAULT_TAB: BuilderTab = 'page-builder';

const CollaborativeFormBuilder: React.FC<CollaborativeFormBuilderProps> = ({
  className,
}) => {
  const { formId, tab } = useParams<{ formId: string; tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pendingBgApplied = useRef(false);
  const { t } = useTranslation('collaborativeFormBuilder');
  const { user } = useAuthContext();
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);

  const aiMessageParam = searchParams.get('aiMessage');
  const [aiInitialMessage, setAIInitialMessage] = useState<string | undefined>(
    aiMessageParam ? decodeURIComponent(aiMessageParam) : undefined
  );

  const activeTab: BuilderTab = useMemo(() => {
    return tab && VALID_TABS.includes(tab as BuilderTab)
      ? (tab as BuilderTab)
      : DEFAULT_TAB;
  }, [tab]);

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery<any, any>(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
    errorPolicy: 'all',
  });

  const [updateForm, { loading: updateLoading }] = useMutation(UPDATE_FORM);

  const {
    isConnected,
    isLoading,
    isCollaborationFailed,
    pages,
    selectedPageId,

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
  } = useFormBuilderStore();

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

  const redirectToDefaultTab = useCallback(() => {
    if (formId && !tab) {
      navigate(`/dashboard/form/${formId}/builder/${DEFAULT_TAB}`, {
        replace: true,
      });
    }
  }, [formId, tab, navigate]);

  const handleKeyboardTabChange = useCallback(
    (newTab: BuilderTab) => {
      if (formId) {
        navigate(`/dashboard/form/${formId}/builder/${newTab}`);
      }
    },
    [formId, navigate]
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
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPage(pages[0].id);
    }
  }, [pages, selectedPageId, setSelectedPage]);

  useEffect(() => {
    redirectToDefaultTab();
  }, [redirectToDefaultTab]);

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
        setIsAIDrawerOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-open the AI drawer when navigated here with an aiMessage query param
  // (e.g. from "Fix with AI" in FieldAnalyticsViewer).
  // Empty deps array is intentional: we only want this to fire once on mount.
  useEffect(() => {
    if (aiMessageParam) {
      setIsAIDrawerOpen(true);
    }
  }, []);

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
      case 'layout':
        return <LayoutTab onLayoutChange={updateLayout} />;
      case 'page-builder':
        return <PageBuilderTab />;
      case 'preview':
        return <PreviewTab formId={formId || ''} />;
      default:
        return <PageBuilderTab />;
    }
  }, [activeTab, formId, updateLayout]);

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

  // Get user permission from form data, default to VIEWER if not available
  const userPermission =
    (formData?.form?.userPermission as PermissionLevel) || 'VIEWER';
  const canEdit = userPermission === 'OWNER' || userPermission === 'EDITOR';

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
              isAIDrawerOpen={isAIDrawerOpen}
              onToggleAIDrawer={() => setIsAIDrawerOpen((prev) => !prev)}
              centerContent={
                <TabNavigation
                  activeTab={activeTab}
                  isConnected={isConnected}
                  collaboratorCount={0}
                  position="inline"
                />
              }
            />

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
              />
            </div>
          </div>

          {activeTab === 'page-builder' && (
            <DragOverlay>{renderDragOverlay}</DragOverlay>
          )}
        </div>
      </DndContext>
    </FormPermissionProvider>
  );
};

export default CollaborativeFormBuilder;
