import React from 'react';
import { FormPage } from '@dculus/types';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { FileText, ArrowRight, Copy, MoreVertical } from 'lucide-react';

interface PageActionsSelectorProps {
  pages: FormPage[];
  currentPageId: string;
  triggerElement: React.ReactNode;
  onMoveToPage: (pageId: string) => void;
  onCopyToPage: (pageId: string) => void;
  disabled?: boolean;
}

export const PageActionsSelector: React.FC<PageActionsSelectorProps> = ({
  pages,
  currentPageId,
  triggerElement,
  onMoveToPage,
  onCopyToPage,
  disabled = false,
}) => {
  const { t } = useTranslation('pageActionsSelector');
  const availablePages = pages.filter(page => page.id !== currentPageId);

  if (availablePages.length === 0) {
    return null; // Don't render if there are no other pages to move/copy to
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {triggerElement}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700 z-10">
          <DropdownMenuLabel className="flex items-center space-x-2">
            <MoreVertical className="w-4 h-4" />
            <span>{t('header')}</span>
          </DropdownMenuLabel>
        </div>
        
        <div className="py-1">
          {/* Move to Page Section */}
          <DropdownMenuLabel className="flex items-center space-x-2 text-sm font-medium text-gray-500 dark:text-gray-400 px-2 py-1">
            <ArrowRight className="w-3 h-3" />
            <span>{t('sections.moveToPage')}</span>
          </DropdownMenuLabel>
          {availablePages.map((page, index) => (
            <DropdownMenuItem
              key={`move-${page.id}`}
              onClick={() => onMoveToPage(page.id)}
              className="flex items-center space-x-3 py-2 ml-2"
            >
              <div className="w-5 h-5 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-semibold">
                {index + (currentPageId === pages[0]?.id ? 2 : 1)}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <FileText className="w-3 h-3 text-gray-500" />
                  <span className="font-medium text-sm">{page.title}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {page.fields.length} {page.fields.length === 1 ? t('fieldCount.singular') : t('fieldCount.plural')}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          {/* Copy to Page Section */}
          <DropdownMenuLabel className="flex items-center space-x-2 text-sm font-medium text-gray-500 dark:text-gray-400 px-2 py-1">
            <Copy className="w-3 h-3" />
            <span>{t('sections.copyToPage')}</span>
          </DropdownMenuLabel>
          {availablePages.map((page, index) => (
            <DropdownMenuItem
              key={`copy-${page.id}`}
              onClick={() => onCopyToPage(page.id)}
              className="flex items-center space-x-3 py-2 ml-2"
            >
              <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-xs font-semibold">
                {index + (currentPageId === pages[0]?.id ? 2 : 1)}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <FileText className="w-3 h-3 text-gray-500" />
                  <span className="font-medium text-sm">{page.title}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {page.fields.length} {page.fields.length === 1 ? t('fieldCount.singular') : t('fieldCount.plural')}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PageActionsSelector;