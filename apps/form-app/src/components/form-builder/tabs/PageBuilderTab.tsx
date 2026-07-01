import React, { useState, useEffect } from 'react';
import { FormField } from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFieldCreation } from '../../../hooks/useFieldCreation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  type DropAnimation,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import {
  FieldTypesPanel,
  FieldTypeDisplay,
  type FieldTypeConfig,
} from '../FieldTypesPanel';
import { FieldCard } from './PageBuilderFieldCard';
import { FormArea } from './PageBuilderFormArea';
import { RightSidebar } from './PageBuilderSidebar';

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * LeftSidebar - Shows available field types using shared FieldTypesPanel
 */
const LeftSidebar: React.FC = () => {
  return (
    <div className="w-72 bg-white dark:bg-card" style={{ borderRight: '1px solid var(--tf-border)' }}>
      <FieldTypesPanel />
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * PageBuilderTab - Reimplemented page builder with stable drag-and-drop
 */
export const PageBuilderTab: React.FC = () => {
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  // Track the currently dragged field type (from sidebar)
  const [activeFieldType, setActiveFieldType] =
    useState<FieldTypeConfig | null>(null);

  // Track the currently dragged existing field (for reordering)
  const [activeField, setActiveField] = useState<{
    field: FormField;
    index: number;
    pageId: string;
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
    pages,
    setSelectedField,
  } = useFormBuilderStore();

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

  // Configure sensors - require slight movement before drag starts
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
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
      });
    }
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

  // Use pointerWithin as the primary collision detection so that the tiny
  // DropIndicator gap zones (2–8px tall) win over the large field cards.
  // Fallback to rectIntersection for sidebar-to-form-area drops where the
  // cursor may not be within any droppable but is close enough to one.
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  };

  return (
    <DndContext
      sensors={canEdit ? sensors : []}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full" data-testid="new-page-builder-tab">
        {/* Left: Field Types */}
        <LeftSidebar />

        {/* Center: Form Area */}
        <FormArea
          recentlyDroppedFieldId={recentlyDroppedFieldId}
          isDelayingExpansion={isDelayingExpansion}
          isAnyDragActive={isAnyDragActive}
        />

        {/* Right: Field Settings with Resizable Width */}
        <RightSidebar width={sidebarWidth} onWidthChange={setSidebarWidth} />
      </div>

      {/* Drag Overlay - follows cursor during drag */}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeFieldType && (
          <div className="w-72">
            <FieldTypeDisplay fieldType={activeFieldType} isOverlay />
          </div>
        )}
        {activeField && (
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
  );
};

export default PageBuilderTab;
