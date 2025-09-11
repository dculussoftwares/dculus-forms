import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
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
import { FilterState } from './FilterPanel';
import { getFieldIcon } from '../utils/fieldIcons';

interface FieldFilterProps {
  field: FillableFormField;
  filter?: FilterState;
  onChange: (filter: Partial<FilterState>) => void;
}

const getOperatorOptions = (fieldType: FieldType) => {
  const baseOptions = [
    { value: 'IS_EMPTY', label: 'Is empty' },
    { value: 'IS_NOT_EMPTY', label: 'Is not empty' },
  ];

  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.EMAIL_FIELD:
      return [
        { value: 'CONTAINS', label: 'Contains' },
        { value: 'NOT_CONTAINS', label: 'Does not contain' },
        { value: 'EQUALS', label: 'Equals' },
        { value: 'NOT_EQUALS', label: 'Does not equal' },
        { value: 'STARTS_WITH', label: 'Starts with' },
        { value: 'ENDS_WITH', label: 'Ends with' },
        ...baseOptions,
      ];

    case FieldType.NUMBER_FIELD:
      return [
        { value: 'EQUALS', label: 'Equals' },
        { value: 'NOT_EQUALS', label: 'Does not equal' },
        { value: 'GREATER_THAN', label: 'Greater than' },
        { value: 'LESS_THAN', label: 'Less than' },
        { value: 'BETWEEN', label: 'Between' },
        ...baseOptions,
      ];

    case FieldType.DATE_FIELD:
      return [
        { value: 'DATE_EQUALS', label: 'Equals' },
        { value: 'DATE_BEFORE', label: 'Before' },
        { value: 'DATE_AFTER', label: 'After' },
        { value: 'DATE_BETWEEN', label: 'Between' },
        ...baseOptions,
      ];

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      return [
        { value: 'IN', label: 'Is any of' },
        { value: 'NOT_IN', label: 'Is not any of' },
        ...baseOptions,
      ];

    default:
      return baseOptions;
  }
};

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
          placeholder="Enter value"
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="h-8 text-sm"
        />
      );

    case FieldType.NUMBER_FIELD:
      if (filter.operator === 'BETWEEN') {
        return (
          <div className="space-y-2">
            <Input
              type="number"
              placeholder="Min value"
              value={filter.numberRange?.min ?? ''}
              onChange={(e) => handleNumberRangeChange('min', e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Max value"
              value={filter.numberRange?.max ?? ''}
              onChange={(e) => handleNumberRangeChange('max', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        );
      }
      return (
        <Input
          type="number"
          placeholder="Enter number"
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="h-8 text-sm"
        />
      );

    case FieldType.DATE_FIELD:
      if (filter.operator === 'DATE_BETWEEN') {
        return (
          <div className="space-y-2">
            <Input
              type="date"
              placeholder="From date"
              value={filter.dateRange?.from || ''}
              onChange={(e) => handleDateRangeChange('from', e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="date"
              placeholder="To date"
              value={filter.dateRange?.to || ''}
              onChange={(e) => handleDateRangeChange('to', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        );
      }
      return (
        <Input
          type="date"
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="h-8 text-sm"
        />
      );

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      const options = (field as SelectField | RadioField | CheckboxField).options || [];
      return (
        <div className="border border-slate-200 rounded-md max-h-40 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-sm">
              No options available
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {options.map((option, index) => {
                const isSelected = filter.values?.includes(option) ?? false;
                return (
                  <div key={index} className="flex items-center space-x-2 p-1 rounded hover:bg-slate-50">
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
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 min-w-0 truncate"
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

export const FieldFilter: React.FC<FieldFilterProps> = ({
  field,
  filter,
  onChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const operatorOptions = getOperatorOptions(field.type);

  const handleOperatorChange = (operator: string) => {
    onChange({ 
      operator, 
      value: undefined, 
      values: undefined, 
      dateRange: undefined, 
      numberRange: undefined,
      active: operator === 'IS_EMPTY' || operator === 'IS_NOT_EMPTY' 
    });
  };

  return (
    <div>
      <Button
        variant="ghost"
        className="w-full h-auto p-3 justify-between hover:bg-slate-50 rounded-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="text-slate-500">
            {getFieldIcon(field.type)}
          </div>
          <div className="text-left">
            <div className="font-medium text-slate-900 text-sm">{field.label}</div>
            {filter?.active && (
              <div className="text-xs text-blue-600 font-medium">Filtered</div>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </Button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 bg-slate-50 border-t border-slate-100">
          <div className="pt-3">
            <label className="text-xs font-medium text-slate-600 mb-2 block">
              Condition
            </label>
            <Select value={filter?.operator || ''} onValueChange={handleOperatorChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select condition" />
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

          {filter?.operator && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">
                Value
              </label>
              {renderFilterInput(field, filter, onChange)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};