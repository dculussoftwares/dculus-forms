import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import { FieldTypeDisplay, type FieldTypeConfig } from '../components/form-builder/FieldTypesPanel';
import { DraggableField } from '../components/form-builder/DraggableField';
import { FormBuilderHeader } from '@/components/form-builder';
import { LoadingState } from '../components/form-builder/LoadingState';
import { ErrorState } from '../components/form-builder/ErrorState';
import { 
  TabNavigation, 
  TabKeyboardShortcuts, 
  LayoutTab, 
  PageBuilderTab, 
  SettingsTab, 
  PreviewTab, 
  type BuilderTab 
} from '../components/form-builder/tabs';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useCollisionDetection } from '../hooks/useCollisionDetection';
import { useFieldCreation } from '../hooks/useFieldCreation';
import { GET_FORM_BY_ID } from '../graphql/queries';

interface CollaborativeFormBuilderProps {
  className?: string;
}

const VALID_TABS: readonly BuilderTab[] = ['layout', 'page-builder', 'settings', 'preview'] as const;
const DEFAULT_TAB: BuilderTab = 'page-builder';
const DEFAULT_SIDEBAR_WIDTH = 320;

const CollaborativeFormBuilder: React.FC<CollaborativeFormBuilderProps> = ({ className }) => {
  const { formId, tab } = useParams<{ formId: string; tab?: string }>();
  const navigate = useNavigate();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  
  const activeTab: BuilderTab = useMemo(() => {
    return (tab && VALID_TABS.includes(tab as BuilderTab)) 
      ? tab as BuilderTab 
      : DEFAULT_TAB;
  }, [tab]);

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
    errorPolicy: 'all'
  });

  const {
    isConnected,
    isLoading,
    pages,
    selectedPageId,
    selectedFieldId,
    initializeCollaboration,
    disconnectCollaboration,
    setSelectedPage,
    setSelectedField,
    addField,
    addFieldAtIndex,
    updateField,
    reorderFields,
    reorderPages,
    getSelectedField,
    updateLayout
  } = useFormBuilderStore();

  const { createFieldData } = useFieldCreation();
  const collisionDetectionStrategy = useCollisionDetection();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const redirectToDefaultTab = useCallback(() => {
    if (formId && !tab) {
      navigate(`/dashboard/form/${formId}/collaborate/${DEFAULT_TAB}`, { replace: true });
    }
  }, [formId, tab, navigate]);

  const handleKeyboardTabChange = useCallback((newTab: BuilderTab) => {
    if (formId) {
      navigate(`/dashboard/form/${formId}/collaborate/${newTab}`);
    }
  }, [formId, navigate]);

  const handleAddField = useCallback((pageId: string, fieldType: FieldTypeConfig, insertIndex?: number) => {
    const fieldData = createFieldData(fieldType);
    
    if (insertIndex !== undefined) {
      addFieldAtIndex(pageId, fieldType.type, fieldData, insertIndex);
    } else {
      addField(pageId, fieldType.type, fieldData);
    }
  }, [createFieldData, addField, addFieldAtIndex]);

  const {
    activeId,
    draggedItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useDragAndDrop({
    pages,
    onAddField: handleAddField,
    onReorderFields: reorderFields,
    onReorderPages: reorderPages,
  });

  const handleFieldEdit = useCallback((fieldId: string) => {
    setSelectedField(fieldId);
  }, [setSelectedField]);

  const handleFieldUpdate = useCallback((updates: Record<string, any>) => {
    const selectedField = getSelectedField();
    if (!selectedField) return;

    // Get current pages from store to ensure we have the latest state
    const currentPages = useFormBuilderStore.getState().pages;
    const pageWithField = currentPages.find(page => 
      page.fields.some(field => field.id === selectedField.id)
    );
    
    if (pageWithField) {
      updateField(pageWithField.id, selectedField.id, updates);
    }
  }, [getSelectedField, updateField]);

  const handleFieldDeselect = useCallback(() => {
    setSelectedField(null);
  }, [setSelectedField]);

  const handleNavigateBack = useCallback(() => {
    navigate(`/dashboard/form/${formId}`);
  }, [formId, navigate]);

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

    initializeCollaboration(formId).catch(error => {
      console.error('Failed to initialize collaboration:', error);
    });

    return () => {
      disconnectCollaboration();
    };
  }, [formId, initializeCollaboration, disconnectCollaboration]);

  useEffect(() => {
    autoSelectFirstPage();
  }, [autoSelectFirstPage]);

  const renderDragOverlay = useMemo(() => {
    if (!activeId || !draggedItem) return null;

    const draggedItemWithType = draggedItem as any;

    if (draggedItemWithType.type) {
      return (
        <div className="opacity-90">
          <FieldTypeDisplay fieldType={draggedItemWithType} isOverlay={true} />
        </div>
      );
    }

    if (draggedItemWithType.id && typeof draggedItemWithType.title === 'string') {
      const pageIndex = pages.findIndex(p => p.id === draggedItemWithType.id);
      return (
        <div className="flex items-center justify-center w-14 h-14 bg-blue-500 text-white rounded-full shadow-xl border-4 border-white text-xl font-bold transform rotate-6 opacity-90">
          {pageIndex + 1}
        </div>
      );
    }

    return (
      <DraggableField
        field={draggedItemWithType}
        pageId=""
        index={0}
        isConnected={isConnected}
        onUpdate={() => {}}
        onRemove={() => {}}
        onDuplicate={() => {}}
      />
    );
  }, [activeId, draggedItem, pages, isConnected]);

  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'layout':
        return <LayoutTab onLayoutChange={updateLayout} />;
      case 'page-builder':
        return (
          <PageBuilderTab
            sidebarWidth={sidebarWidth}
            onSidebarWidthChange={setSidebarWidth}
            selectedFieldId={selectedFieldId}
            onFieldEdit={handleFieldEdit}
            onFieldUpdate={handleFieldUpdate}
            onFieldDeselect={handleFieldDeselect}
          />
        );
      case 'settings':
        return <SettingsTab />;
      case 'preview':
        return <PreviewTab formId={formId || ''} />;
      default:
        return (
          <PageBuilderTab
            sidebarWidth={sidebarWidth}
            onSidebarWidthChange={setSidebarWidth}
            selectedFieldId={selectedFieldId}
            onFieldEdit={handleFieldEdit}
            onFieldUpdate={handleFieldUpdate}
            onFieldDeselect={handleFieldDeselect}
          />
        );
    }
  }, [
    activeTab,
    sidebarWidth,
    selectedFieldId,
    handleFieldEdit,
    handleFieldUpdate,
    handleFieldDeselect,
    formId,
    updateLayout
  ]);

  if (!formId) {
    return (
      <ErrorState 
        title="Form ID Required" 
        description="Please provide a valid form ID to continue." 
      />
    );
  }

  if (formError) {
    return (
      <ErrorState 
        title="Error Loading Form" 
        description={formError.message || "Failed to load form data."} 
      />
    );
  }

  if (isLoading || formLoading) {
    const statusTitle = isConnected ? 
      "Loading form data..." : 
      "Connecting to collaboration...";
    const statusDescription = isConnected ? 
      "Setting up your form builder interface." :
      "Establishing real-time collaboration connection.";
        
    return (
      <LoadingState 
        title={statusTitle}
        description={statusDescription}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div 
        data-testid="collaborative-form-builder"
        className={`min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-blue-950/30 ${className || ''}`}
      >
        <div className="flex flex-col h-screen">
          <FormBuilderHeader 
            formId={formId}
            formTitle={formData?.form?.title}
            isLoading={isLoading}
            isConnected={isConnected}
            onAddPage={() => {}}
            onNavigateBack={handleNavigateBack}
          />

          <div className="flex-1 overflow-hidden relative">
            {renderTabContent()}
            
            <TabNavigation
              activeTab={activeTab}
              isConnected={isConnected}
              collaboratorCount={0}
              position="bottom"
            />
            
            <TabKeyboardShortcuts onTabChange={handleKeyboardTabChange} />
          </div>
        </div>

        {activeTab === 'page-builder' && (
          <DragOverlay>
            {renderDragOverlay}
          </DragOverlay>
        )}
      </div>
    </DndContext>
  );
};

export default CollaborativeFormBuilder;