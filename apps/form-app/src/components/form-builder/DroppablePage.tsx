import React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FormPage } from '@dculus/types';
import { Card, TypographyH3, Button } from '@dculus/ui';
import { Eye, MoreVertical } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { DraggableField } from './DraggableField';
import { EmptyDropZone } from './EmptyDropZone';
import { DropIndicator } from './DropIndicator';

interface DroppablePageProps {
  page: FormPage;
  index: number;
  isSelected: boolean;
  isConnected: boolean;
  selectedFieldId?: string | null;
  pages: FormPage[];
  onSelect: () => void;
  onUpdateField: (pageId: string, fieldId: string, updates: Record<string, any>) => void;
  onRemoveField: (pageId: string, fieldId: string) => void;
  onDuplicateField: (pageId: string, fieldId: string) => void;
  onEditField?: (fieldId: string) => void;
  onMoveFieldBetweenPages: (sourcePageId: string, targetPageId: string, fieldId: string) => void;
  onCopyFieldToPage: (sourcePageId: string, targetPageId: string, fieldId: string) => void;
}

export const DroppablePage: React.FC<DroppablePageProps> = ({
  page,
  index,
  isSelected,
  isConnected,
  selectedFieldId,
  pages,
  onSelect,
  onUpdateField,
  onRemoveField,
  onDuplicateField,
  onEditField,
  onMoveFieldBetweenPages,
  onCopyFieldToPage,
}) => {
  const { t } = useTranslation('droppablePage');

  // Helper function for field count with proper pluralization
  const getFieldCountText = (count: number) => {
    const fieldLabel = count === 1 ? t('fieldCount.singular') : t('fieldCount.plural');
    return `${count} ${fieldLabel}`;
  };

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
  const isDraggingField = active?.data?.current?.type === 'field';
  const isDraggingOverThisPage = over?.data?.current?.pageId === page.id;
  const shouldShowDropIndicators = (isDraggingFieldType || isDraggingField) && isDraggingOverThisPage;

  // Check if we're dragging a field from a different page
  const isDraggingFieldFromOtherPage = isDraggingField && 
    active?.data?.current?.pageId !== page.id && 
    isDraggingOverThisPage;

  // Calculate drop position based on drag target
  const getDropInsertIndex = (): number => {
    if (!over || (!isDraggingFieldType && !isDraggingField)) return -1;
    
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
        ${isOver && isDraggingFieldType 
          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' 
          : ''
        }
        ${isDraggingFieldFromOtherPage 
          ? 'border-green-400 bg-green-50/50 dark:bg-green-950/30 ring-2 ring-green-200 dark:ring-green-800' 
          : ''
        }
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
                {t('status.offline')}
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
          {getFieldCountText(page.fields.length)}
        </div>
      </div>

      {/* Droppable Fields Area */}
      <div 
        ref={setDroppableRef}
        className={`
          min-h-24 p-4 relative
          ${isOver && isDraggingFieldType ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}
          ${isDraggingFieldFromOtherPage ? 'bg-green-50/30 dark:bg-green-950/10' : ''}
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
                    pages={pages}
                    onUpdate={(updates: Record<string, any>) => onUpdateField(page.id, field.id, updates)}
                    onRemove={() => onRemoveField(page.id, field.id)}
                    onDuplicate={() => onDuplicateField(page.id, field.id)}
                    onEdit={onEditField ? () => onEditField(field.id) : undefined}
                    onMoveToPage={(fieldId: string, targetPageId: string) => onMoveFieldBetweenPages(page.id, targetPageId, fieldId)}
                    onCopyToPage={(fieldId: string, targetPageId: string) => onCopyFieldToPage(page.id, targetPageId, fieldId)}
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
        {isOver && isDraggingFieldType && (
          <div className="absolute inset-2 pointer-events-none border-2 border-dashed border-blue-400 rounded-lg bg-blue-50/10 dark:bg-blue-950/10 flex items-center justify-center z-10">
            <div className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
              {t('dropNewField')}
            </div>
          </div>
        )}
        
        {/* Cross-page field move indicator */}
        {isDraggingFieldFromOtherPage && (
          <div className="absolute inset-2 pointer-events-none border-2 border-dashed border-green-400 rounded-lg bg-green-50/10 dark:bg-green-950/10 flex items-center justify-center z-10">
            <div className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              <span>{t('moveFieldToPage')}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DroppablePage;
