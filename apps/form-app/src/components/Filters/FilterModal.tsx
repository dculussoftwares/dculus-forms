import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Checkbox,
} from '@dculus/ui';
import { FillableFormField, FieldType, SelectField, RadioField, CheckboxField } from '@dculus/types';
import { getFieldIcon } from '../utils/fieldIcons';

export interface FilterState {
  fieldId: string;
  operator: string;
  value?: string;
  values?: string[];
  dateRange?: { from?: string; to?: string };
  numberRange?: { min?: number; max?: number };
  active: boolean;
}

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FillableFormField[];
  filters: Record<string, FilterState>;
  onFilterChange: (fieldId: string, filter: Partial<FilterState>) => void;
  onClearAllFilters: () => void;
  onApplyFilters: () => void;
}

// Keep all existing operator options logic
const getOperatorOptions = (fieldType: FieldType) => {
  const baseOptions = [
    { value: 'IS_EMPTY', label: 'is empty' },
    { value: 'IS_NOT_EMPTY', label: 'is not empty' },
  ];

  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.EMAIL_FIELD:
      return [
        { value: 'CONTAINS', label: 'includes' },
        { value: 'NOT_CONTAINS', label: 'does not include' },
        { value: 'EQUALS', label: 'equals' },
        { value: 'NOT_EQUALS', label: 'does not equal' },
        { value: 'STARTS_WITH', label: 'starts with' },
        { value: 'ENDS_WITH', label: 'ends with' },
        ...baseOptions,
      ];

    case FieldType.NUMBER_FIELD:
      return [
        { value: 'EQUALS', label: 'equals' },
        { value: 'NOT_EQUALS', label: 'does not equal' },
        { value: 'GREATER_THAN', label: 'is greater than' },
        { value: 'LESS_THAN', label: 'is less than' },
        { value: 'BETWEEN', label: 'is between' },
        ...baseOptions,
      ];

    case FieldType.DATE_FIELD:
      return [
        { value: 'DATE_EQUALS', label: 'is on' },
        { value: 'DATE_BEFORE', label: 'is before' },
        { value: 'DATE_AFTER', label: 'is after' },
        { value: 'DATE_BETWEEN', label: 'is between' },
        ...baseOptions,
      ];

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      return [
        { value: 'IN', label: 'includes' },
        { value: 'NOT_IN', label: 'does not include' },
        ...baseOptions,
      ];

    default:
      return baseOptions;
  }
};

// Keep all existing filter input rendering logic
const renderFilterInput = (
  field: FillableFormField,
  filter: FilterState | undefined,
  onChange: (filter: Partial<FilterState>) => void
) => {
  if (!filter?.operator || filter.operator === 'IS_EMPTY' || filter.operator === 'IS_NOT_EMPTY') {
    return null;
  }

  const handleValueChange = (value: string) => {
    onChange({ value, active: true });
  };

  const handleNumberRangeChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    onChange({
      numberRange: {
        ...filter.numberRange,
        [type]: numValue,
      },
      active: true,
    });
  };

  const handleDateRangeChange = (type: 'from' | 'to', value: string) => {
    onChange({
      dateRange: {
        ...filter.dateRange,
        [type]: value || undefined,
      },
      active: true,
    });
  };

  switch (field.type) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.EMAIL_FIELD:
      return (
        <Input
          placeholder="Enter value..."
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-full"
        />
      );

    case FieldType.NUMBER_FIELD:
      if (filter.operator === 'BETWEEN') {
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filter.numberRange?.min ?? ''}
              onChange={(e) => handleNumberRangeChange('min', e.target.value)}
              className="flex-1"
            />
            <span className="text-slate-500 text-sm">and</span>
            <Input
              type="number"
              placeholder="Max"
              value={filter.numberRange?.max ?? ''}
              onChange={(e) => handleNumberRangeChange('max', e.target.value)}
              className="flex-1"
            />
          </div>
        );
      }
      return (
        <Input
          type="number"
          placeholder="Enter number..."
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-full"
        />
      );

    case FieldType.DATE_FIELD:
      if (filter.operator === 'DATE_BETWEEN') {
        return (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filter.dateRange?.from || ''}
              onChange={(e) => handleDateRangeChange('from', e.target.value)}
              className="flex-1"
            />
            <span className="text-slate-500 text-sm">and</span>
            <Input
              type="date"
              value={filter.dateRange?.to || ''}
              onChange={(e) => handleDateRangeChange('to', e.target.value)}
              className="flex-1"
            />
          </div>
        );
      }
      return (
        <Input
          type="date"
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-full"
        />
      );

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      const options = (field as SelectField | RadioField | CheckboxField).options || [];
      return (
        <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto bg-slate-50">
          {options.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No options available
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {options.map((option, index) => {
                const isSelected = filter.values?.includes(option) ?? false;
                return (
                  <div key={index} className="flex items-center space-x-2 p-2 rounded hover:bg-white">
                    <Checkbox
                      id={`${field.id}-${index}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const currentValues = filter.values || [];
                        const newValues = checked
                          ? [...currentValues, option]
                          : currentValues.filter(v => v !== option);
                        onChange({ values: newValues, active: newValues.length > 0 });
                      }}
                    />
                    <label
                      htmlFor={`${field.id}-${index}`}
                      className="text-sm cursor-pointer flex-1 min-w-0 truncate"
                      title={option}
                    >
                      {option}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
};

const FilterCondition: React.FC<{
  field?: FillableFormField;
  filter?: FilterState;
  fields: FillableFormField[];
  onChange: (fieldId: string, filter: Partial<FilterState>) => void;
  onRemove: () => void;
  isFirst: boolean;
}> = ({ field, filter, fields, onChange, onRemove, isFirst }) => {
  const handleFieldChange = (fieldId: string) => {
    const newField = fields.find(f => f.id === fieldId);
    if (!newField) return;
    
    // Reset filter when field changes
    onChange(fieldId, {
      fieldId,
      operator: '',
      value: undefined,
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
      active: false,
    });
  };

  const handleOperatorChange = (operator: string) => {
    if (!field) return;
    onChange(field.id, { 
      operator, 
      value: undefined, 
      values: undefined, 
      dateRange: undefined, 
      numberRange: undefined,
      active: operator === 'IS_EMPTY' || operator === 'IS_NOT_EMPTY' 
    });
  };

  const operatorOptions = field ? getOperatorOptions(field.type) : [];

  return (
    <div className="bg-slate-50/50 border border-slate-200/60 rounded-lg p-4 space-y-4">
      {/* Show "and" connector for non-first conditions */}
      {!isFirst && (
        <div className="flex items-center justify-center -mt-2 -mb-2">
          <span className="bg-white px-3 py-1 text-sm font-medium text-slate-600 border border-slate-200 rounded-full">
            and
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Field Selection */}
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium text-slate-700">Field</label>
          <Select value={field?.id || ''} onValueChange={handleFieldChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a field..." />
            </SelectTrigger>
            <SelectContent className="max-w-[400px] overflow-x-auto">
              {fields.map((f) => (
                <SelectItem key={f.id} value={f.id} className="whitespace-nowrap">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <div className="text-slate-500 flex-shrink-0">
                      {getFieldIcon(f.type)}
                    </div>
                    <span className="whitespace-nowrap" title={f.label}>
                      {f.label}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operator Selection */}
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium text-slate-700">Condition</label>
          <Select 
            value={filter?.operator || ''} 
            onValueChange={handleOperatorChange}
            disabled={!field}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select condition..." />
            </SelectTrigger>
            <SelectContent>
              {operatorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Remove button */}
        <div className="flex items-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-10 w-10 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Remove condition</span>
          </Button>
        </div>
      </div>

      {/* Value Input */}
      {field && filter?.operator && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Value</label>
          {renderFilterInput(field, filter, (update) => onChange(field.id, update))}
        </div>
      )}
    </div>
  );
};

export const FilterModal: React.FC<FilterModalProps> = ({
  open,
  onOpenChange,
  fields,
  filters,
  onFilterChange,
  onClearAllFilters,
  onApplyFilters,
}) => {
  const [tempConditions, setTempConditions] = React.useState<string[]>([]);
  const activeFilters = Object.values(filters).filter(f => f.active);
  
  // Get all condition IDs (both existing filters and temp conditions)
  const existingConditions = Object.keys(filters).filter(key => filters[key].fieldId);
  const allConditions = [...existingConditions, ...tempConditions];

  const addCondition = () => {
    // Create a new temporary condition
    const newTempId = `temp-${Date.now()}`;
    setTempConditions(prev => [...prev, newTempId]);
  };

  const removeCondition = (conditionId: string) => {
    if (conditionId.startsWith('temp-')) {
      // Remove from temporary conditions
      setTempConditions(prev => prev.filter(id => id !== conditionId));
    } else {
      // Remove existing filter by setting it to inactive
      onFilterChange(conditionId, { active: false });
    }
  };

  const handleApply = () => {
    onApplyFilters();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900">
            Filter responses
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-6">
            {/* Intro text */}
            <p className="text-slate-600">
              Show me all responses where...
            </p>

            {/* Conditions */}
            <div className="space-y-4">
              {allConditions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p className="mb-4">No filters applied yet.</p>
                  <Button onClick={addCondition} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first condition
                  </Button>
                </div>
              ) : (
                allConditions.map((conditionId, index) => {
                  const isTemp = conditionId.startsWith('temp-');
                  const filter = isTemp ? undefined : filters[conditionId];
                  const field = filter ? fields.find(f => f.id === filter.fieldId) : undefined;
                  
                  return (
                    <FilterCondition
                      key={conditionId}
                      field={field}
                      filter={filter}
                      fields={fields}
                      onChange={(fieldId, filterUpdate) => {
                        if (isTemp && fieldId) {
                          // Convert temp condition to real filter
                          setTempConditions(prev => prev.filter(id => id !== conditionId));
                          onFilterChange(fieldId, filterUpdate);
                        } else if (!isTemp) {
                          onFilterChange(fieldId, filterUpdate);
                        }
                      }}
                      onRemove={() => removeCondition(conditionId)}
                      isFirst={index === 0}
                    />
                  );
                })
              )}
            </div>

            {/* Add condition button */}
            {allConditions.length > 0 && (
              <div className="flex justify-center">
                <Button onClick={addCondition} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add another condition
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                onClick={onClearAllFilters}
                className="text-slate-600 hover:text-slate-900"
              >
                Clear all filters
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply filters
              {activeFilters.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 text-xs rounded-full">
                  {activeFilters.length}
                </span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};