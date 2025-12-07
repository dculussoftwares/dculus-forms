/**
 * Responses Toolbar Component
 *
 * Toolbar for the responses table with search, filters, column visibility, and export.
 * Provides a comprehensive set of controls for managing and exporting form responses.
 */

import React from 'react';
import { ColumnDef, VisibilityState } from '@tanstack/react-table';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
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
import { FilterChip, FilterState } from '../Filters';
import { FillableFormField } from '@dculus/types';

interface ResponsesToolbarProps {
  // Search
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;

  // Filters
  filters: Record<string, FilterState>;
  fillableFields: FillableFormField[];
  onShowFilterModal: () => void;
  onRemoveFilter: (fieldId: string) => void;

  // Column visibility
  columns: ColumnDef<any>[];
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => void;
  getColumnLabel: (columnId: string) => string;

  // Export
  isExporting: boolean;
  onExportExcel: () => void;
  onExportCsv: () => void;

  // Translation
  t: (key: string, options?: { values?: Record<string, string | number>; defaultValue?: string }) => string;
}

export const ResponsesToolbar: React.FC<ResponsesToolbarProps> = ({
  globalFilter,
  onGlobalFilterChange,
  filters,
  fillableFields,
  onShowFilterModal,
  onRemoveFilter,
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50/80 border-b border-slate-200/40 w-full overflow-hidden">
      {/* Left side - Search and filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 min-w-0 overflow-hidden">
        {/* Enhanced search */}
        <div className="relative w-full sm:w-80 sm:max-w-[320px] min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('toolbar.search.placeholder')}
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className="pl-9 h-10 w-full"
          />
          {globalFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
              onClick={() => onGlobalFilterChange('')}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t('toolbar.search.clearLabel')}</span>
            </Button>
          )}
        </div>

        {/* Filter toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={onShowFilterModal}
          className="flex-shrink-0"
          data-testid="filter-button"
        >
          <Filter className="h-4 w-4 mr-2" />
          {t('toolbar.filters.buttonLabel')}
          {activeFilters.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100/80 text-blue-800 text-xs rounded-full font-medium border border-blue-200/40">
              {activeFilters.length}
            </span>
          )}
        </Button>

        {/* Active filters display */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search indicator */}
          {globalFilter && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50/80 text-blue-700 text-sm rounded-md border border-blue-200/60">
              <span className="truncate max-w-32">
                {t('table.searchIndicator', {
                  values: {
                    query: `${globalFilter.slice(0, 15)}${globalFilter.length > 15 ? '...' : ''}`
                  }
                })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent text-blue-700 flex-shrink-0"
                onClick={() => onGlobalFilterChange('')}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Field filters */}
          {Object.entries(filters)
            .filter(([, f]) => f.active)
            .map(([filterId, filter]) => {
              const field = fillableFields.find((f) => f.id === filter.fieldId);
              return field ? (
                <FilterChip
                  key={filterId}
                  field={field}
                  filter={filter}
                  onRemove={() => onRemoveFilter(filterId)}
                />
              ) : null;
            })}
        </div>
      </div>

      {/* Right side - Actions and column visibility */}
      <div className="flex items-center gap-3 flex-shrink-0 overflow-visible">
        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <Settings2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('toolbar.columns.buttonLabel')}</span>
              {hiddenColumns.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-slate-100/80 text-slate-700 text-xs rounded-full font-medium border border-slate-200/40">
                  {t('toolbar.columns.hiddenCount', { values: { count: hiddenColumns.length } })}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex flex-col max-h-80">
              <div className="flex items-center justify-between p-3 pb-2 border-b flex-shrink-0">
                <span className="text-sm font-medium">{t('toolbar.columns.toggle')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onColumnVisibilityChange({})}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t('toolbar.columns.reset')}
                </Button>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                {columns.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-4">
                    {t('toolbar.columns.noColumnsAvailable')}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {columns.map((column) => {
                      if (!column.id || column.enableHiding === false) return null;
                      const isVisible = columnVisibility[column.id] !== false;
                      const columnLabel = getColumnLabel(column.id);

                      return (
                        <div
                          key={column.id}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) =>
                              onColumnVisibilityChange((prev) => ({
                                ...prev,
                                [column.id!]: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span
                            className="text-sm flex-1 min-w-0 truncate"
                            title={columnLabel}
                          >
                            {columnLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isExporting}
              className="flex-shrink-0"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  {t('toolbar.export.exporting')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t('toolbar.export.buttonLabel')}</span>
                  <ChevronDown className="h-4 w-4 ml-2" />
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
