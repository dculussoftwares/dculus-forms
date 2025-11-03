import React from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { FilterRow } from './FilterRow';
import { FillableFormField } from '@dculus/types';
import { FilterState } from './FilterPanel';

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  fields: FillableFormField[];
  filters: Record<string, FilterState>;
  onFilterChange: (fieldId: string, filter: Partial<FilterState>) => void;
  onRemoveFilter: (fieldId: string) => void;
  onClearAllFilters: () => void;
  onApplyFilters: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  open,
  onClose,
  fields,
  filters,
  onFilterChange,
  onRemoveFilter,
  onClearAllFilters,
  onApplyFilters,
}) => {
  const { t } = useTranslation('filterModal');
  const activeFilters = Object.entries(filters);

  const handleAddFilter = () => {
    const newFilterId = `filter_${Date.now()}`;
    onFilterChange(newFilterId, {
      fieldId: '',
      operator: '',
      value: undefined,
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
      active: false,
    });
  };

  const handleRemoveFilter = (filterId: string) => {
    onRemoveFilter(filterId);
  };

  const handleApply = () => {
    onApplyFilters();
    onClose();
  };

  const activeFilterCount = Object.values(filters).filter(f => f.active).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {t('title')}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {t('subtitle')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Show existing filters */}
            {activeFilters.length > 0 ? (
              <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                {activeFilters.map(([filterId, filter], index) => (
                  <FilterRow
                    key={filterId}
                    fields={fields}
                    filter={filter}
                    onChange={(updates) => onFilterChange(filterId, updates)}
                    onRemove={() => handleRemoveFilter(filterId)}
                    isFirst={index === 0}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-slate-500 text-lg mb-4">{t('emptyState.title')}</div>
                <p className="text-slate-400 text-sm mb-6">
                  {t('emptyState.description')}
                </p>
              </div>
            )}

            {/* Add filter button */}
            <div className="flex items-center justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleAddFilter}
                className="text-slate-600 hover:text-slate-900 border-dashed border-2 hover:border-solid hover:border-slate-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('buttons.addFilter')}
              </Button>
            </div>

          </div>
        </div>

        {/* Footer with actions */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-4">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={onClearAllFilters}
                className="text-slate-600 hover:text-slate-900"
              >
                {t('buttons.clearAll')}
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
            >
              {t('buttons.cancel')}
            </Button>
            <Button
              onClick={handleApply}
              className="bg-slate-900 hover:bg-slate-800 text-white"
              disabled={activeFilterCount === 0}
            >
              {t('buttons.apply')} {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};