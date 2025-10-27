import { useEffect, useState } from 'react';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { FormBuilderHeader } from './FormBuilderHeader';
import { TabNavigation } from './TabNavigation';
import { PageBuilderTab } from './tabs/PageBuilderTab';
import { PreviewTab } from './tabs/PreviewTab';
import { LayoutTab } from './tabs/LayoutTab';
import { SettingsTab } from './tabs/SettingsTab';
import { FieldType } from '@dculus/types';

type BuilderTab = 'page-builder' | 'preview' | 'layout' | 'settings';

interface FormBuilderContainerProps {
  form: any; // TODO: Add proper Form type
  initialTab?: string;
}

/**
 * Main container for the collaborative form builder
 * Manages full-screen layout with header, content area, and tab navigation
 */
export function FormBuilderContainer({
  form,
  initialTab,
}: FormBuilderContainerProps) {
  const {
    initializeCollaboration,
    disconnectCollaboration,
    addField,
    addFieldAtIndex,
    reorderFields,
    pages,
    selectedPageId,
  } = useFormBuilderStore();

  // Local state for active tab
  const [activeTab, setActiveTab] = useState<BuilderTab>(
    (initialTab as BuilderTab) || 'page-builder'
  );

  // Track active drag item
  const [activeDragItem, setActiveDragItem] = useState<any>(null);

  // Initialize collaboration on mount
  useEffect(() => {
    initializeCollaboration(form.id);

    return () => {
      disconnectCollaboration();
    };
  }, [form.id, initializeCollaboration, disconnectCollaboration]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px before drag starts
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Case 1: Dragging a field type from palette to canvas
    if (activeData?.type === 'field-type' && overData?.type === 'canvas') {
      const fieldType = activeData.fieldType as FieldType;
      if (!selectedPageId) return;

      addField(selectedPageId, fieldType);
      return;
    }

    // Case 2: Reordering fields within canvas
    if (activeData?.type === 'field' && overData?.type === 'field') {
      if (active.id === over.id) return;

      const currentPage = pages.find((p) => p.id === selectedPageId);
      if (!currentPage) return;

      const oldIndex = currentPage.fields.findIndex((f) => f.id === active.id);
      const newIndex = currentPage.fields.findIndex((f) => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1 && selectedPageId) {
        reorderFields(selectedPageId, oldIndex, newIndex);
      }
      return;
    }

    // Case 3: Dragging field type directly over a field (insert above)
    if (activeData?.type === 'field-type' && overData?.type === 'field') {
      const fieldType = activeData.fieldType as FieldType;
      if (!selectedPageId) return;

      const currentPage = pages.find((p) => p.id === selectedPageId);
      if (!currentPage) return;

      const overIndex = currentPage.fields.findIndex((f) => f.id === over.id);
      addFieldAtIndex(selectedPageId, fieldType, {}, overIndex);
      return;
    }
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <FormBuilderHeader form={form} />

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'page-builder' && <PageBuilderTab />}
          {activeTab === 'preview' && <PreviewTab />}
          {activeTab === 'layout' && <LayoutTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>

        {/* Tab navigation */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Drag overlay - shows preview of dragged item */}
      <DragOverlay>
        {activeDragItem && (
          <div className="bg-background border-2 border-primary rounded-lg p-4 shadow-lg opacity-60">
            Dragging...
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
