import React, { useMemo, useState, useEffect } from 'react';
import {
  FieldType,
  FormField,
  FormLayout,
  FormSchema,
  LayoutCode,
  DEFAULT_THANK_YOU_CONTENT,
  isLayoutField,
  nodeAnchorForVisualIndex,
  pageHasGrid,
} from '@dculus/types';
import { FormRenderer } from '@dculus/ui';
import { Columns2 } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFieldCreation } from '../../../hooks/useFieldCreation';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  type DragStartEvent,
  type DragEndEvent,
  type MeasuringConfiguration,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useBuilderSelectionUrlSync } from '../../../hooks/useBuilderSelectionUrlSync';
import { getCdnEndpoint, isGridLayoutEnabled } from '../../../lib/config';
import { GridLayoutFlagContext } from '../../../contexts/GridLayoutFlagContext';
import { RendererMode, cn } from '@dculus/utils';
import { FieldTypeDisplay, type FieldTypeConfig } from '../FieldTypesPanel';
import { FieldLibrary } from '../field-library/FieldLibrary';
import { recordRecentFieldType } from '../field-library/fieldLibraryStorage';
import { JourneyRail } from '../rail/JourneyRail';
import { FieldCard } from './PageBuilderFieldCard';
import { FormArea } from './PageBuilderFormArea';
import { RightSidebar } from './PageBuilderSidebar';
import { CanvasToolbar, type CanvasDevice } from '../CanvasToolbar';
import { QuizSummaryStrip } from '../QuizSummaryStrip';
import { useQuizMode } from '../../../contexts/QuizModeContext';
import { computeQuizSummary } from '../../../utils/quizGrading';
import { DesignDrawer } from '../design/DesignDrawer';
import { MOBILE_CANVAS_CSS } from '../shared/mobileCanvasStyles';
import { createGridAwareCollision } from './gridCollision';
import type { GridTarget } from '../../../store/types/store.types';

// Use pointerWithin as the primary collision detection so that the tiny
// DropIndicator gap zones (2–8px tall) win over the large field cards.
// Fallback to rectIntersection for sidebar-to-form-area drops where the
// cursor may not be within any droppable but is close enough to one.
// The grid wrapper is the identity when no grid column is on screen (§8.4).
const collisionDetectionStrategy = createGridAwareCollision();

/**
 * Grid forms re-measure droppables while dragging: cards collapse right after drag start, which
 * moves the column slots, and dnd-kit otherwise keeps the rects it measured at drag start.
 */
const GRID_PAGE_MEASURING: MeasuringConfiguration = {
  droppable: { strategy: MeasuringStrategy.Always, frequency: 100 },
};

// =============================================================================
// Main Component
// =============================================================================

interface PageBuilderTabProps {
  /** Opens the full-screen PreviewOverlay — lifted from CollaborativeFormBuilder
   * so the ▶ Preview button can live in the canvas toolbar instead of the header. */
  onOpenPreview?: () => void;
}

/**
 * PageBuilderTab - Reimplemented page builder with stable drag-and-drop
 */
export const PageBuilderTab: React.FC<PageBuilderTabProps> = ({
  onOpenPreview,
}) => {
  // Two-way ?screen=…&field=… <-> selection sync for the journey rail. Mounted here
  // since PageBuilderTab is the Content workspace (rail + canvas + sidebar).
  useBuilderSelectionUrlSync();

  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const canEditLayout = permissions.canEditLayout();

  // Canvas toolbar state: 🎨 Design drawer open/closed, desktop/mobile device frame.
  const [isDesignDrawerOpen, setIsDesignDrawerOpen] = useState(false);
  const [device, setDevice] = useState<CanvasDevice>('desktop');
  // Track the currently dragged field type (from sidebar)
  const [activeFieldType, setActiveFieldType] =
    useState<FieldTypeConfig | null>(null);

  // Track the currently dragged existing field (for reordering)
  const [activeField, setActiveField] = useState<{
    field: FormField;
    index: number;
    pageId: string;
    isGrid?: boolean;
  } | null>(null);

  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(320);

  // Track recently dropped field for highlight animation
  const [recentlyDroppedFieldId, setRecentlyDroppedFieldId] = useState<
    string | null
  >(null);

  // Delay compact view exit after drop
  const [isDelayingExpansion, setIsDelayingExpansion] = useState(false);

  // Get store actions including cross-page operations
  const {
    addField,
    addFieldAtIndex,
    reorderFields,
    reorderPages,
    moveFieldBetweenPages,
    addFieldToGrid,
    placeField,
    pages,
    setSelectedField,
    selection,
    layout,
    formId,
    updateLayout,
  } = useFormBuilderStore();

  const cdnEndpoint = getCdnEndpoint();
  const { t: tGrid } = useTranslation('gridLayout');

  // Grid-less forms keep dnd-kit's default measuring
  const formHasGrid = useMemo(
    () => (pages || []).some((page) => pageHasGrid(page.fields)),
    [pages]
  );

  // Quiz summary strip — only computed/rendered when quiz mode is on for this form
  // (additive guarantee, GitHub epic #289). With no QuizModeProvider or
  // `settings.quiz?.enabled` false, `isQuizModeEnabled` is false and neither the
  // summary computation nor the strip render, same as before Story 08 shipped.
  const { enabled: isQuizModeEnabled } = useQuizMode();
  const quizSummary = useMemo(
    () => (isQuizModeEnabled ? computeQuizSummary(pages || []) : null),
    [isQuizModeEnabled, pages]
  );

  const handleLayoutUpdate = (updates: Partial<FormLayout>) => {
    if (canEditLayout) updateLayout(updates);
  };

  const handleLayoutSelect = (code: LayoutCode) => handleLayoutUpdate({ code });

  // Same formSchema shape PreviewTab builds for its FormRenderer preview — kept in
  // sync here so intro/thankYou rail selections render the exact same screens.
  const formSchema: FormSchema = useMemo(
    () => ({
      pages: pages || [],
      layout: layout || {
        code: 'L1',
        theme: 'light' as const,
        textColor: '#1f2937',
        spacing: 'normal' as const,
        content: '<h1>Form Preview</h1>',
        thankYouContent: DEFAULT_THANK_YOU_CONTENT,
        customBackGroundColor: '',
        backgroundImageKey: '',
        pageMode: 'multipage' as const,
      },
      isShuffleEnabled: false,
    }),
    [pages, layout]
  );

  const { createFieldData } = useFieldCreation();

  const getPageFieldIdSet = (pageId: string): Set<string> => {
    const page = useFormBuilderStore
      .getState()
      .pages.find((p) => p.id === pageId);
    return new Set(page?.fields.map((field) => field.id) ?? []);
  };

  const highlightNewField = (
    pageId: string,
    previousFieldIds: Set<string>,
    fallbackIndex?: number
  ) => {
    setTimeout(() => {
      const currentPage = useFormBuilderStore
        .getState()
        .pages.find((p) => p.id === pageId);
      if (!currentPage) return;

      const newlyAddedField = currentPage.fields.find(
        (field) => !previousFieldIds.has(field.id)
      );
      const fallbackField =
        fallbackIndex !== undefined
          ? currentPage.fields[fallbackIndex]
          : undefined;
      const fieldToHighlight = newlyAddedField || fallbackField;

      if (fieldToHighlight) {
        setRecentlyDroppedFieldId(fieldToHighlight.id);
        setSelectedField(fieldToHighlight.id);
        setTimeout(() => setRecentlyDroppedFieldId(null), 2000);
      }
    }, 80);
  };

  // Configure sensors - require slight movement before drag starts. KeyboardSensor
  // gives the rail's sortable pages/chips a keyboard-accessible reorder path
  // (Space to pick up, arrow keys to move, Space/Enter to drop) — same pattern as
  // the outer DndContext in CollaborativeFormBuilder.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Smooth spring drop animation
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: '0.4' },
      },
    }),
    duration: 200,
    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
  };

  // True while a drag is in flight (including the post-drop expansion delay)
  const isAnyDragActive = !!(activeField || activeFieldType) || isDelayingExpansion;

  // Auto-scroll to recently dropped field after expansion completes.
  // Fires at 750ms: 400ms (expansion delay) + 300ms (CSS transition) + 50ms buffer.
  // Scrolling earlier means fields above the target are still growing and will push
  // it out of view before the animation settles.
  useEffect(() => {
    if (!recentlyDroppedFieldId) return;

    const scrollTimeout = setTimeout(() => {
      const fieldElement = document.querySelector(
        `[data-testid="draggable-field-${recentlyDroppedFieldId}"]`
      );
      fieldElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }, 750);

    return () => clearTimeout(scrollTimeout);
  }, [recentlyDroppedFieldId]);

  // Handle drag start - store the active dragged item
  const handleDragStart = (event: DragStartEvent) => {
    if (!canEdit) return;
    const { active } = event;
    if (active.data.current?.type === 'field-type') {
      setActiveFieldType(active.data.current.fieldType as FieldTypeConfig);
    } else if (active.data.current?.type === 'existing-field') {
      setActiveField({
        field: active.data.current.field as FormField,
        index: active.data.current.index as number,
        pageId: active.data.current.pageId as string,
        isGrid: active.data.current.isGrid === true,
      });
    }
  };

  const finishDrop = (delay = 400) => {
    setTimeout(() => {
      setActiveFieldType(null);
      setActiveField(null);
      setIsDelayingExpansion(false);
    }, delay);
  };

  const highlightField = (fieldId: string) => {
    setRecentlyDroppedFieldId(fieldId);
    setSelectedField(fieldId);
    setTimeout(() => setRecentlyDroppedFieldId(null), 2000);
  };

  /**
   * Drops onto a grid column slot or column body (§8.4). Returns true when the drop was handled,
   * including a rejected one (a grid never goes into a grid).
   */
  const handleGridDrop = (event: DragEndEvent): boolean => {
    const { active, over } = event;
    const overData = over?.data.current;
    if (overData?.type !== 'grid-slot' && overData?.type !== 'grid-column') return false;

    const targetPageId = overData.pageId as string;
    const target: GridTarget = {
      gridId: overData.gridId as string,
      column: overData.column as number,
      beforeFieldId: (overData.beforeFieldId as string | null | undefined) ?? null,
    };
    const dragType = active.data.current?.type;

    if (dragType === 'field-type') {
      const fieldTypeConfig = active.data.current?.fieldType as FieldTypeConfig | undefined;
      if (fieldTypeConfig && fieldTypeConfig.type !== FieldType.GRID_FIELD) {
        const newId = addFieldToGrid(
          targetPageId,
          fieldTypeConfig.type,
          createFieldData(fieldTypeConfig),
          target
        );
        recordRecentFieldType(fieldTypeConfig.type);
        if (newId) setTimeout(() => highlightField(newId), 80);
      }
      return true;
    }

    if (dragType === 'existing-field') {
      const field = active.data.current?.field as FormField | undefined;
      const sourcePageId = active.data.current?.pageId as string;
      if (!field || active.data.current?.isGrid || isLayoutField(field)) return true;
      if (target.beforeFieldId === field.id) return true;
      if (sourcePageId !== targetPageId) {
        moveFieldBetweenPages(sourcePageId, targetPageId, field.id);
      }
      if (placeField({ pageId: targetPageId, fieldId: field.id, target })) highlightField(field.id);
      return true;
    }
    return false;
  };

  // Handle drag end - add field, reorder, or move between pages
  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit) return;
    const { active, over } = event;

    // Track which field was dropped for highlighting
    let droppedFieldId: string | null = null;

    // Start delayed expansion
    setIsDelayingExpansion(true);

    // Check if we have a valid drop target
    if (!over) {
      // No valid drop - clear expansion delay after a short time
      setTimeout(() => {
        setActiveFieldType(null);
        setActiveField(null);
        setIsDelayingExpansion(false);
      }, 300);
      return;
    }

    const dragType = active.data.current?.type;

    if (handleGridDrop(event)) {
      finishDrop();
      return;
    }

    // Handle page reordering
    if (dragType === 'page-item') {
      if (active.id !== over.id) {
        const oldIndex = pages.findIndex((p) => p.id === active.id);
        const newIndex = pages.findIndex((p) => p.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          reorderPages(oldIndex, newIndex);
        }
      }
      // Clear state and exit expansion delay
      setTimeout(() => {
        setActiveFieldType(null);
        setActiveField(null);
        setIsDelayingExpansion(false);
      }, 300);
      return;
    }

    // Handle existing-field reordering and cross-page moves
    if (dragType === 'existing-field') {
      const sourceIndex = active.data.current?.index as number;
      const sourcePageId = active.data.current?.pageId as string;
      droppedFieldId = active.data.current?.field?.id as string;

      // Dropped on a field-insert zone
      if (over.data.current?.type === 'field-insert') {
        const targetPageId = over.data.current.pageId as string;
        const sourcePage = pages.find((p) => p.id === sourcePageId);

        // Same-page move on a page with a grid: place relative to a top-level node, since the
        // single-item index adjustment below is wrong for grid blocks and grid children (§8.4).
        if (sourcePageId === targetPageId && sourcePage && pageHasGrid(sourcePage.fields)) {
          const beforeNodeId =
            over.data.current.beforeNodeId !== undefined
              ? (over.data.current.beforeNodeId as string | null)
              : nodeAnchorForVisualIndex(sourcePage.fields, over.data.current.insertIndex as number)
                  .beforeNodeId;
          if (beforeNodeId !== droppedFieldId) {
            placeField({ pageId: sourcePageId, fieldId: droppedFieldId, target: { beforeNodeId } });
          }
          highlightField(droppedFieldId);
          finishDrop();
          return;
        }

        // insertIndex is a SLOT index (0 = before first field, N = after last field).
        // reorderFields expects a FINAL ELEMENT position (0 to N-1) in the resulting array.
        //
        // Conversion: when the dragged field is removed, all slots ABOVE the source shift
        // left by one, so for downward drops the target slot is one lower in element terms.
        //   insertIndex > sourceIndex  →  finalPos = insertIndex - 1
        //   insertIndex <= sourceIndex →  finalPos = insertIndex
        //
        // The last slot (insertIndex = N = fields.length) correctly maps to N-1 via this
        // formula, keeping toRawIndex in-bounds for every drop position.
        const insertIndex = over.data.current.insertIndex as number;
        const finalPos = insertIndex > sourceIndex ? insertIndex - 1 : insertIndex;

        if (sourcePageId === targetPageId) {
          reorderFields(sourcePageId, sourceIndex, finalPos);
        } else {
          // Cross-page move — insertIndex is an insertion slot in the target page, valid as-is
          moveFieldBetweenPages(
            sourcePageId,
            targetPageId,
            droppedFieldId,
            insertIndex
          );
        }
      }

      // Highlight, select, and scroll to the dropped field
      if (droppedFieldId) {
        setRecentlyDroppedFieldId(droppedFieldId);
        setSelectedField(droppedFieldId);
        setTimeout(() => setRecentlyDroppedFieldId(null), 2000);
      }

      setTimeout(() => {
        setActiveFieldType(null);
        setActiveField(null);
        setIsDelayingExpansion(false);
      }, 400); // 400ms delay before expansion
      return;
    }

    // Handle new field-type drops
    if (dragType === 'field-type') {
      const fieldTypeConfig = active.data.current?.fieldType as FieldTypeConfig;

      // Check if dropping onto a field-insert zone (between fields)
      if (over.data.current?.type === 'field-insert') {
        const targetPageId = over.data.current.pageId as string;
        const insertIndex = over.data.current.insertIndex as number;

        if (targetPageId && fieldTypeConfig) {
          const previousFieldIds = getPageFieldIdSet(targetPageId);
          const fieldData = createFieldData(fieldTypeConfig);
          addFieldAtIndex(
            targetPageId,
            fieldTypeConfig.type,
            fieldData,
            insertIndex
          );
          recordRecentFieldType(fieldTypeConfig.type);

          highlightNewField(targetPageId, previousFieldIds, insertIndex);
        }

        setTimeout(() => {
          setActiveFieldType(null);
          setActiveField(null);
          setIsDelayingExpansion(false);
        }, 400);
        return;
      }

      // Check if dropping onto the form area (append to end)
      if (over.data.current?.type === 'form-area') {
        const targetPageId = over.data.current.pageId as string;

        if (targetPageId && fieldTypeConfig) {
          const previousFieldIds = getPageFieldIdSet(targetPageId);
          const fieldData = createFieldData(fieldTypeConfig);
          addField(targetPageId, fieldTypeConfig.type, fieldData);
          recordRecentFieldType(fieldTypeConfig.type);

          const fallbackIndex = previousFieldIds.size;
          highlightNewField(targetPageId, previousFieldIds, fallbackIndex);
        }

        setTimeout(() => {
          setActiveFieldType(null);
          setActiveField(null);
          setIsDelayingExpansion(false);
        }, 400);
      }
    }

    // Fallback: clear state after delay
    setTimeout(() => {
      setActiveFieldType(null);
      setActiveField(null);
      setIsDelayingExpansion(false);
    }, 400);
  };

  // Handle drag cancel (e.g. Escape) - reset immediately, there is no drop to animate
  const handleDragCancel = () => {
    setActiveFieldType(null);
    setActiveField(null);
    setIsDelayingExpansion(false);
  };

  return (
    <GridLayoutFlagContext.Provider value={isGridLayoutEnabled()}>
      <DndContext
        sensors={canEdit ? sensors : []}
        collisionDetection={collisionDetectionStrategy}
        measuring={formHasGrid ? GRID_PAGE_MEASURING : undefined}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex h-full" data-testid="new-page-builder-tab">
          {/* Journey rail: the respondent's journey — Intro / Pages / Thank You */}
          <JourneyRail />

          {/* Docked Field Library — only rendered while pinned; unpinned it lives in
              the rail's "+ Add content" mega-panel popover instead. */}
          <FieldLibrary mode="docked" />

          {/* Center: Canvas with toolbar */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <CanvasToolbar
              onOpenDesign={() => setIsDesignDrawerOpen(true)}
              device={device}
              onDeviceChange={setDevice}
              onOpenPreview={() => onOpenPreview?.()}
            />

            {quizSummary && <QuizSummaryStrip summary={quizSummary} />}

            <div
              className={cn(
                'flex-1 overflow-hidden min-h-0',
                device === 'mobile' && 'flex justify-center overflow-y-auto py-6 bg-[var(--tf-faint)]'
              )}
            >
              {device === 'mobile' && <style dangerouslySetInnerHTML={{ __html: MOBILE_CANVAS_CSS }} />}
              <div
                className={cn(
                  'h-full',
                  device === 'mobile' &&
                    'mobile-preview w-[390px] shrink-0 overflow-y-auto rounded-[32px] border-[10px] border-[#1c1c1e] shadow-2xl bg-white'
                )}
              >
                {selection.kind === 'intro' || selection.kind === 'thankYou' ? (
                  <FormRenderer
                    formSchema={formSchema}
                    className="h-full"
                    cdnEndpoint={cdnEndpoint}
                    mode={RendererMode.BUILDER}
                    formId={formId || ''}
                    onLayoutChange={updateLayout}
                    screenOverride={selection.kind === 'intro' ? 'intro' : 'thankYou'}
                  />
                ) : (
                  <FormArea
                    recentlyDroppedFieldId={recentlyDroppedFieldId}
                    isDelayingExpansion={isDelayingExpansion}
                    isAnyDragActive={isAnyDragActive}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right: Field Settings with Resizable Width */}
          <RightSidebar width={sidebarWidth} onWidthChange={setSidebarWidth} />
        </div>

        <DesignDrawer
          isOpen={isDesignDrawerOpen}
          onClose={() => setIsDesignDrawerOpen(false)}
          layout={layout}
          formId={formId || ''}
          canEditLayout={canEditLayout}
          onLayoutSelect={handleLayoutSelect}
          onLayoutUpdate={handleLayoutUpdate}
        />

        {/* Drag Overlay - follows cursor during drag */}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeFieldType && (
            <div className="w-72">
              <FieldTypeDisplay fieldType={activeFieldType} isOverlay />
            </div>
          )}
          {activeField && activeField.isGrid && (
            <div
              className="w-[320px] pointer-events-none opacity-90 flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-card shadow-lg"
              style={{ border: '1px dashed rgba(81,76,84,0.35)' }}
            >
              <Columns2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-[#3c323e] dark:text-white">
                {tGrid('block.moving')}
              </span>
            </div>
          )}
          {activeField && !activeField.isGrid && (
            <div className="w-[400px] pointer-events-none opacity-90">
              <FieldCard
                field={activeField.field}
                pageId={activeField.pageId}
                index={activeField.index}
                totalFields={1}
                pages={[]}
                isDragging={true}
                isAnyDragActive={true}
                dragHandleProps={{}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </GridLayoutFlagContext.Provider>
  );
};

export default PageBuilderTab;
