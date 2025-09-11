import React from 'react';
import { X, Filter } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@dculus/ui';
import { FieldFilter } from './FieldFilter';
import { FillableFormField } from '@dculus/types';

export interface FilterState {
  fieldId: string;
  operator: string;
  value?: string;
  values?: string[];
  dateRange?: { from?: string; to?: string };
  numberRange?: { min?: number; max?: number };
  active: boolean;
}

interface FilterPanelProps {
  fields: FillableFormField[];
  filters: Record<string, FilterState>;
  onFilterChange: (fieldId: string, filter: Partial<FilterState>) => void;
  onClearAllFilters: () => void;
  onClose: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  fields,
  filters,
  onFilterChange,
  onClearAllFilters,
  onClose,
}) => {
  const activeFiltersCount = Object.values(filters).filter(f => f.active).length;

  return (
    <Card className="w-80 h-full overflow-hidden border-r border-slate-200 rounded-none shadow-sm flex flex-col">
      <CardHeader className="pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600" />
            <CardTitle className="text-lg font-semibold text-slate-900">
              Filters
            </CardTitle>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close filters</span>
          </Button>
        </div>
        {activeFiltersCount > 0 && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAllFilters}
              className="h-7 text-xs"
            >
              Clear all filters
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-y-auto">
        <div className="min-h-0">
          {fields.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No filterable fields available
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {fields.map((field) => (
                <FieldFilter
                  key={field.id}
                  field={field}
                  filter={filters[field.id]}
                  onChange={(filter) => onFilterChange(field.id, filter)}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};