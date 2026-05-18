import React from 'react';
import { FormPage } from '@dculus/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
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
  const availablePages = pages.filter((page) => page.id !== currentPageId);

  if (availablePages.length === 0) {
    return null; // Don't render if there are no other pages to move/copy to
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {triggerElement}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-h-80 overflow-y-auto"
      >
        <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-[rgba(81,76,84,0.10)] dark:border-gray-700 z-10">
          <DropdownMenuLabel className="flex items-center space-x-2">
            <MoreVertical className="w-4 h-4" />
            <span>{t('header')}</span>
          </DropdownMenuLabel>
        </div>

        <div className="py-1">
          {availablePages.map((page, index) => (
            <div
              key={page.id}
              className="px-2 py-2 hover:bg-[#f7f7f8] dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {/* Page Info */}
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold">
                  {index + (currentPageId === pages[0]?.id ? 2 : 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1">
                    <FileText className="w-3 h-3 text-[#655d67] flex-shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {page.title}
                    </span>
                  </div>
                  <div className="text-xs text-[#655d67]">
                    {page.fields.length}{' '}
                    {page.fields.length === 1
                      ? t('fieldCount.singular')
                      : t('fieldCount.plural')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => onMoveToPage(page.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 dark:text-primary dark:bg-primary/10 dark:hover:bg-primary/20 rounded-lg h-auto"
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>Move</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onCopyToPage(page.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 dark:text-purple-400 dark:bg-purple-950/50 dark:hover:bg-purple-950 rounded-lg h-auto"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PageActionsSelector;
