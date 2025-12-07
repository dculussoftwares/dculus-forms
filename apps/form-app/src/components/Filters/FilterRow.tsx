import React from 'react';
import { X } from 'lucide-react';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Checkbox,
  DatePicker,
} from '@dculus/ui';
import { FillableFormField, FieldType, SelectField, RadioField, CheckboxField } from '@dculus/types';
import { FilterState } from './FilterPanel';
import { getFieldIcon } from '../utils/fieldIcons';
import { useTranslation } from '../../hooks/useTranslation';

interface FilterRowProps {
  fields: FillableFormField[];
  filter: FilterState;
  onChange: (filter: Partial<FilterState>) => void;
  onRemove: () => void;
  isFirst?: boolean;
  filterLogic: 'AND' | 'OR';
}

const getOperatorOptions = (fieldType: FieldType, t: (key: string) => string) => {
  const baseOptions = [
    { value: 'IS_EMPTY', label: t('operators.isEmpty') },
    { value: 'IS_NOT_EMPTY', label: t('operators.isNotEmpty') },
  ];

  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.EMAIL_FIELD:
      return [
        { value: 'CONTAINS', label: t('operators.contains') },
        { value: 'NOT_CONTAINS', label: t('operators.notContains') },
        { value: 'EQUALS', label: t('operators.equals') },
        { value: 'NOT_EQUALS', label: t('operators.notEquals') },
        { value: 'STARTS_WITH', label: t('operators.startsWith') },
        { value: 'ENDS_WITH', label: t('operators.endsWith') },
        ...baseOptions,
      ];

    case FieldType.NUMBER_FIELD:
      return [
        { value: 'EQUALS', label: t('operators.equals') },
        { value: 'NOT_EQUALS', label: t('operators.notEquals') },
        { value: 'GREATER_THAN', label: t('operators.greaterThan') },
        { value: 'LESS_THAN', label: t('operators.lessThan') },
        { value: 'BETWEEN', label: t('operators.between') },
        ...baseOptions,
      ];

    case FieldType.DATE_FIELD:
      return [
        { value: 'DATE_EQUALS', label: t('operators.equals') },
        { value: 'DATE_BEFORE', label: t('operators.before') },
        { value: 'DATE_AFTER', label: t('operators.after') },
        { value: 'DATE_BETWEEN', label: t('operators.between') },
        ...baseOptions,
      ];

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
      return [
        { value: 'IN', label: t('operators.includes') },
        { value: 'NOT_IN', label: t('operators.notIncludes') },
        ...baseOptions,
      ];

    case FieldType.CHECKBOX_FIELD:
      return [
        { value: 'IN', label: t('operators.includesAny') },
        { value: 'NOT_IN', label: t('operators.notIncludesAny') },
        { value: 'CONTAINS', label: t('operators.contains') },
        { value: 'NOT_CONTAINS', label: t('operators.notContains') },
        { value: 'CONTAINS_ALL', label: t('operators.containsAll') },
        { value: 'EQUALS', label: t('operators.equals') },
        ...baseOptions,
      ];

    default:
      return baseOptions;
  }
};

const truncateLabel = (label: string, maxLength = 50): string => {
  return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
};

const renderFilterInput = (
  field: FillableFormField,
  filter: FilterState,
  onChange: (filter: Partial<FilterState>) => void,
  t: (key: string) => string
) => {
  if (!filter.operator || filter.operator === 'IS_EMPTY' || filter.operator === 'IS_NOT_EMPTY') {
    return null;
  }

  const handleValueChange = (value: string) => {
    onChange({ 
      fieldId: filter.fieldId,
      operator: filter.operator,
      value, 
      active: true 
    });
  };

  const handleNumberRangeChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    onChange({
      fieldId: filter.fieldId,
      operator: filter.operator,
      numberRange: {
        ...filter.numberRange,
        [type]: numValue,
      },
      active: true,
    });
  };

  const handleDateRangeChange = (type: 'from' | 'to', value: string) => {
    onChange({
      fieldId: filter.fieldId,
      operator: filter.operator,
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
          placeholder={t('placeholders.enterValue')}
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="h-9 min-w-[200px]"
        />
      );

    case FieldType.NUMBER_FIELD:
      if (filter.operator === 'BETWEEN') {
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder={t('placeholders.min')}
              value={filter.numberRange?.min ?? ''}
              onChange={(e) => handleNumberRangeChange('min', e.target.value)}
              className="h-9 w-24"
            />
            <span className="text-slate-500">and</span>
            <Input
              type="number"
              placeholder={t('placeholders.max')}
              value={filter.numberRange?.max ?? ''}
              onChange={(e) => handleNumberRangeChange('max', e.target.value)}
              className="h-9 w-24"
            />
          </div>
        );
      }
      return (
        <Input
          type="number"
          placeholder={t('placeholders.enterNumber')}
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="h-9 min-w-[200px]"
        />
      );

    case FieldType.DATE_FIELD:
      if (filter.operator === 'DATE_BETWEEN') {
        return (
          <div className="flex items-center gap-2">
            <DatePicker
              date={filter.dateRange?.from ? new Date(filter.dateRange.from) : undefined}
              onDateChange={(date) => handleDateRangeChange('from', date ? date.toISOString().split('T')[0] : '')}
              placeholder="From"
              className="h-9 w-36"
            />
            <span className="text-slate-500">and</span>
            <DatePicker
              date={filter.dateRange?.to ? new Date(filter.dateRange.to) : undefined}
              onDateChange={(date) => handleDateRangeChange('to', date ? date.toISOString().split('T')[0] : '')}
              placeholder="To"
              className="h-9 w-36"
            />
          </div>
        );
      }
      return (
        <DatePicker
          date={filter.value ? new Date(filter.value) : undefined}
          onDateChange={(date) => handleValueChange(date ? date.toISOString().split('T')[0] : '')}
          placeholder="Select date"
          className="h-9 min-w-[200px]"
        />
      );

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD: {
      const options = (field as SelectField | RadioField | CheckboxField).options || [];
      
      // CONTAINS and NOT_CONTAINS use single value selection (dropdown)
      if (filter.operator === 'CONTAINS' || filter.operator === 'NOT_CONTAINS') {
        return (
          <Select 
            value={filter.value || ''} 
            onValueChange={(value) => {
              onChange({
                fieldId: filter.fieldId,
                operator: filter.operator,
                value,
                active: true,
              });
            }}
          >
            <SelectTrigger className="h-9 min-w-[200px]">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      
      // IN, NOT_IN, CONTAINS_ALL, EQUALS use multi-select (checkboxes)
      return (
        <div className="relative min-w-[200px]">
          <Select value="placeholder" onValueChange={() => {}}>
            <SelectTrigger className="h-9">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">
                    {filter.values?.length ? `${filter.values.length} selected` : 'Select options...'}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">{options.map((option, index) => {
                const isSelected = filter.values?.includes(option) ?? false;
                return (
                  <div key={index} className="flex items-center space-x-2 p-2 hover:bg-slate-50">
                    <Checkbox
                      id={`${field.id}-${index}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const currentValues = filter.values || [];
                        const newValues =
                          checked && typeof checked === 'boolean'
                            ? [...currentValues, option]
                            : currentValues.filter(v => v !== option);
                        onChange({
                          fieldId: filter.fieldId,
                          operator: filter.operator,
                          values: newValues,
                          active: newValues.length > 0,
                        });
                      }}
                    />
                    <label
                      htmlFor={`${field.id}-${index}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1 min-w-0 truncate"
                      title={option}
                    >
                      {option}
                    </label>
                  </div>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      );
    }

    default:
      return null;
  }
};

export const FilterRow: React.FC<FilterRowProps> = ({
  fields,
  filter,
  onChange,
  onRemove,
  isFirst = false,
  filterLogic,
}) => {
  const { t } = useTranslation('filterRow');
  const currentField = fields.find(f => f.id === filter.fieldId);
  const operatorOptions = currentField ? getOperatorOptions(currentField.type, t) : [];

  const handleFieldChange = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      onChange({
        fieldId,
        operator: undefined,
        value: undefined,
        values: undefined,
        dateRange: undefined,
        numberRange: undefined,
        active: false,
      });
    }
  };

  const handleOperatorChange = (operator: string) => {
    onChange({
      fieldId: filter.fieldId, // Preserve the selected field
      operator,
      value: undefined,
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
      active: operator === 'IS_EMPTY' || operator === 'IS_NOT_EMPTY',
    });
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
      {/* Header Row: "and" connector + Remove Button */}
      <div className="flex items-center justify-between">
        {!isFirst ? (
          <div className="text-sm font-medium text-slate-600">
            {filterLogic === 'AND' ? 'and' : 'or'}
          </div>
        ) : (
          <div></div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 hover:bg-slate-100 flex-shrink-0"
        >
          <X className="h-4 w-4 text-slate-500" />
        </Button>
      </div>

      {/* Row 1: Field Selection */}
      <div>
        <Select value={filter.fieldId || ''} onValueChange={handleFieldChange}>
          <SelectTrigger className="h-10 w-full bg-blue-50 border-blue-200 hover:bg-blue-100">
            <SelectValue placeholder={t('placeholders.selectField')}>
              {currentField && (
                <div className="flex items-center gap-2">
                  <div className="text-blue-700 flex-shrink-0">
                    {getFieldIcon(currentField.type)}
                  </div>
                  <span className="truncate" title={currentField.label}>
                    {truncateLabel(currentField.label)}
                  </span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.id}>
                <div className="flex items-center gap-2">
                  <div className="text-slate-500 flex-shrink-0">
                    {getFieldIcon(field.type)}
                  </div>
                  <span className="truncate" title={field.label}>
                    {truncateLabel(field.label)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Operator and Value */}
      {currentField && (
        <div className="flex items-center gap-3">
          {/* Operator Selection */}
          <div className="min-w-0 flex-shrink-0">
            <Select value={filter.operator || ''} onValueChange={handleOperatorChange}>
              <SelectTrigger className="h-10 min-w-[140px]">
                <SelectValue placeholder={t('placeholders.selectCondition')} />
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

          {/* Value Input */}
          {filter.operator && (
            <div className="flex-1 min-w-0">
              {renderFilterInput(currentField, filter, onChange, t)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
