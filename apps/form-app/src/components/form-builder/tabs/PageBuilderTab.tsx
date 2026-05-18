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
  type DragStartEvent,
  type DragEndEvent,
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
        setTimeout(() => setRecentlyDroppedFieldId(null), 2000);
      }
    }, 80);
  };

  // Configure sensors - require slight movement before drag starts
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement to start drag
      },
    })
  );

  // Auto-scroll to recently dropped field for better UX
  useEffect(() => {
    if (recentlyDroppedFieldId) {
      // Delay scroll until after expansion completes (400ms expansion + 100ms buffer)
      const scrollTimeout = setTimeout(() => {
        const fieldElement = document.querySelector(
          `[data-testid="field-${recentlyDroppedFieldId}"]`
        );

        if (fieldElement) {
          fieldElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
      }, 500); // Scroll after expansion completes

      return () => clearTimeout(scrollTimeout);
    }
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
        let targetIndex = over.data.current.insertIndex as number;

        if (sourcePageId === targetPageId) {
          // Same page - reorder
          if (targetIndex > sourceIndex) {
            targetIndex = targetIndex - 1;
          }

          if (sourceIndex !== targetIndex) {
            console.log(
              `Reordering field from ${sourceIndex} to ${targetIndex}`
            );
            reorderFields(sourcePageId, sourceIndex, targetIndex);
          }
        } else {
          // Cross-page move
          console.log(
            `Moving field ${droppedFieldId} from page ${sourcePageId} to page ${targetPageId} at index ${targetIndex}`
          );
          moveFieldBetweenPages(
            sourcePageId,
            targetPageId,
            droppedFieldId,
            targetIndex
          );
        }
      }

      // Set highlight and clear state after delay
      if (droppedFieldId) {
        setRecentlyDroppedFieldId(droppedFieldId);
        setTimeout(() => setRecentlyDroppedFieldId(null), 2000); // Keep highlight for 2s
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
          console.log(
            `Inserting field ${fieldTypeConfig.type} at index ${insertIndex} in page ${targetPageId}`
          );
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
          console.log(
            `Adding field ${fieldTypeConfig.type} to end of page ${targetPageId}`
          );
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

  return (
    <DndContext
      sensors={canEdit ? sensors : []}
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
        />

        {/* Right: Field Settings with Resizable Width */}
        <RightSidebar width={sidebarWidth} onWidthChange={setSidebarWidth} />
      </div>

      {/* Drag Overlay - follows cursor during drag */}
      <DragOverlay dropAnimation={null}>
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
