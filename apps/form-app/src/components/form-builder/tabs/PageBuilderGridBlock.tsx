import React from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import {
  FieldType,
  MIN_GRID_COLUMN_PERCENT,
  resizeAdjacentColumns,
  sanitizeGridColumnWidths,
  type FormField,
  type GridColumnNode,
  type GridField,
} from '@dculus/types';
import { Button } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { ArrowRightLeft, Columns2, Copy, GripVertical, Plus, Settings, Trash2 } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks/useTranslation';
import { FieldPickerPopover } from '../field-library/FieldPickerPopover';
import { PageActionsSelector } from '../PageActionsSelector';
import { DraggableFieldCard } from './PageBuilderFieldCard';
import { GRID_COLUMN_DROPPABLE, GRID_DROP_PRIORITY, GRID_SLOT_DROPPABLE } from './gridCollision';
import { useDeleteGridWithUndo } from './useDeleteGridWithUndo';

/** Gap between columns in px; the divider sits in the middle of it. */
const COLUMN_GAP = 12;

/** True when the item being dragged is a grid (palette tile or existing block); grids never nest (I1). */
const useActiveIsGrid = (): boolean => {
  const { active } = useDndContext();
  const data = active?.data.current;
  if (!data) return false;
  if (data.type === 'existing-field') return data.isGrid === true;
  if (data.type === 'field-type') return data.fieldType?.type === FieldType.GRID_FIELD;
  return false;
};

// =============================================================================
// ColumnDropIndicator
// =============================================================================

const ColumnDropIndicator: React.FC<{
  pageId: string;
  gridId: string;
  column: number;
  slot: number;
  beforeFieldId: string | null;
  isAnyDragActive: boolean;
  disabled: boolean;
}> = ({ pageId, gridId, column, slot, beforeFieldId, isAnyDragActive, disabled }) => {
  const { t } = useTranslation('pageBuilderTab');
  const { setNodeRef, isOver } = useDroppable({
    id: `grid-slot-${gridId}-${column}-${slot}`,
    data: {
      type: GRID_SLOT_DROPPABLE,
      pageId,
      gridId,
      column,
      beforeFieldId,
      priority: GRID_DROP_PRIORITY[GRID_SLOT_DROPPABLE],
    },
    disabled,
  });

  if (!isAnyDragActive || disabled) return <div ref={setNodeRef} className="h-1.5" />;

  return (
    <div
      ref={setNodeRef}
      data-testid={`grid-slot-${gridId}-${column}-${slot}`}
      className={cn('transition-all duration-150 rounded-lg my-0.5', isOver ? 'h-12 py-1' : 'h-6 py-0.5')}
    >
      <div
        className={cn(
          'w-full h-full rounded-lg border-2 border-dashed flex items-center justify-center transition-all duration-150',
          isOver ? 'border-[rgba(60,50,62,0.28)] bg-[var(--tf-tab-bg)]' : 'border-[rgba(60,50,62,0.12)]'
        )}
      >
        {isOver && (
          <span className="text-xs text-[#3c323e] font-medium select-none">
            {t('formArea.dropHere', { defaultValue: 'Drop here' })}
          </span>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// GridColumn
// =============================================================================

interface GridColumnProps {
  pageId: string;
  gridId: string;
  column: GridColumnNode;
  columnCount: number;
  /** Page-level index (store order) of each child, used for card numbering and Move up/down. */
  pageIndexOf: (fieldId: string) => number;
  totalFields: number;
  recentlyDroppedFieldId?: string | null;
  isDelayingExpansion: boolean;
  isAnyDragActive: boolean;
  dropDisabled: boolean;
}

const stopClick = (e: React.SyntheticEvent) => e.stopPropagation();

const GridColumn: React.FC<GridColumnProps> = React.memo(
  ({
    pageId,
    gridId,
    column,
    columnCount,
    pageIndexOf,
    totalFields,
    recentlyDroppedFieldId,
    isDelayingExpansion,
    isAnyDragActive,
    dropDisabled,
  }) => {
    const { t } = useTranslation('gridLayout');
    const canEdit = useFormPermissions().canEditFields();
    const disabled = dropDisabled || !canEdit;
    const { setNodeRef, isOver } = useDroppable({
      id: `grid-column-${gridId}-${column.index}`,
      data: {
        type: GRID_COLUMN_DROPPABLE,
        pageId,
        gridId,
        column: column.index,
        priority: GRID_DROP_PRIORITY[GRID_COLUMN_DROPPABLE],
      },
      disabled,
    });

    // Keep the column's height while cards collapse during a drag, so targets don't shift under the pointer
    const columnRef = React.useRef<HTMLDivElement | null>(null);
    const [lockedHeight, setLockedHeight] = React.useState<number | null>(null);
    React.useLayoutEffect(() => {
      if (isAnyDragActive) {
        setLockedHeight((current) => current ?? columnRef.current?.offsetHeight ?? null);
      } else {
        setLockedHeight(null);
      }
    }, [isAnyDragActive]);

    const setRefs = (node: HTMLDivElement | null) => {
      columnRef.current = node;
      setNodeRef(node);
    };

    const fields = column.fields;
    const isEmpty = fields.length === 0;

    return (
      <div
        ref={setRefs}
        role="group"
        aria-label={t('block.columnAriaLabel', { values: { index: column.index + 1, total: columnCount } })}
        data-testid={`grid-column-${gridId}-${column.index}`}
        style={lockedHeight ? { minHeight: lockedHeight } : undefined}
        className={cn(
          'min-w-0 flex flex-col rounded-lg p-1.5 transition-colors duration-150',
          isOver && !disabled ? 'bg-[var(--tf-tab-bg)]' : 'bg-[var(--tf-faint)]/50'
        )}
      >
        <ColumnDropIndicator
          pageId={pageId}
          gridId={gridId}
          column={column.index}
          slot={0}
          beforeFieldId={fields[0]?.id ?? null}
          isAnyDragActive={isAnyDragActive}
          disabled={disabled}
        />
        {fields.map((field: FormField, n: number) => (
          <div key={field.id} onClick={stopClick}>
            <DraggableFieldCard
              field={field}
              index={pageIndexOf(field.id)}
              pageId={pageId}
              totalFields={totalFields}
              isRecentlyDropped={field.id === recentlyDroppedFieldId}
              isDelayingExpansion={isDelayingExpansion}
              density="compact"
              columnMoves={{
                up: n > 0 ? { gridId, column: column.index, beforeFieldId: fields[n - 1].id } : undefined,
                down:
                  n < fields.length - 1
                    ? { gridId, column: column.index, beforeFieldId: fields[n + 2]?.id ?? null }
                    : undefined,
              }}
            />
            <ColumnDropIndicator
              pageId={pageId}
              gridId={gridId}
              column={column.index}
              slot={n + 1}
              beforeFieldId={fields[n + 1]?.id ?? null}
              isAnyDragActive={isAnyDragActive}
              disabled={disabled}
            />
          </div>
        ))}
        {isEmpty && (
          <div
            className="flex-1 min-h-[72px] flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[rgba(60,50,62,0.12)] px-2 py-3 text-center"
            data-testid={`grid-column-empty-${gridId}-${column.index}`}
          >
            <span className="text-xs text-[#655d67] dark:text-gray-400 select-none">
              {t('block.emptyColumn')}
            </span>
            {canEdit && !isAnyDragActive && (
              <FieldPickerPopover
                pageId={pageId}
                gridTarget={{ gridId, column: column.index, beforeFieldId: null }}
                idPrefix={`grid-${gridId}-${column.index}-`}
              >
                <button
                  type="button"
                  onClick={stopClick}
                  className="w-6 h-6 rounded-full bg-white dark:bg-card border border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] flex items-center justify-center text-[var(--tf-muted)] hover:text-[var(--tf-dark)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
                  aria-label={t('block.emptyColumn')}
                  data-testid={`grid-column-add-${gridId}-${column.index}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </FieldPickerPopover>
            )}
          </div>
        )}
      </div>
    );
  }
);
GridColumn.displayName = 'GridColumn';

// =============================================================================
// ColumnDivider (resize, §8.5)
// =============================================================================

const ColumnDivider: React.FC<{
  gridId: string;
  index: number;
  widths: number[];
  usableWidth: () => number;
  onPreview: (widths: number[] | null) => void;
  onCommit: (widths: number[]) => void;
}> = ({ gridId, index, widths, usableWidth, onPreview, onCommit }) => {
  const { t } = useTranslation('gridLayout');
  const drag = React.useRef<{ startX: number; startWidths: number[]; latest: number[] } | null>(null);

  const left = widths[index];
  const right = widths[index + 1];
  const offsetBefore = widths.slice(0, index + 1).reduce((s, w) => s + w, 0);
  const gapsTotal = COLUMN_GAP * (widths.length - 1);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidths: widths, latest: widths };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const width = usableWidth();
    if (width <= 0) return;
    const step = e.shiftKey ? 1 : 5;
    const deltaPercent = ((e.clientX - state.startX) / width) * 100;
    const snapped = Math.round(deltaPercent / step) * step;
    const next = resizeAdjacentColumns(state.startWidths, index, snapped);
    state.latest = next;
    onPreview(next);
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onPreview(null);
    if (state.latest.some((w, i) => w !== state.startWidths[i])) onCommit(state.latest);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let delta: number | null = null;
    if (e.key === 'ArrowLeft') delta = e.shiftKey ? -5 : -1;
    else if (e.key === 'ArrowRight') delta = e.shiftKey ? 5 : 1;
    else if (e.key === 'Home') delta = MIN_GRID_COLUMN_PERCENT - left;
    else if (e.key === 'End') delta = right - MIN_GRID_COLUMN_PERCENT;
    if (delta === null) return;
    e.preventDefault();
    e.stopPropagation();
    const next = resizeAdjacentColumns(widths, index, delta);
    if (next.some((w, i) => w !== widths[i])) onCommit(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={left}
      aria-valuemin={MIN_GRID_COLUMN_PERCENT}
      aria-valuemax={left + right - MIN_GRID_COLUMN_PERCENT}
      aria-label={t('block.resizeHandle', { values: { left: index + 1, right: index + 2 } })}
      tabIndex={0}
      data-testid={`grid-divider-${gridId}-${index}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={handleKeyDown}
      onClick={stopClick}
      className="absolute top-0 bottom-0 w-3 -ml-1.5 z-10 flex justify-center cursor-col-resize group/divider touch-none focus-visible:outline-none"
      style={{
        left: `calc((100% - ${gapsTotal}px) * ${offsetBefore / 100} + ${index * COLUMN_GAP + COLUMN_GAP / 2}px)`,
      }}
    >
      <div className="w-0.5 h-full rounded-full bg-transparent group-hover/divider:bg-[var(--tf-border-strong)] group-focus-visible/divider:bg-primary transition-colors" />
    </div>
  );
};

// =============================================================================
// GridBlock
// =============================================================================

export interface GridBlockProps {
  grid: GridField;
  columns: GridColumnNode[];
  pageId: string;
  /** The page's fields in store order (for page-level indices). */
  pageFields: FormField[];
  recentlyDroppedFieldId?: string | null;
  isDelayingExpansion?: boolean;
  isAnyDragActive?: boolean;
}

/** A grid layout block on the builder canvas (§8.2). */
export const GridBlock: React.FC<GridBlockProps> = ({
  grid,
  columns,
  pageId,
  pageFields,
  recentlyDroppedFieldId,
  isDelayingExpansion = false,
  isAnyDragActive = false,
}) => {
  const { t } = useTranslation('gridLayout');
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const canReorder = permissions.canReorderFields();
  const {
    selectedFieldId,
    setSelectedField,
    setGridColumnWidths,
    duplicateGrid,
    pages,
    moveFieldBetweenPages,
    copyFieldToPage,
  } = useFormBuilderStore();
  const deleteGridWithUndo = useDeleteGridWithUndo(canEdit);
  const activeIsGrid = useActiveIsGrid();

  const pageIndex = pageFields.findIndex((f) => f.id === grid.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `existing-field-${grid.id}`,
    data: { type: 'existing-field', field: grid, pageId, index: pageIndex, isGrid: true },
    disabled: !canReorder,
  });

  const committedWidths = React.useMemo(
    () => sanitizeGridColumnWidths(grid.columnWidths),
    [grid.columnWidths]
  );
  // Local widths while a divider is dragged; remote updates wait until pointer-up (§8.5)
  const [previewWidths, setPreviewWidths] = React.useState<number[] | null>(null);
  const widths = previewWidths ?? committedWidths;

  const columnsRef = React.useRef<HTMLDivElement | null>(null);
  const usableWidth = React.useCallback(
    () => (columnsRef.current?.clientWidth ?? 0) - COLUMN_GAP * (widths.length - 1),
    [widths.length]
  );

  const commitWidths = React.useCallback(
    (next: number[]) => {
      if (canEdit) setGridColumnWidths(pageId, grid.id, next);
    },
    [canEdit, setGridColumnWidths, pageId, grid.id]
  );

  const indexById = React.useMemo(
    () => new Map(pageFields.map((f, i) => [f.id, i])),
    [pageFields]
  );
  const pageIndexOf = React.useCallback((id: string) => indexById.get(id) ?? 0, [indexById]);

  const isSelected = selectedFieldId === grid.id;
  const columnCount = columns.length;

  const handleSelect = () => setSelectedField(grid.id);

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = duplicateGrid(pageId, grid.id);
    if (newId) setSelectedField(newId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteGridWithUndo(pageId, grid.id);
  };

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={t('block.ariaLabel', { values: { count: columnCount } })}
      data-testid={`grid-block-${grid.id}`}
      onClick={handleSelect}
      className={cn(
        'group/grid rounded-xl bg-white dark:bg-card p-2.5 transition-all duration-150',
        isDragging ? 'opacity-40' : !isSelected && 'cursor-pointer hover:shadow-sm'
      )}
      style={{
        border: isSelected ? '1.5px solid #3c323e' : '1px dashed rgba(81,76,84,0.25)',
        boxShadow: isSelected ? '0 0 0 3px rgba(60,50,62,0.08)' : undefined,
      }}
    >
      {/* Header: handle, title, live percentages, toolbar */}
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          {canReorder && (
            <div
              {...attributes}
              {...listeners}
              aria-label={t('block.dragHandle')}
              title={t('block.dragHandle')}
              data-testid={`grid-drag-handle-${grid.id}`}
              onClick={stopClick}
              className="flex-shrink-0 p-1 -ml-1 cursor-grab rounded-md transition-colors hover:bg-[var(--tf-tab-bg)]"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground dark:text-gray-500" />
            </div>
          )}
          <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-[var(--tf-icon-gray)] text-foreground dark:bg-[rgba(222,220,222,0.14)] dark:text-gray-200">
            <Columns2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-[#3c323e] dark:text-white">
            {t('block.title', { values: { count: columnCount } })}
          </span>
          <span className="text-[11px] text-[#655d67] dark:text-gray-400 tabular-nums truncate" data-testid={`grid-widths-${grid.id}`}>
            {widths.map((w) => `${w}%`).join(' · ')}
          </span>
        </div>
        <div
          className={cn(
            'flex items-center gap-0.5 transition-opacity duration-100',
            isSelected ? 'opacity-100' : 'opacity-0 group-hover/grid:opacity-100 focus-within:opacity-100'
          )}
        >
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect();
            }}
            className="p-1.5 rounded-lg h-auto"
            title={t('block.settings')}
            aria-label={t('block.settings')}
            data-testid={`grid-settings-button-${grid.id}`}
          >
            <Settings className="w-4 h-4" />
          </Button>
          {canEdit && (
            <>
              <Button
                variant="ghost"
                onClick={handleDuplicate}
                className="p-1.5 rounded-lg h-auto"
                title={t('block.duplicate')}
                aria-label={t('block.duplicate')}
                data-testid={`grid-duplicate-button-${grid.id}`}
              >
                <Copy className="w-4 h-4" />
              </Button>
              {/* The store's grid branches move or copy the whole block, questions included (§7.4) */}
              <PageActionsSelector
                pages={pages ?? []}
                currentPageId={pageId}
                onMoveToPage={(targetPageId) => moveFieldBetweenPages(pageId, targetPageId, grid.id)}
                onCopyToPage={(targetPageId) => copyFieldToPage(pageId, targetPageId, grid.id)}
                triggerElement={
                  <Button
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg h-auto"
                    title={t('block.moveOrCopy')}
                    aria-label={t('block.moveOrCopy')}
                    data-testid={`grid-page-actions-button-${grid.id}`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                onClick={handleDelete}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-[var(--tf-error-bg)] dark:hover:bg-red-950/30 rounded-lg h-auto"
                title={t('block.delete')}
                aria-label={t('block.delete')}
                data-testid={`grid-delete-button-${grid.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Columns */}
      <div
        ref={columnsRef}
        className="relative grid"
        style={{
          gridTemplateColumns: widths.map((w) => `minmax(0, ${w}fr)`).join(' '),
          columnGap: COLUMN_GAP,
        }}
      >
        {columns.map((column) => (
          <GridColumn
            key={column.index}
            pageId={pageId}
            gridId={grid.id}
            column={column}
            columnCount={columnCount}
            pageIndexOf={pageIndexOf}
            totalFields={pageFields.length}
            recentlyDroppedFieldId={recentlyDroppedFieldId}
            isDelayingExpansion={isDelayingExpansion}
            isAnyDragActive={isAnyDragActive}
            dropDisabled={activeIsGrid}
          />
        ))}
        {canEdit &&
          !isAnyDragActive &&
          widths.slice(0, -1).map((_, i) => (
            <ColumnDivider
              key={i}
              gridId={grid.id}
              index={i}
              widths={widths}
              usableWidth={usableWidth}
              onPreview={setPreviewWidths}
              onCommit={commitWidths}
            />
          ))}
      </div>
    </div>
  );
};
