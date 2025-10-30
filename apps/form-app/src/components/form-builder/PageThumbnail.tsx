import React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { FormPage } from '@dculus/types';
import { Card } from '@dculus/ui';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface PageThumbnailProps {
  page: FormPage;
  index: number;
  isSelected: boolean;
  isConnected: boolean;
  onSelect: () => void;
}

export const PageThumbnail: React.FC<PageThumbnailProps> = ({
  page,
  index,
  isSelected,
  isConnected,
  onSelect,
}) => {
  const { t } = useTranslation('pageThumbnail');
  const { active, over } = useDndContext();

  // Helper function for field count with proper pluralization
  const getFieldCountText = (count: number) => {
    const fieldLabel = count === 1 ? t('fieldCount.singular') : t('fieldCount.plural');
    return `${count} ${fieldLabel}`;
  };
  
  const {
    isOver,
    setNodeRef,
  } = useDroppable({
    id: `page-thumbnail-${page.id}`,
    data: {
      type: 'page',
      pageId: page.id,
      accepts: ['field', 'field-type'], // Accept field drops from other pages and new field types
    },
  });

  // Check if we're dragging a field from a different page or new field type
  const isDraggingField = active?.data?.current?.type === 'field';
  const isDraggingFieldType = active?.data?.current?.type === 'field-type';
  const isOverThisThumbnail = over?.id === `page-thumbnail-${page.id}`;
  
  const isDraggingFromDifferentPage = isDraggingField && 
    active?.data?.current?.pageId !== page.id &&
    isOverThisThumbnail;
    
  const isDraggingFieldTypeToThisPage = isDraggingFieldType && isOverThisThumbnail;

  return (
    <div
      ref={setNodeRef}
      className={`
        relative transition-all duration-200 cursor-pointer
        ${isDraggingFromDifferentPage || isDraggingFieldTypeToThisPage ? 'scale-105 z-10' : ''}
      `}
      onClick={onSelect}
    >
      <Card 
        className={`
          p-3 transition-all duration-200 border-2
          ${isSelected 
            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/50' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }
          ${isDraggingFromDifferentPage 
            ? 'border-green-400 bg-green-50/80 dark:bg-green-950/50 ring-2 ring-green-200 dark:ring-green-800' 
            : ''
          }
          ${isDraggingFieldTypeToThisPage 
            ? 'border-blue-400 bg-blue-50/80 dark:bg-blue-950/50 ring-2 ring-blue-200 dark:ring-blue-800' 
            : ''
          }
          ${isOver && (isDraggingField || isDraggingFieldType)
            ? 'shadow-lg' 
            : ''
          }
        `}
      >
        {/* Page Header */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {page.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {getFieldCountText(page.fields.length)}
            </div>
          </div>
        </div>

        {/* Page Content Preview */}
        <div className="space-y-1.5">
          {page.fields.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-gray-400 dark:text-gray-600">
              <div className="text-center">
                <Plus className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs">{t('emptyState')}</div>
              </div>
            </div>
          ) : (
            <>
              {/* Show first few fields as mini bars */}
              {page.fields.slice(0, 4).map((field, fieldIndex) => (
                <div
                  key={`${page.id}-${field.id}-${fieldIndex}`}
                  className="h-2 bg-gray-200 dark:bg-gray-700 rounded-sm"
                  style={{ 
                    width: `${Math.max(40, Math.min(90, 60 + (fieldIndex * 10)))}%` 
                  }}
                />
              ))}
              
              {/* Show "more" indicator if there are additional fields */}
              {page.fields.length > 4 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
                  {t('moreFields', { values: { count: page.fields.length - 4 } })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="absolute top-1 right-1">
            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
          </div>
        )}

        {/* Drop Indicator Overlays */}
        {isDraggingFromDifferentPage && (
          <div className="absolute inset-0 bg-green-400/10 border-2 border-dashed border-green-400 rounded-lg flex items-center justify-center">
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              <span>{t('dropIndicators.moveHere')}</span>
            </div>
          </div>
        )}
        
        {isDraggingFieldTypeToThisPage && (
          <div className="absolute inset-0 bg-blue-400/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center">
            <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg flex items-center space-x-1">
              <Plus className="w-3 h-3" />
              <span>{t('dropIndicators.addHere')}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PageThumbnail;