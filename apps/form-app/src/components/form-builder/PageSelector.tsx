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
import { FileText, ArrowRight } from 'lucide-react';

interface PageSelectorProps {
  pages: FormPage[];
  currentPageId: string;
  triggerElement: React.ReactNode;
  onPageSelect: (pageId: string) => void;
  disabled?: boolean;
  label?: string;
  icon?: React.ReactNode;
}

export const PageSelector: React.FC<PageSelectorProps> = ({
  pages,
  currentPageId,
  triggerElement,
  onPageSelect,
  disabled = false,
  label = "Move to Page",
  icon = <ArrowRight className="w-4 h-4" />,
}) => {
  const availablePages = pages.filter(page => page.id !== currentPageId);

  if (availablePages.length === 0) {
    return null; // Don't render if there are no other pages to move to
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {triggerElement}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center space-x-2">
          {icon}
          <span>{label}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availablePages.map((page, index) => (
          <DropdownMenuItem
            key={page.id}
            onClick={() => onPageSelect(page.id)}
            className="flex items-center space-x-3 py-2"
          >
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold">
              {index + (currentPageId === pages[0]?.id ? 2 : 1)}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{page.title}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {page.fields.length} {page.fields.length === 1 ? 'field' : 'fields'}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PageSelector;