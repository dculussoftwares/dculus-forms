import React from 'react';
import { FormPage } from '@dculus/types';
import { PageThumbnail } from './PageThumbnail';
import { Button } from '@dculus/ui';
import { Plus, Layout } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface PageThumbnailsSidebarProps {
  pages: FormPage[];
  selectedPageId: string | null;
  isConnected: boolean;
  onPageSelect: (pageId: string) => void;
  onAddPage: () => void;
  width?: number;
}

export const PageThumbnailsSidebar: React.FC<PageThumbnailsSidebarProps> = ({
  pages,
  selectedPageId,
  isConnected,
  onPageSelect,
  onAddPage,
  width = 200,
}) => {
  const { t } = useTranslation('pageThumbnailsSidebar');
  
  return (
    <div 
      className="h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Layout className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
              {t('title')}
            </h3>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {pages.length}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('description')}
        </p>
      </div>

      {/* Page Thumbnails List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {pages.map((page, index) => (
            <PageThumbnail
              key={`page-thumbnail-${page.id}-${index}`}
              page={page}
              index={index}
              isSelected={page.id === selectedPageId}
              isConnected={isConnected}
              onSelect={() => onPageSelect(page.id)}
            />
          ))}
        </div>

        {/* Empty State */}
        {pages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Layout className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('emptyState.title')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t('emptyState.description')}
            </p>
          </div>
        )}
      </div>

      {/* Add Page Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          size="sm"
          onClick={onAddPage}
          disabled={!isConnected}
          className="w-full justify-center"
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-1" />
          {t('addButton')}
        </Button>
      </div>
    </div>
  );
};

export default PageThumbnailsSidebar;