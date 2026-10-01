import React from 'react';
import type { FormPage } from '@dculus/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@dculus/ui';
import { ArrowDown, ArrowUp, Copy, CopyPlus, MoreHorizontal, MoveRight, Settings, Trash2 } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface CompactCardMenuProps {
  fieldId: string;
  pages: FormPage[];
  currentPageId: string;
  onSettings?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onMoveToPage?: (targetPageId: string) => void;
  onCopyToPage?: (targetPageId: string) => void;
  onDelete?: () => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** The `⋯` menu that replaces the hover action row on narrow (grid column) cards, §8.3. */
export const CompactCardMenu: React.FC<CompactCardMenuProps> = ({
  fieldId,
  pages,
  currentPageId,
  onSettings,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onMoveToPage,
  onCopyToPage,
  onDelete,
}) => {
  const { t } = useTranslation('gridLayout');
  const otherPages = pages.filter((page) => page.id !== currentPageId);
  const canTransfer = otherPages.length > 0 && onMoveToPage && onCopyToPage;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          onClick={stop}
          onPointerDown={stop}
          className="flex-shrink-0 p-1 h-auto rounded-md"
          aria-label={t('card.moreActions')}
          title={t('card.moreActions')}
          data-testid={`field-more-actions-${fieldId}`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        {onSettings && (
          <DropdownMenuItem onSelect={onSettings} data-testid={`field-menu-settings-${fieldId}`}>
            <Settings className="w-4 h-4 mr-2" />
            {t('card.settings')}
          </DropdownMenuItem>
        )}
        {onMoveUp && (
          <DropdownMenuItem onSelect={onMoveUp} data-testid={`field-menu-move-up-${fieldId}`}>
            <ArrowUp className="w-4 h-4 mr-2" />
            {t('card.moveUp')}
          </DropdownMenuItem>
        )}
        {onMoveDown && (
          <DropdownMenuItem onSelect={onMoveDown} data-testid={`field-menu-move-down-${fieldId}`}>
            <ArrowDown className="w-4 h-4 mr-2" />
            {t('card.moveDown')}
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onSelect={onDuplicate} data-testid={`field-menu-duplicate-${fieldId}`}>
            <Copy className="w-4 h-4 mr-2" />
            {t('card.duplicate')}
          </DropdownMenuItem>
        )}
        {canTransfer && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MoveRight className="w-4 h-4 mr-2" />
                {t('card.moveToPage')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherPages.map((page) => (
                  <DropdownMenuItem key={page.id} onSelect={() => onMoveToPage(page.id)}>
                    {page.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CopyPlus className="w-4 h-4 mr-2" />
                {t('card.copyToPage')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherPages.map((page) => (
                  <DropdownMenuItem key={page.id} onSelect={() => onCopyToPage(page.id)}>
                    {page.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
              data-testid={`field-menu-delete-${fieldId}`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('card.delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
