import { useEffect } from 'react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { FormBuilderHeader } from './FormBuilderHeader';
import { TabNavigation } from './TabNavigation';
import { PageBuilderTab } from './tabs/PageBuilderTab';
import { PreviewTab } from './tabs/PreviewTab';
import { LayoutTab } from './tabs/LayoutTab';
import { SettingsTab } from './tabs/SettingsTab';

type BuilderTab = 'page-builder' | 'preview' | 'layout' | 'settings';

interface FormBuilderContainerProps {
  form: any; // TODO: Add proper Form type
  initialTab?: string;
}

/**
 * Main container for the collaborative form builder
 * Manages full-screen layout with header, content area, and tab navigation
 */
export function FormBuilderContainer({ form, initialTab }: FormBuilderContainerProps) {
  const {
    initializeCollaboration,
    disconnectCollaboration,
  } = useFormBuilderStore();

  // Local state for active tab (not in global store yet)
  const [activeTab, setActiveTab] = React.useState<BuilderTab>(
    (initialTab as BuilderTab) || 'page-builder'
  );

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

  const handleDragEnd = (event: any) => {
    // TODO: Implement drag & drop logic
    console.log('Drag end:', event);
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
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

      {/* Drag overlay */}
      <DragOverlay>
        {/* TODO: Render dragged item preview */}
      </DragOverlay>
    </DndContext>
  );
}

// Import React for useState
import React from 'react';
