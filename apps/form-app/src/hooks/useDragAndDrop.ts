import { useState, useCallback } from 'react';
import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { FormField, FormPage } from '@dculus/types';
import { FieldTypeConfig } from '../components/form-builder/FieldTypesPanel';

interface DragState {
  activeId: string | null;
  draggedItem: FieldTypeConfig | FormField | FormPage | null;
}

interface DragHandlers {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

interface UseDragAndDropProps {
  pages: FormPage[];
  onAddField: (pageId: string, fieldType: FieldTypeConfig, insertIndex?: number) => void;
  onReorderFields: (pageId: string, oldIndex: number, newIndex: number) => void;
  onReorderPages: (oldIndex: number, newIndex: number) => void;
}

export const useDragAndDrop = ({
  pages,
  onAddField,
  onReorderFields,
  onReorderPages,
}: UseDragAndDropProps): DragState & DragHandlers => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<FieldTypeConfig | FormField | FormPage | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    if (active.data.current?.fieldType) {
      setDraggedItem(active.data.current.fieldType);
    } else if (active.data.current?.field) {
      setDraggedItem(active.data.current.field);
    } else if (active.data.current?.page) {
      setDraggedItem(active.data.current.page);
    } else if (active.data.current?.type === 'page-item') {
      setDraggedItem(active.data.current.page);
    }
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Handle drag over logic if needed
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedItem(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle field type drops
    if (activeData?.type === 'field-type') {
      let pageId: string | null = null;
      let insertIndex: number | undefined = undefined;
      
      if (overData?.type === 'page') {
        pageId = overData.pageId as string;
        const page = pages.find(p => p.id === pageId);
        insertIndex = page ? page.fields.length : undefined;
      } else if (overData?.type === 'field') {
        pageId = overData.pageId as string;
        const page = pages.find(p => p.id === pageId);
        if (page) {
          const fieldIndex = page.fields.findIndex(f => f.id === over.id);
          insertIndex = fieldIndex !== -1 ? fieldIndex : undefined;
        }
      }
      
      if (pageId && activeData.fieldType) {
        onAddField(pageId, activeData.fieldType, insertIndex);
      } else {
        console.warn('Failed to drop field - missing pageId or fieldType');
      }
      return;
    }

    // Handle field reordering within the same page
    if (activeData?.type === 'field' && overData?.type === 'field') {
      const activeField = activeData.field;
      const overField = overData.field;
      const activePageId = activeData.pageId;
      const overPageId = overData.pageId;

      // Only allow reordering within the same page
      if (activePageId === overPageId && activeField.id !== overField.id) {
        const page = pages.find(p => p.id === activePageId);
        if (page && page.fields.length > 1) {
          const oldIndex = page.fields.findIndex(f => f.id === activeField.id);
          const newIndex = page.fields.findIndex(f => f.id === overField.id);
          
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            console.log(`Field reorder: moving field from index ${oldIndex} to ${newIndex} in page ${activePageId}`);
            onReorderFields(activePageId, oldIndex, newIndex);
          }
        }
      }
      return;
    }

    // Handle field dropped on empty page area (move to end)
    if (activeData?.type === 'field' && overData?.type === 'page') {
      const activeField = activeData.field;
      const activePageId = activeData.pageId;
      const overPageId = overData.pageId;

      if (activePageId === overPageId) {
        const page = pages.find(p => p.id === activePageId);
        if (page && page.fields.length > 1) {
          const oldIndex = page.fields.findIndex(f => f.id === activeField.id);
          const newIndex = page.fields.length - 1;
          
          if (oldIndex !== -1 && oldIndex !== newIndex) {
            console.log(`Field move to end: moving field from index ${oldIndex} to ${newIndex} in page ${activePageId}`);
            onReorderFields(activePageId, oldIndex, newIndex);
          }
        }
      }
      return;
    }

    // Handle page reordering (using sortable context)
    if (activeData?.type === 'page-item' && overData?.type === 'page-item') {
      const activePage = activeData.page;
      const overPage = overData.page;
      
      if (activePage.id !== overPage.id) {
        const oldIndex = pages.findIndex(p => p.id === activePage.id);
        const newIndex = pages.findIndex(p => p.id === overPage.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          console.log(`Page reorder: moving page from index ${oldIndex} to ${newIndex}`);
          onReorderPages(oldIndex, newIndex);
        }
      }
    }
  }, [pages, onAddField, onReorderFields, onReorderPages]);

  return {
    activeId,
    draggedItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};