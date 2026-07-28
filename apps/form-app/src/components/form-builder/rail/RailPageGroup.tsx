import React, { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FormPage } from '@dculus/types';
import { Button, Input } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { GripVertical, Copy, Trash2, ChevronDown } from 'lucide-react';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks/useTranslation';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { RailFieldChip } from './RailFieldChip';

interface RailPageGroupProps {
  page: FormPage;
  index: number;
  startNumber: number;
  isSelected: boolean;
  isConnected: boolean;
}

/**
 * A `field-insert` drop zone between chips (or at the start/end of an empty page),
 * reusing the exact { type: 'field-insert', pageId, insertIndex } shape that
 * PageBuilderTab.handleDragEnd already knows how to interpret for reorder and
 * cross-page moves — see the insert-slot math documented there.
 */
const RailFieldInsertZone: React.FC<{ pageId: string; insertIndex: number }> = ({
  pageId,
  insertIndex,
}) => {
  const permissions = useFormPermissions();
  const { setNodeRef, isOver } = useDroppable({
    id: `rail-drop-${pageId}-${insertIndex}`,
    data: { type: 'field-insert', pageId, insertIndex },
    disabled: !permissions.canEditFields(),
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mx-1 rounded transition-all',
        isOver ? 'h-2 bg-[var(--tf-dark)]/20' : 'h-1'
      )}
    />
  );
};

export const RailPageGroup: React.FC<RailPageGroupProps> = ({
  page,
  index,
  startNumber,
  isSelected,
  isConnected,
}) => {
  const { t } = useTranslation('journeyRail');
  const { t: tPage } = useTranslation('draggablePageItem');
  const permissions = useFormPermissions();
  const setSelection = useFormBuilderStore((state) => state.setSelection);
  const removePage = useFormBuilderStore((state) => state.removePage);
  const duplicatePage = useFormBuilderStore((state) => state.duplicatePage);
  const updatePageTitle = useFormBuilderStore((state) => state.updatePageTitle);
  const selectedFieldId = useFormBuilderStore((state) => state.selectedFieldId);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(page.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedTitle(page.title);
  }, [page.title]);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const canEditTitle = permissions.canEditFields() && isConnected;

  const handleSaveTitle = () => {
    const trimmed = editedTitle.trim();
    if (!trimmed) {
      setEditedTitle(page.title);
      setIsEditingTitle(false);
      return;
    }
    if (trimmed !== page.title) {
      updatePageTitle(page.id, trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setEditedTitle(page.title);
    setIsEditingTitle(false);
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
    data: { type: 'page-item', page },
    disabled: !permissions.canReorderPages(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      data-testid={`rail-page-${index}`}
      aria-selected={isSelected}
      className={cn(
        'group rounded-xl border bg-white dark:bg-card transition-all',
        isDragging && 'opacity-50 z-10',
        isSelected
          ? 'border-[var(--tf-border-strong)] shadow-sm'
          : 'border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)]'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-t-xl px-2 py-1.5',
          isSelected && 'bg-[var(--tf-faint)]'
        )}
      >
        {permissions.canReorderPages() ? (
          <div
            {...attributes}
            {...listeners}
            data-testid={`rail-page-drag-handle-${index}`}
            className="shrink-0 cursor-grab text-[var(--tf-light-muted)] hover:text-[var(--tf-dark)] active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--tf-light-muted)]" />
        )}

        <button
          type="button"
          onClick={() => setSelection({ kind: 'page', pageId: page.id })}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {isEditingTitle ? (
            <Input
              ref={inputRef}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveTitle();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
              className="h-6 px-1 py-0 text-xs font-semibold"
              data-testid={`rail-page-title-input-${index}`}
            />
          ) : (
            <span
              onClick={(e) => {
                if (canEditTitle) {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }
              }}
              title={canEditTitle ? tPage('editTitle') : undefined}
              className={cn(
                'truncate text-xs font-semibold text-[var(--tf-dark)]',
                canEditTitle && 'cursor-text hover:underline'
              )}
              data-testid={`rail-page-title-${index}`}
            >
              {page.title || t('untitledPage')}
            </span>
          )}
        </button>

        {!permissions.isReadOnly && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 hover:opacity-100">
            {permissions.canAddPages() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicatePage(page.id);
                }}
                disabled={!isConnected}
                title={t('actions.duplicatePage')}
                className="h-5 w-5 p-0 text-[var(--tf-muted)] hover:text-[var(--tf-dark)]"
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
            {permissions.canDeletePages() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                disabled={!isConnected}
                title={t('actions.deletePage')}
                className="h-5 w-5 p-0 text-[var(--tf-muted)] hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0 px-1 pb-1.5">
        <RailFieldInsertZone pageId={page.id} insertIndex={0} />
        {page.fields.map((field, fieldIndex) => (
          <React.Fragment key={field.id}>
            <RailFieldChip
              field={field}
              index={fieldIndex}
              pageId={page.id}
              number={startNumber + fieldIndex}
              isSelected={selectedFieldId === field.id}
            />
            <RailFieldInsertZone pageId={page.id} insertIndex={fieldIndex + 1} />
          </React.Fragment>
        ))}
        {page.fields.length === 0 && (
          <p className="px-2 py-1 text-[11px] text-[var(--tf-light-muted)]">
            {t('emptyPage')}
          </p>
        )}
      </div>

      <ConfirmationDialog
        isOpen={showDeleteDialog}
        title={tPage('deleteDialog.title')}
        message={tPage('deleteDialog.message', { values: { pageTitle: page.title } })}
        confirmLabel={tPage('deleteDialog.confirmLabel')}
        cancelLabel={tPage('deleteDialog.cancelLabel')}
        variant="destructive"
        onConfirm={() => {
          removePage(page.id);
          setShowDeleteDialog(false);
        }}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
};

export default RailPageGroup;
