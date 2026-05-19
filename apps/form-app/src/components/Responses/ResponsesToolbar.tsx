import React from 'react';
import { ColumnDef, VisibilityState } from '@tanstack/react-table';
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
} from '@dculus/ui';
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RotateCcw,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { FilterState } from '../Filters';
import { FillableFormField } from '@dculus/types';

interface ResponsesToolbarProps {
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  filters: Record<string, FilterState>;
  fillableFields: FillableFormField[];
  onShowFilterModal: () => void;
  onRemoveFilter: (fieldId: string) => void;
  columns: ColumnDef<any>[];
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => void;
  getColumnLabel: (columnId: string) => string;
  isExporting: boolean;
  onExportExcel: () => void;
  onExportCsv: () => void;
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
  getColumnLabel,
  isExporting,
  onExportExcel,
  onExportCsv,
  t,
}) => {
  const activeFilters = Object.values(filters).filter((f) => f.active);
  const hiddenColumns = columns.filter((col) => col.id && columnVisibility[col.id] === false);

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 w-full bg-white"
    >
      {/* Left: search + filter */}
      <div className="flex items-center gap-2 flex-1 min-w-0">

        {/* Search */}
        <div className="relative w-56 shrink-0">
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

        {/* Filter button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onShowFilterModal}
          data-testid="filter-button"
          className="gap-1.5 shrink-0"
        >
          <Filter className="h-3.5 w-3.5" />
          {t('toolbar.filters.buttonLabel')}
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

      {/* Right: column visibility + export */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Column visibility */}
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
          <DropdownMenuContent align="end" className="w-60">
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
                  onClick={() => onColumnVisibilityChange({})}
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('toolbar.columns.reset')}
                </Button>
              </div>
              <div className="overflow-y-auto flex-1 p-1.5">
                {columns.length === 0 ? (
                  <div className="text-center text-xs py-4 text-muted-foreground">
                    {t('toolbar.columns.noColumnsAvailable')}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {columns.map((column) => {
                      if (!column.id || column.enableHiding === false) return null;
                      const isVisible = columnVisibility[column.id] !== false;
                      const columnLabel = getColumnLabel(column.id);
                      return (
                        <Label
                          key={column.id}
                          htmlFor={`col-${column.id}`}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors font-normal hover:bg-[var(--tf-tab-bg)] text-foreground"
                        >
                          <Checkbox
                            id={`col-${column.id}`}
                            checked={isVisible}
                            onCheckedChange={(checked) =>
                              onColumnVisibilityChange((prev) => ({ ...prev, [column.id!]: !!checked }))
                            }
                          />
                          <span className="text-xs flex-1 min-w-0 truncate" title={columnLabel}>
                            {columnLabel}
                          </span>
                        </Label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

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
    </div>
  );
};
