import React from 'react';
import { ColumnDef, VisibilityState } from '@tanstack/react-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

/* Reusable Typeform ghost button — exact rgba(255,255,255,0.8) + rgba(81,76,84,0.15) */
const TfBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }> = ({
  children, className = '', style, ...props
}) => (
  <button
    className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    style={{
      backgroundColor: 'rgba(255,255,255,0.8)',
      color: '#655d67',
      border: '1px solid rgba(81,76,84,0.15)',
      ...style,
    }}
    onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) { (e.currentTarget as HTMLElement).style.backgroundColor = '#f7f7f8'; (e.currentTarget as HTMLElement).style.color = '#4c414e'; } }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.8)'; (e.currentTarget as HTMLElement).style.color = '#655d67'; }}
    {...props}
  >
    {children}
  </button>
);

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
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 w-full"
      style={{ borderBottom: '1px solid rgba(81,76,84,0.08)', backgroundColor: '#f7f7f8' }}
    >
      {/* Left: search + filter + active chips */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0 flex-wrap">

        {/* Search — Typeform ghost input */}
        <div className="relative w-full sm:w-64 sm:max-w-xs min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
            style={{ color: '#655d67' }}
          />
          <input
            type="text"
            placeholder={t('toolbar.search.placeholder')}
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className="w-full h-8 pl-9 pr-8 text-xs rounded-lg transition-colors focus:outline-none"
            style={{
              backgroundColor: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(81,76,84,0.15)',
              color: '#4c414e',
            }}
          />
          {globalFilter && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
              style={{ color: '#655d67' }}
              onClick={() => onGlobalFilterChange('')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter toggle — exact Typeform ghost */}
        <TfBtn
          onClick={onShowFilterModal}
          data-testid="filter-button"
        >
          <Filter className="h-3.5 w-3.5" />
          {t('toolbar.filters.buttonLabel')}
          {activeFilters.length > 0 && (
            /* Typeform exact: #f6fafd bg, #01487f text, blue border */
            <span
              className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full"
              style={{ backgroundColor: '#f6fafd', color: '#01487f', border: '1px solid rgb(189,221,249)' }}
            >
              {activeFilters.length}
            </span>
          )}
        </TfBtn>

        {/* Active filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {globalFilter && (
            <div
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg"
              style={{ backgroundColor: '#f6fafd', color: '#01487f', border: '1px solid rgb(189,221,249)' }}
            >
              <span className="truncate max-w-28">
                {t('table.searchIndicator', {
                  values: { query: `${globalFilter.slice(0, 15)}${globalFilter.length > 15 ? '…' : ''}` }
                })}
              </span>
              <button
                className="flex-shrink-0 p-0.5 rounded transition-opacity hover:opacity-70"
                onClick={() => onGlobalFilterChange('')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {Object.entries(filters)
            .filter(([, f]) => f.active)
            .map(([filterId, filter]) => {
              const field = fillableFields.find((f) => f.id === filter.fieldId);
              return field ? (
                <FilterChip key={filterId} field={field} filter={filter} onRemove={() => onRemoveFilter(filterId)} />
              ) : null;
            })}
        </div>
      </div>

      {/* Right: column visibility + export */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#655d67', border: '1px solid rgba(81,76,84,0.15)' }}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('toolbar.columns.buttonLabel')}</span>
              {hiddenColumns.length > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full"
                  style={{ backgroundColor: '#f7f7f8', color: '#4c414e', border: '1px solid rgba(81,76,84,0.15)' }}
                >
                  {t('toolbar.columns.hiddenCount', { values: { count: hiddenColumns.length } })}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="flex flex-col max-h-80">
              <div
                className="flex items-center justify-between px-3 py-2.5 text-xs font-medium"
                style={{ borderBottom: '1px solid rgba(81,76,84,0.08)', color: '#3c323e' }}
              >
                <span>{t('toolbar.columns.toggle')}</span>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors"
                  style={{ color: '#655d67' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(87,84,91,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  onClick={() => onColumnVisibilityChange({})}
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('toolbar.columns.reset')}
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-1.5">
                {columns.length === 0 ? (
                  <div className="text-center text-xs py-4" style={{ color: '#655d67' }}>
                    {t('toolbar.columns.noColumnsAvailable')}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {columns.map((column) => {
                      if (!column.id || column.enableHiding === false) return null;
                      const isVisible = columnVisibility[column.id] !== false;
                      const columnLabel = getColumnLabel(column.id);
                      return (
                        <label
                          key={column.id}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                          style={{ color: '#4c414e' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(87,84,91,0.06)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) =>
                              onColumnVisibilityChange((prev) => ({ ...prev, [column.id!]: e.target.checked }))
                            }
                            className="h-4 w-4 rounded-[4px]"
                            style={{ accentColor: '#3c323e' }}
                          />
                          <span className="text-xs flex-1 min-w-0 truncate" title={columnLabel}>
                            {columnLabel}
                          </span>
                        </label>
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
            <button
              disabled={isExporting}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#655d67', border: '1px solid rgba(81,76,84,0.15)' }}
            >
              {isExporting ? (
                <>
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(81,76,84,0.15)', borderTopColor: '#3c323e' }}
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
            </button>
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
