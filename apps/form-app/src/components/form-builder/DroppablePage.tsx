import React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FormPage } from '@dculus/types';
import { Card, TypographyH3, Button } from '@dculus/ui';
import { Eye, MoreVertical } from 'lucide-react';
import { DraggableField } from './DraggableField';
import { EmptyDropZone } from './EmptyDropZone';
import { DropIndicator } from './DropIndicator';

interface DroppablePageProps {
  page: FormPage;
  index: number;
  isSelected: boolean;
  isConnected: boolean;
  selectedFieldId?: string | null;
  onSelect: () => void;
  onUpdateField: (pageId: string, fieldId: string, updates: Record<string, any>) => void;
  onRemoveField: (pageId: string, fieldId: string) => void;
  onDuplicateField: (pageId: string, fieldId: string) => void;
  onEditField?: (fieldId: string) => void;
}

export const DroppablePage: React.FC<DroppablePageProps> = ({
  page,
  index,
  isSelected,
  isConnected,
  selectedFieldId,
  onSelect,
  onUpdateField,
  onRemoveField,
  onDuplicateField,
  onEditField,
}) => {
  const {
    isOver,
    setNodeRef: setDroppableRef,
  } = useDroppable({
    id: `page-${page.id}`,
    data: {
      type: 'page',
      pageId: page.id,
      accepts: ['field-type'], // Explicitly accept field types
    },
  });

  const { active, over } = useDndContext();
  const fieldIds = page.fields.map(field => field.id);

  // Check if we're dragging a field type from sidebar
  const isDraggingFieldType = active?.data?.current?.type === 'field-type';
  const isDraggingOverThisPage = over?.data?.current?.pageId === page.id;
  const shouldShowDropIndicators = isDraggingFieldType && isDraggingOverThisPage;

  // Calculate drop position based on drag target
  const getDropInsertIndex = (): number => {
    if (!over || !isDraggingFieldType) return -1;
    
    const overData = over.data.current;
    if (overData?.type === 'field') {
      // Dropping over a field - insert before this field
      const fieldIndex = page.fields.findIndex(f => f.id === over.id);
      return fieldIndex !== -1 ? fieldIndex : page.fields.length;
    } else if (overData?.type === 'page') {
      // Dropping over empty page area - add to end
      return page.fields.length;
    }
    return -1;
  };

  const dropInsertIndex = getDropInsertIndex();

  return (
    <Card 
      data-testid="droppable-page"
      className={`
        transition-all duration-200 border-2
        ${isSelected 
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${isOver ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : ''}
      `}
      onClick={onSelect}
    >
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </div>
              <TypographyH3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {page.title}
              </TypographyH3>
            </div>
            
            {!isConnected && (
              <div className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                Offline
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {page.fields.length} {page.fields.length === 1 ? 'field' : 'fields'}
        </div>
      </div>

      {/* Droppable Fields Area */}
      <div 
        ref={setDroppableRef}
        className={`
          min-h-24 p-4 relative
          ${isOver ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}
        `}
      >
        {page.fields.length === 0 ? (
          <EmptyDropZone />
        ) : (
          <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {/* Drop indicator at the beginning */}
              {shouldShowDropIndicators && dropInsertIndex === 0 && (
                <DropIndicator />
              )}
              
              {page.fields.map((field, fieldIndex) => (
                <React.Fragment key={`${page.id}-field-${field.id}-${fieldIndex}`}>
                  <DraggableField
                    key={`field-${field.id}-${JSON.stringify({
                      label: 'label' in field ? field.label : '',
                      defaultValue: 'defaultValue' in field ? field.defaultValue : '',
                      options: 'options' in field ? field.options : [],
                      validation: 'validation' in field ? field.validation : {}
                    })}`}
                    field={field}
                    pageId={page.id}
                    index={fieldIndex}
                    isConnected={isConnected}
                    isSelected={selectedFieldId === field.id}
                    onUpdate={(updates: Record<string, any>) => onUpdateField(page.id, field.id, updates)}
                    onRemove={() => onRemoveField(page.id, field.id)}
                    onDuplicate={() => onDuplicateField(page.id, field.id)}
                    onEdit={onEditField ? () => onEditField(field.id) : undefined}
                  />
                  
                  {/* Drop indicator after each field */}
                  {shouldShowDropIndicators && dropInsertIndex === fieldIndex + 1 && (
                    <DropIndicator />
                  )}
                </React.Fragment>
              ))}
              
              {/* Drop indicator at the end */}
              {shouldShowDropIndicators && dropInsertIndex === page.fields.length && (
                <DropIndicator />
              )}
            </div>
          </SortableContext>
        )}

        {/* Drop indicator overlay - shows when dragging over the entire area */}
        {isOver && (
          <div className="absolute inset-2 pointer-events-none border-2 border-dashed border-blue-400 rounded-lg bg-blue-50/10 dark:bg-blue-950/10 flex items-center justify-center z-10">
            <div className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
              Drop field here
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DroppablePage;
