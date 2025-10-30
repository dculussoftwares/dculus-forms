import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FormPage } from '@dculus/types';
import { Button, Card } from '@dculus/ui';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import {
  GripVertical,
  Trash2,
  Copy,
  Plus,
} from 'lucide-react';
import { ConfirmationDialog } from './ConfirmationDialog';

interface DraggablePageItemProps {
  page: FormPage;
  index: number;
  isSelected: boolean;
  isConnected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  shouldScrollIntoView?: boolean;
}

export const DraggablePageItem: React.FC<DraggablePageItemProps> = ({
  page,
  index,
  isSelected,
  isConnected,
  onSelect,
  onRemove,
  onDuplicate,
  shouldScrollIntoView = false,
}) => {
  const { t } = useTranslation('draggablePageItem');
  const permissions = useFormPermissions();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const pageItemRef = useRef<HTMLDivElement>(null);
  const { active, over } = useDndContext();

  // Helper function for field count with proper pluralization
  const getFieldCountText = (count: number) => {
    const fieldLabel = count === 1 ? t('fieldCount.singular') : t('fieldCount.plural');
    return `${count} ${fieldLabel}`;
  };
  
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    data: {
      type: 'page-item',
      page,
    },
    disabled: !permissions.canReorderPages(), // Disable page dragging for viewers
  });

  const {
    isOver: isDropOver,
    setNodeRef: setDroppableRef,
  } = useDroppable({
    id: `page-thumbnail-${page.id}`,
    data: {
      type: 'page',
      pageId: page.id,
      accepts: ['field', 'field-type'], // Accept field drops and new field types
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Check drag states for visual feedback
  const isDraggingField = active?.data?.current?.type === 'field';
  const isDraggingFieldType = active?.data?.current?.type === 'field-type';
  
  // Check if hovering over this page (either the thumbnail droppable or the sortable page item)
  const isOverThisPage = over?.id === `page-thumbnail-${page.id}` || over?.id === page.id;
  
  const isDraggingFromDifferentPage = isDraggingField && 
    active?.data?.current?.pageId !== page.id &&
    isOverThisPage;
    
  const isDraggingFieldTypeToThisPage = isDraggingFieldType && isOverThisPage;
  
  
  // Don't combine refs - use separate elements for sorting and dropping

  // Scroll into view when shouldScrollIntoView is true and isSelected is true
  useEffect(() => {
    if (shouldScrollIntoView && isSelected && pageItemRef.current) {
      pageItemRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }, [shouldScrollIntoView, isSelected]);

  return (
    <div
      ref={pageItemRef}
      data-testid={`page-item-${index + 1}`}
      className={`
        group transition-all duration-200
        ${isDragging ? 'opacity-50 scale-105 z-50' : ''}
      `}
    >
      <div
        ref={setSortableRef}
        style={style}
        className={`
          transition-all duration-200 relative
          ${isDraggingFromDifferentPage || isDraggingFieldTypeToThisPage ? 'scale-105 z-10' : ''}
        `}
      >
        <div
          ref={setDroppableRef}
          className="relative w-full h-full"
        >
          <Card 
            className={`
              p-3 cursor-pointer transition-all duration-200 border-2 relative
              ${isSelected 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
              }
              ${isDraggingFromDifferentPage 
                ? 'border-green-400 bg-green-50/80 dark:bg-green-950/50 ring-2 ring-green-200 dark:ring-green-800' 
                : ''
              }
              ${isDraggingFieldTypeToThisPage 
                ? 'border-blue-400 bg-blue-50/80 dark:bg-blue-950/50 ring-2 ring-blue-200 dark:ring-blue-800' 
                : ''
              }
              ${isDropOver && (isDraggingField || isDraggingFieldType)
                ? 'shadow-lg' 
                : ''
              }
            `}
            onClick={onSelect}
            data-testid={`select-page-${page.title.replace(/\s+/g, '-').toLowerCase()}`}
          >
          <div className="flex items-center space-x-3">
            {/* Drag Handle */}
            {permissions.canReorderPages() ? (
              <div
                {...attributes}
                {...listeners}
                data-testid={`page-drag-handle-${index + 1}`}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4" />
              </div>
            ) : (
              <div className="flex-shrink-0 text-gray-300 dark:text-gray-600">
                <GripVertical className="w-4 h-4" />
              </div>
            )}

            {/* Page Number */}
            <div 
              data-testid={`page-number-${index + 1}`}
              className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                ${isSelected 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }
              `}
            >
              {index + 1}
            </div>

            {/* Page Info */}
            <div className="flex-1 min-w-0">
              <div 
                data-testid={`page-title-${index + 1}`}
                className={`
                  text-sm font-medium leading-tight
                  line-clamp-2 overflow-hidden
                  ${isSelected 
                    ? 'text-blue-900 dark:text-blue-100' 
                    : 'text-gray-900 dark:text-white'
                  }
                `}
              >
                {page.title}
              </div>
              <div 
                data-testid={`page-field-count-${index + 1}`}
                className={`
                  text-xs truncate mb-2
                  ${isSelected 
                    ? 'text-blue-700 dark:text-blue-300' 
                    : 'text-gray-500 dark:text-gray-400'
                  }
                `}
              >
                {getFieldCountText(page.fields.length)}
              </div>

              {/* Field Preview Bars (Thumbnail Style) */}
              <div className="space-y-1">
                {page.fields.length === 0 ? (
                  <div className="flex items-center justify-center py-1 text-gray-400 dark:text-gray-600">
                    <div className="text-center">
                      <Plus className="w-3 h-3 mx-auto mb-0.5" />
                      <div className="text-xs">Empty</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Show first few fields as mini bars */}
                    {page.fields.slice(0, 3).map((field, fieldIndex) => (
                      <div
                        key={`${page.id}-${field.id}-${fieldIndex}`}
                        className={`
                          h-1.5 rounded-sm
                          ${isSelected 
                            ? 'bg-blue-200 dark:bg-blue-700' 
                            : 'bg-gray-200 dark:bg-gray-700'
                          }
                        `}
                        style={{ 
                          width: `${Math.max(40, Math.min(90, 60 + (fieldIndex * 10)))}%` 
                        }}
                      />
                    ))}
                    
                    {/* Show "more" indicator if there are additional fields */}
                    {page.fields.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-right pt-0.5">
                        +{page.fields.length - 3}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Actions - Only show for users with edit permissions */}
            {!permissions.isReadOnly && (
              <div className="flex items-center space-x-1">
                {onDuplicate && permissions.canAddPages() && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate();
                    }}
                    disabled={!isConnected}
                    className="h-6 w-6 p-0 text-gray-500 hover:text-blue-600"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
                {onRemove && permissions.canDeletePages() && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                    }}
                    disabled={!isConnected}
                    className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Drop Indicator Overlays */}
          {isDraggingFromDifferentPage && (
            <div className="absolute inset-0 bg-green-400/10 border-2 border-dashed border-green-400 rounded-lg flex items-center justify-center z-10">
              <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                <span>Move here</span>
              </div>
            </div>
          )}
          
          {isDraggingFieldTypeToThisPage && (
            <div className="absolute inset-0 bg-blue-400/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-10">
              <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg flex items-center space-x-1">
                <Plus className="w-3 h-3" />
                <span>Add here</span>
              </div>
            </div>
          )}
        </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showDeleteDialog}
          title={t('deleteDialog.title')}
          message={t('deleteDialog.message', { values: { pageTitle: page.title } })}
          confirmLabel={t('deleteDialog.confirmLabel')}
          cancelLabel={t('deleteDialog.cancelLabel')}
          variant="destructive"
          onConfirm={() => {
            onRemove?.();
            setShowDeleteDialog(false);
          }}
          onCancel={() => setShowDeleteDialog(false)}
        />
      </div>
    </div>
  );
};