/**
 * Custom hook for drag-and-drop functionality in the form builder
 * 
 * Handles:
 * - Dragging field types from the sidebar
 * - Reordering fields within a page
 * - Moving fields between pages
 * - Reordering pages
 */

import { useState, useCallback } from 'react';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import type { FormPage } from '@dculus/types';
import { FieldType } from '@dculus/types';

export interface FieldTypeConfig {
  type: FieldType;
  label: string;
  icon?: string;
}

interface UseDragAndDropProps {
  pages: FormPage[];
  onAddField: (pageId: string, fieldType: FieldTypeConfig, insertIndex?: number) => void;
  onReorderFields: (pageId: string, oldIndex: number, newIndex: number) => void;
  onReorderPages: (oldIndex: number, newIndex: number) => void;
  onMoveFieldBetweenPages: (sourcePageId: string, targetPageId: string, fieldId: string, insertIndex?: number) => void;
}

/**
 * Hook to manage drag-and-drop state and handlers
 */
export const useDragAndDrop = ({
  pages,
  onAddField,
  onReorderFields,
  onReorderPages,
  onMoveFieldBetweenPages,
}: UseDragAndDropProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<unknown>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDraggedItem(event.active.data.current);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Handle drag over events for drop indicators
    // Implementation depends on your drop zone logic
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setDraggedItem(null);
      return;
    }

    // Determine what was dragged and where it was dropped
    const dragData = active.data.current as Record<string, unknown>;
    const dropData = over.data.current as Record<string, unknown>;

    // Handle different drag scenarios
    if (dragData?.type === 'field-type' && dropData?.type === 'page') {
      // Adding a new field to a page
      onAddField(dropData.pageId as string, dragData as FieldTypeConfig, dropData.insertIndex as number | undefined);
    } else if (dragData?.type === 'field' && dropData?.type === 'page') {
      // Moving field between pages
      onMoveFieldBetweenPages(
        dragData.pageId as string,
        dropData.pageId as string,
        dragData.fieldId as string,
        dropData.insertIndex as number | undefined
      );
    } else if (dragData?.type === 'field' && dropData?.type === 'field') {
      // Reordering fields within same page
      if (dragData.pageId === dropData.pageId) {
        onReorderFields(
          dragData.pageId as string,
          dragData.index as number,
          dropData.index as number
        );
      }
    } else if (dragData?.type === 'page' && dropData?.type === 'page') {
      // Reordering pages
      onReorderPages(dragData.index as number, dropData.index as number);
    }

    setActiveId(null);
    setDraggedItem(null);
  }, [onAddField, onReorderFields, onReorderPages, onMoveFieldBetweenPages]);

  return {
    activeId,
    draggedItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};
