import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormPage } from '@dculus/types';
import { Button, Card } from '@dculus/ui';
import {
  GripVertical,
  Trash2,
  Copy,
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const pageItemRef = useRef<HTMLDivElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    data: {
      type: 'page-item',
      page,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
      className={`
        group transition-all duration-200
        ${isDragging ? 'opacity-50 scale-105 z-50' : ''}
      `}
    >
      <div
        ref={setNodeRef}
        style={style}
      >
        <Card 
          className={`
            p-3 cursor-pointer transition-all duration-200 border-2
            ${isSelected 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md' 
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
            }
          `}
          onClick={onSelect}
        >
          <div className="flex items-center space-x-3">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Page Number */}
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
              ${isSelected 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }
            `}>
              {index + 1}
            </div>

            {/* Page Info */}
            <div className="flex-1 min-w-0">
              <div className={`
                text-sm font-medium leading-tight
                line-clamp-2 overflow-hidden
                ${isSelected 
                  ? 'text-blue-900 dark:text-blue-100' 
                  : 'text-gray-900 dark:text-white'
                }
              `}>
                {page.title}
              </div>
              <div className={`
                text-xs truncate
                ${isSelected 
                  ? 'text-blue-700 dark:text-blue-300' 
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}>
                {page.fields.length} {page.fields.length === 1 ? 'field' : 'fields'}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-1">
              {onDuplicate && (
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
              {onRemove && (
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
          </div>
        </Card>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showDeleteDialog}
          title="Delete Page"
          message={`Are you sure you want to delete "${page.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
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