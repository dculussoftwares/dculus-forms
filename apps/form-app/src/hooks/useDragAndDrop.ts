import { useState, useCallback } from 'react';
import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { FormField, FormPage } from '@dculus/types';
import { FieldTypeConfig } from '../components/form-builder/FieldTypesPanel';

interface DragState {
  activeId: string | null;
  draggedItem: FieldTypeConfig | FormField | FormPage | null;
  localFieldOrder: Record<string, FormField[]>;
}

interface DragHandlers {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

interface UseDragAndDropProps {
  pages: FormPage[];
  onAddField: (pageId: string, fieldType: FieldTypeConfig, insertIndex?: number) => void;
  onReorderFields: (pageId: string, oldIndex: number, newIndex: number) => void;
  onReorderPages: (oldIndex: number, newIndex: number) => void;
  onMoveFieldBetweenPages: (sourcePageId: string, targetPageId: string, fieldId: string, insertIndex?: number) => void;
}

export const useDragAndDrop = ({
  pages,
  onAddField,
  onReorderFields,
  onReorderPages,
  onMoveFieldBetweenPages,
}: UseDragAndDropProps): DragState & DragHandlers => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<FieldTypeConfig | FormField | FormPage | null>(null);
  
  // Phase 1A: Shadow state for local field reordering during drag
  // This map stores temporary field order per page while dragging
  // Structure: { [pageId: string]: FormField[] }
  const [localFieldOrder, setLocalFieldOrder] = useState<Record<string, FormField[]>>({});

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    if (active.data.current?.fieldType) {
      setDraggedItem(active.data.current.fieldType);
    } else if (active.data.current?.field) {
      setDraggedItem(active.data.current.field);
      
      // Initialize shadow state with current page field order
      const pageId = active.data.current.pageId as string;
      const currentPage = pages.find(p => p.id === pageId);
      if (currentPage) {
        setLocalFieldOrder({
          [pageId]: [...currentPage.fields]
        });
      }
    } else if (active.data.current?.page) {
      setDraggedItem(active.data.current.page);
    } else if (active.data.current?.type === 'page-item') {
      setDraggedItem(active.data.current.page);
    }
  }, [pages]);

  // Phase 1B: Real-time drag over handler for local preview
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over || !active.data.current) return;
    
    const activeData = active.data.current;
    const overData = over.data.current;
    
    // Only handle field reordering (not field types from sidebar, not pages)
    if (activeData?.type !== 'field') return;
    
    const activeField = activeData.field as FormField;
    const activePageId = activeData.pageId as string;
    
    // Handle drag over another field
    if (overData?.type === 'field') {
      const overPageId = overData.pageId as string;
      const targetPage = pages.find(p => p.id === overPageId);
      
      if (!targetPage) return;
      
      // Find indices
      const overIndex = targetPage.fields.findIndex(f => f.id === over.id);
      if (overIndex === -1) return;
      
      // Same page reordering
      if (activePageId === overPageId) {
        const currentOrder = localFieldOrder[activePageId] || [...targetPage.fields];
        const activeIndex = currentOrder.findIndex(f => f.id === activeField.id);
        
        if (activeIndex === -1 || activeIndex === overIndex) return;
        
        // Create new order with field moved to hover position
        const newOrder = [...currentOrder];
        newOrder.splice(activeIndex, 1); // Remove from old position
        newOrder.splice(overIndex, 0, activeField); // Insert at new position
        
        setLocalFieldOrder({
          [activePageId]: newOrder
        });
      } else {
        // Cross-page move: update both source and target pages
        const sourcePage = pages.find(p => p.id === activePageId);
        if (!sourcePage) return;
        
        const sourceOrder = localFieldOrder[activePageId] || [...sourcePage.fields];
        const targetOrder = localFieldOrder[overPageId] || [...targetPage.fields];
        
        // Remove from source
        const newSourceOrder = sourceOrder.filter(f => f.id !== activeField.id);
        
        // Add to target at hover position
        const newTargetOrder = [...targetOrder];
        if (!newTargetOrder.some(f => f.id === activeField.id)) {
          newTargetOrder.splice(overIndex, 0, activeField);
        }
        
        setLocalFieldOrder({
          [activePageId]: newSourceOrder,
          [overPageId]: newTargetOrder
        });
      }
    }
    // Handle drag over empty page area or page container
    else if (overData?.type === 'page' || overData?.type === 'page-item') {
      const overPageId = overData?.type === 'page-item' ? overData.page?.id : overData.pageId;
      if (!overPageId) return;
      
      const targetPage = pages.find(p => p.id === overPageId);
      if (!targetPage) return;
      
      // Same page - move to end
      if (activePageId === overPageId) {
        const currentOrder = localFieldOrder[activePageId] || [...targetPage.fields];
        const activeIndex = currentOrder.findIndex(f => f.id === activeField.id);
        
        if (activeIndex === -1) return;
        
        // Only update if not already at end
        if (activeIndex !== currentOrder.length - 1) {
          const newOrder = [...currentOrder];
          newOrder.splice(activeIndex, 1);
          newOrder.push(activeField);
          
          setLocalFieldOrder({
            [activePageId]: newOrder
          });
        }
      } else {
        // Cross-page - move to end of target page
        const sourcePage = pages.find(p => p.id === activePageId);
        if (!sourcePage) return;
        
        const sourceOrder = localFieldOrder[activePageId] || [...sourcePage.fields];
        const targetOrder = localFieldOrder[overPageId] || [...targetPage.fields];
        
        // Remove from source
        const newSourceOrder = sourceOrder.filter(f => f.id !== activeField.id);
        
        // Add to end of target if not already there
        const newTargetOrder = [...targetOrder];
        if (!newTargetOrder.some(f => f.id === activeField.id)) {
          newTargetOrder.push(activeField);
        }
        
        setLocalFieldOrder({
          [activePageId]: newSourceOrder,
          [overPageId]: newTargetOrder
        });
      }
    }
  }, [pages, localFieldOrder]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    // Phase 1A: Clear shadow state on drop
    setActiveId(null);
    setDraggedItem(null);
    setLocalFieldOrder({});

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

    // Handle field reordering within the same page or moving between pages
    if (activeData?.type === 'field' && overData?.type === 'field') {
      const activeField = activeData.field;
      const overField = overData.field;
      const activePageId = activeData.pageId;
      const overPageId = overData.pageId;

      if (activeField.id === overField.id) return; // Same field, no action needed

      if (activePageId === overPageId) {
        // Reorder within the same page
        const page = pages.find(p => p.id === activePageId);
        if (page && page.fields.length > 1) {
          const oldIndex = page.fields.findIndex(f => f.id === activeField.id);
          const newIndex = page.fields.findIndex(f => f.id === overField.id);
          
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            console.log(`Field reorder: moving field from index ${oldIndex} to ${newIndex} in page ${activePageId}`);
            onReorderFields(activePageId, oldIndex, newIndex);
          }
        }
      } else {
        // Move between pages
        const targetPage = pages.find(p => p.id === overPageId);
        if (targetPage) {
          const insertIndex = targetPage.fields.findIndex(f => f.id === overField.id);
          console.log(`Cross-page field move: moving field ${activeField.id} from page ${activePageId} to page ${overPageId} at index ${insertIndex}`);
          onMoveFieldBetweenPages(activePageId, overPageId, activeField.id, insertIndex);
        }
      }
      return;
    }

    // Handle field dropped on empty page area (move to end) or page thumbnail
    if (activeData?.type === 'field' && (overData?.type === 'page' || overData?.type === 'page-item')) {
      const activeField = activeData.field;
      const activePageId = activeData.pageId;
      // For page-item drops, get the page ID from the page object
      const overPageId = overData?.type === 'page-item' ? overData.page?.id : overData.pageId;

      if (activePageId === overPageId) {
        // Move to end within same page (only for regular page drops, not thumbnails)
        if (!over.id.toString().includes('page-thumbnail-')) {
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
      } else {
        // Move to end of different page (works for both regular page and thumbnail drops)
        const targetPage = pages.find(p => p.id === overPageId);
        if (targetPage) {
          const dropType = over.id.toString().includes('page-thumbnail-') ? 'thumbnail' : 'page';
          console.log(`Cross-page field move via ${dropType}: moving field ${activeField.id} from page ${activePageId} to end of page ${overPageId}`);
          onMoveFieldBetweenPages(activePageId, overPageId, activeField.id);
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
  }, [pages, onAddField, onReorderFields, onReorderPages, onMoveFieldBetweenPages]);

  // Phase 1A: Handle drag cancel (ESC key or drop outside valid target)
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setDraggedItem(null);
    setLocalFieldOrder({});
  }, []);

  return {
    activeId,
    draggedItem,
    localFieldOrder,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
};