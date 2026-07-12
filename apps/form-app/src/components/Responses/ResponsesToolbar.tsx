import React, { useState } from 'react';
import { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  Checkbox,
  DateTimeRangePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  type DateTimeRangeValue,
} from '@dculus/ui';
import {
  AlignJustify,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GripVertical,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { FilterState } from '../Filters';
import { FillableFormField } from '@dculus/types';

interface SortableColumnItemProps {
  columnId: string;
  label: string;
  isVisible: boolean;
  onVisibilityChange: (checked: boolean) => void;
  dragHint: string;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({
  columnId,
  label,
  isVisible,
  onVisibilityChange,
  dragHint,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--tf-tab-bg)]"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={dragHint}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-0.5 bg-transparent border-0 rounded"
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Checkbox
        id={`col-${columnId}`}
        checked={isVisible}
        onCheckedChange={(checked) => onVisibilityChange(!!checked)}
      />
      <Label
        htmlFor={`col-${columnId}`}
        className="text-xs flex-1 min-w-0 truncate cursor-pointer font-normal text-foreground"
        title={label}
      >
        {label}
      </Label>
    </div>
  );
};

interface ResponsesToolbarProps {
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  filters: Record<string, FilterState>;
  fillableFields: FillableFormField[];
  onShowFilterModal: () => void;
  columns: ColumnDef<any>[];
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => void;
  onColumnOrderChange: (order: string[]) => void;
  submittedAtFilter: DateTimeRangeValue | null;
  onSubmittedAtFilterChange: (filter: DateTimeRangeValue | null) => void;
  rowDensity: 'compact' | 'default' | 'comfortable';
  onRowDensityChange: (density: 'compact' | 'default' | 'comfortable') => void;
  formTags: { id: string; name: string; color: string }[];
  selectedTagIds: string[];
  onToggleTagFilter: (tagId: string) => void;
  onClearTagFilters: () => void;
  getColumnLabel: (columnId: string) => string;
  isExporting: boolean;
  onExportExcel: () => void;
  onExportCsv: () => void;
  isGeneratingFakeResponses: boolean;
  maxFakeResponses: number;
  onGenerateFakeResponses: (count: number) => void;
  t: (key: string, options?: { values?: Record<string, string | number>; defaultValue?: string }) => string;
}


export const ResponsesToolbar: React.FC<ResponsesToolbarProps> = ({
  globalFilter,
  onGlobalFilterChange,
  filters,
  onShowFilterModal,
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  onColumnOrderChange,
  submittedAtFilter,
  onSubmittedAtFilterChange,
  rowDensity,
  onRowDensityChange,
  formTags,
  selectedTagIds,
  onToggleTagFilter,
  onClearTagFilters,
  getColumnLabel,
  isExporting,
  onExportExcel,
  onExportCsv,
  isGeneratingFakeResponses,
  maxFakeResponses,
  onGenerateFakeResponses,
  t,
}) => {
  const activeFilters = Object.values(filters).filter((f) => f.active);
  const hiddenColumns = columns.filter((col) => col.id && columnVisibility[col.id] === false);
  const [showFakeResponsesDialog, setShowFakeResponsesDialog] = useState(false);
  const [fakeResponseCount, setFakeResponseCount] = useState(5);

  // Hideable columns in their current display order
  const hideableColumnIds = columns
    .filter((c) => c.id && c.enableHiding !== false)
    .map((c) => c.id!);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = hideableColumnIds.indexOf(String(active.id));
    const newIdx = hideableColumnIds.indexOf(String(over.id));
    if (oldIdx !== -1 && newIdx !== -1) {
      onColumnOrderChange(arrayMove(hideableColumnIds, oldIdx, newIdx));
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 w-full bg-white"
    >
      {/* Left: search + filter */}
      <div className="flex items-center gap-2 flex-1 min-w-0">

        {/* Search */}
        <div className="relative flex-1 min-w-[100px] sm:w-56 sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('toolbar.search.placeholder')}
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className="h-8 pl-9 pr-8 text-xs"
          />
          {globalFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-8 w-8 rounded-l-none"
              onClick={() => onGlobalFilterChange('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Submitted-date quick filter — hidden on mobile */}
        <div className="hidden sm:block shrink-0">
          <DateTimeRangePicker
            value={submittedAtFilter}
            onChange={onSubmittedAtFilterChange}
            labels={{
              allTime: t('toolbar.dateRange.allTime'),
              last24Hours: t('toolbar.dateRange.last24Hours'),
              last7Days: t('toolbar.dateRange.last7Days'),
              last30Days: t('toolbar.dateRange.last30Days'),
              customRange: t('toolbar.dateRange.customRange'),
              apply: t('toolbar.dateRange.apply'),
              cancel: t('toolbar.dateRange.cancel'),
              fromTime: t('toolbar.dateRange.fromTime'),
              toTime: t('toolbar.dateRange.toTime'),
            }}
          />
        </div>

        {/* Tag filter chips + picker */}
        {formTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap shrink-0">
            {selectedTagIds.map((tagId) => {
              const tag = formTags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() => onToggleTagFilter(tagId)}
                    className="opacity-70 hover:opacity-100"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs shrink-0">
                  <Tag className="h-3 w-3" />
                  {t('toolbar.tags.filter')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {formTags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    onClick={() => onToggleTagFilter(tag.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-xs">{tag.name}</span>
                    {selectedTagIds.includes(tag.id) && (
                      <span className="text-[10px] text-primary font-semibold">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
                {selectedTagIds.length > 0 && (
                  <>
                    <div className="border-t mx-1 my-1" />
                    <DropdownMenuItem
                      onClick={onClearTagFilters}
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      {t('toolbar.tags.clearFilter')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Filter button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onShowFilterModal}
          data-testid="filter-button"
          className="gap-1.5 shrink-0"
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('toolbar.filters.buttonLabel')}</span>
          {activeFilters.length > 0 && (
            <span
              className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full"
              style={{ backgroundColor: '#f6fafd', color: '#01487f', border: '1px solid rgb(189,221,249)' }}
            >
              {activeFilters.length}
            </span>
          )}
        </Button>
      </div>

      {/* Right: density + column visibility + export */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Row density toggle — hidden on mobile */}
        <div
          className="hidden sm:flex items-center rounded-md border overflow-hidden shrink-0"
          style={{ borderColor: 'var(--tf-border-strong)', height: '32px' }}
        >
          {(['compact', 'default', 'comfortable'] as const).map((d, i) => (
            <button
              key={d}
              onClick={() => onRowDensityChange(d)}
              title={t(`toolbar.density.${d}`)}
              className="flex items-center justify-center transition-colors"
              style={{
                width: '28px',
                height: '100%',
                background: rowDensity === d ? 'var(--tf-faint)' : 'transparent',
                borderRight: i < 2 ? '1px solid var(--tf-border-strong)' : 'none',
                cursor: 'pointer',
                border: rowDensity === d ? undefined : 'none',
              }}
            >
              <AlignJustify
                className="transition-all"
                style={{
                  width: d === 'compact' ? 12 : d === 'comfortable' ? 16 : 14,
                  height: d === 'compact' ? 12 : d === 'comfortable' ? 16 : 14,
                  color: rowDensity === d ? 'var(--tf-dark)' : 'var(--tf-text)',
                  strokeWidth: d === 'compact' ? 2.5 : d === 'comfortable' ? 1.5 : 2,
                }}
              />
            </button>
          ))}
        </div>

        {/* Column visibility + reorder */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('toolbar.columns.buttonLabel')}</span>
              {hiddenColumns.length > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full"
                  style={{ backgroundColor: 'var(--tf-faint)', color: 'var(--tf-text)', border: '1px solid var(--tf-border-strong)' }}
                >
                  {t('toolbar.columns.hiddenCount', { values: { count: hiddenColumns.length } })}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex flex-col max-h-80">
              <div
                className="flex items-center justify-between px-3 py-2.5 text-xs font-medium"
                style={{ borderBottom: '1px solid var(--tf-border-light)', color: 'var(--tf-dark)' }}
              >
                <span>{t('toolbar.columns.toggle')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 h-7 px-2 text-[10px]"
                  onClick={() => {
                    onColumnVisibilityChange({});
                    onColumnOrderChange([]);
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('toolbar.columns.reset')}
                </Button>
              </div>
              <div className="overflow-y-auto flex-1 p-1.5">
                {hideableColumnIds.length === 0 ? (
                  <div className="text-center text-xs py-4 text-muted-foreground">
                    {t('toolbar.columns.noColumnsAvailable')}
                  </div>
                ) : (
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={hideableColumnIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-0.5">
                        {hideableColumnIds.map((colId) => {
                          const isVisible = columnVisibility[colId] !== false;
                          return (
                            <SortableColumnItem
                              key={colId}
                              columnId={colId}
                              label={getColumnLabel(colId)}
                              isVisible={isVisible}
                              onVisibilityChange={(checked) =>
                                onColumnVisibilityChange((prev) => ({ ...prev, [colId]: checked }))
                              }
                              dragHint={t('toolbar.columns.dragToReorder')}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Fake Response (AI) */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          disabled={isGeneratingFakeResponses}
          aria-label={
            isGeneratingFakeResponses
              ? t('toolbar.fakeResponses.generating')
              : t('toolbar.fakeResponses.buttonLabel')
          }
          onClick={() => {
            setFakeResponseCount(Math.min(5, maxFakeResponses));
            setShowFakeResponsesDialog(true);
          }}
        >
          {isGeneratingFakeResponses ? (
            <div
              className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--tf-border-strong)', borderTopColor: 'var(--tf-dark)' }}
            />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isGeneratingFakeResponses
              ? t('toolbar.fakeResponses.generating')
              : t('toolbar.fakeResponses.buttonLabel')}
          </span>
        </Button>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting} className="gap-1.5 shrink-0">
              {isExporting ? (
                <>
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--tf-border-strong)', borderTopColor: 'var(--tf-dark)' }}
                  />
                  {t('toolbar.export.exporting')}
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('toolbar.export.buttonLabel')}</span>
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportExcel} disabled={isExporting}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t('toolbar.export.excel')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportCsv} disabled={isExporting}>
              <FileText className="h-4 w-4 mr-2" />
              {t('toolbar.export.csv')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showFakeResponsesDialog} onOpenChange={setShowFakeResponsesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t('toolbar.fakeResponses.dialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('toolbar.fakeResponses.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="fake-response-count">
              {t('toolbar.fakeResponses.dialog.countLabel')}
            </Label>
            <Input
              id="fake-response-count"
              type="number"
              min={1}
              max={maxFakeResponses}
              step={1}
              value={fakeResponseCount}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setFakeResponseCount(1);
                  return;
                }
                const parsed = Number(raw);
                // Reject non-integers (e.g. "3.5") instead of silently truncating them.
                if (!Number.isInteger(parsed)) return;
                setFakeResponseCount(Math.max(1, Math.min(parsed, maxFakeResponses)));
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t('toolbar.fakeResponses.dialog.countHint', { values: { max: maxFakeResponses } })}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFakeResponsesDialog(false)}
              disabled={isGeneratingFakeResponses}
            >
              {t('toolbar.fakeResponses.dialog.cancel')}
            </Button>
            <Button
              onClick={() => {
                setShowFakeResponsesDialog(false);
                onGenerateFakeResponses(fakeResponseCount);
              }}
              disabled={isGeneratingFakeResponses}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('toolbar.fakeResponses.dialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
