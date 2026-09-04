import React from 'react';
import { parseCalendarDate, formatCalendarDate } from '@dculus/utils';
import { X } from 'lucide-react';
import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import {
  FillableFormField,
  FieldType,
  SelectField,
  RadioField,
  CheckboxField,
} from '@dculus/types';
import { FilterState } from './FilterPanel';
import { useTranslation } from '../../hooks/useTranslation';
import { MetaFilterField, MetaFieldKind } from './metaFilterFields';
import { FilterFieldSelect, FilterableField, isMetaFilterField } from './FilterFieldSelect';
import { AsyncValueCombobox } from './AsyncValueCombobox';

interface FilterRowProps {
  fields: FillableFormField[];
  metaFields?: MetaFilterField[];
  /** Scopes AsyncValueCombobox's suggestion query — a meta field with
   * `supportsSuggestions` falls back to a plain text Input when this is omitted. */
  formId?: string;
  filter: FilterState;
  onChange: (filter: Partial<FilterState>) => void;
  onRemove: () => void;
  isFirst?: boolean;
  filterLogic: 'AND' | 'OR';
}

/** Matches useTranslation's translate signature — wider than a bare `(key) => string` so
 * callers (e.g. renderFilterInput's "{{count}} selected" label) can pass interpolation values. */
type TranslateFn = (key: string, options?: { values?: Record<string, string | number> }) => string;

const getFormFieldOperatorOptions = (
  fieldType: FieldType,
  t: TranslateFn
) => {
  const baseOptions = [
    { value: 'IS_EMPTY', label: t('operators.isEmpty') },
    { value: 'IS_NOT_EMPTY', label: t('operators.isNotEmpty') },
  ];

  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.EMAIL_FIELD:
    case FieldType.PHONE_NUMBER_FIELD:
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
        {
          value: 'GREATER_THAN_OR_EQUAL',
          label: t('operators.greaterThanOrEqual'),
        },
        { value: 'LESS_THAN', label: t('operators.lessThan') },
        { value: 'LESS_THAN_OR_EQUAL', label: t('operators.lessThanOrEqual') },
        { value: 'BETWEEN', label: t('operators.between') },
        ...baseOptions,
      ];

    case FieldType.DATE_FIELD:
      return [
        { value: 'DATE_EQUALS', label: t('operators.equals') },
        { value: 'DATE_BEFORE', label: t('operators.before') },
        { value: 'DATE_AFTER', label: t('operators.after') },
        { value: 'DATE_BETWEEN', label: t('operators.between') },
        { value: 'DATE_TODAY', label: t('operators.today') },
        { value: 'DATE_LAST_N_DAYS', label: t('operators.lastNDays') },
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
        { value: 'CONTAINS', label: t('operators.includesSingle') },
        { value: 'NOT_CONTAINS', label: t('operators.excludesSingle') },
        { value: 'CONTAINS_ALL', label: t('operators.containsAll') },
        { value: 'EQUALS', label: t('operators.equals') },
        ...baseOptions,
      ];

    case FieldType.FILE_UPLOAD_FIELD:
      return baseOptions;

    default:
      return baseOptions;
  }
};

/** Default operator set per meta-field kind — mirrors the FieldType-based sets above, since
 * the backend meta-field SQL builders (responseQueryBuilder.ts) support the exact same
 * operator vocabulary per kind (text/number/date), plus the two kinds with no form-field
 * equivalent: 'enum' (gradeStatus: EQUALS/NOT_EQUALS/IN/NOT_IN/IS_EMPTY/IS_NOT_EMPTY) and
 * 'boolean' (a fixed two-value choice: EQUALS only). A field's own `operators` override
 * (only __completenessPercent uses this, to drop IS_EMPTY/IS_NOT_EMPTY) wins when present. */
const getMetaOperatorOptions = (metaField: MetaFilterField, t: TranslateFn) => {
  if (metaField.operators) {
    return metaField.operators.map((value) => ({ value, label: t(`operators.${OPERATOR_LABEL_KEY[value] ?? value}`) }));
  }
  const kind: MetaFieldKind = metaField.kind;
  switch (kind) {
    case 'text':
      return getFormFieldOperatorOptions(FieldType.TEXT_INPUT_FIELD, t);
    case 'number':
      return getFormFieldOperatorOptions(FieldType.NUMBER_FIELD, t);
    case 'date':
      return getFormFieldOperatorOptions(FieldType.DATE_FIELD, t);
    case 'enum':
      return [
        { value: 'EQUALS', label: t('operators.equals') },
        { value: 'NOT_EQUALS', label: t('operators.notEquals') },
        { value: 'IN', label: t('operators.includes') },
        { value: 'NOT_IN', label: t('operators.notIncludes') },
        { value: 'IS_EMPTY', label: t('operators.isEmpty') },
        { value: 'IS_NOT_EMPTY', label: t('operators.isNotEmpty') },
      ];
    case 'boolean':
      return [{ value: 'EQUALS', label: t('operators.equals') }];
    default:
      return [];
  }
};

/** Maps an operator's raw value back to its i18n key, for `getMetaOperatorOptions`'
 * `operators` override array (a plain list of operator values, not {value,label} pairs). */
const OPERATOR_LABEL_KEY: Record<string, string> = {
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  GREATER_THAN: 'greaterThan',
  GREATER_THAN_OR_EQUAL: 'greaterThanOrEqual',
  LESS_THAN: 'lessThan',
  LESS_THAN_OR_EQUAL: 'lessThanOrEqual',
  BETWEEN: 'between',
};

/** Dispatches on whether `field` is a real form field or a response meta-filter — the
 * single entry point ConditionRulesEditor.tsx and DigestFiltersEditor.tsx also call. */
export const getOperatorOptions = (field: FilterableField, t: TranslateFn) => {
  if (isMetaFilterField(field)) return getMetaOperatorOptions(field, t);
  return getFormFieldOperatorOptions(field.type, t);
};

const renderFormFieldInput = (
  field: FillableFormField,
  filter: FilterState,
  onChange: (filter: Partial<FilterState>) => void,
  t: TranslateFn
) => {
  if (
    !filter.operator ||
    filter.operator === 'IS_EMPTY' ||
    filter.operator === 'IS_NOT_EMPTY'
  ) {
    return null;
  }

  const handleValueChange = (value: string) => {
    onChange({
      fieldId: filter.fieldId,
      operator: filter.operator,
      value,
      active: true,
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
    case FieldType.PHONE_NUMBER_FIELD:
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
            <span className="text-muted-foreground">{t('conjunctions.and')}</span>
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
      // DATE_TODAY doesn't need any input
      if (filter.operator === 'DATE_TODAY') {
        return null;
      }
      // DATE_LAST_N_DAYS needs a number input for days
      if (filter.operator === 'DATE_LAST_N_DAYS') {
        return (
          <Input
            type="number"
            placeholder={t('placeholders.enterDays')}
            value={filter.value || '7'}
            min={1}
            onChange={(e) => handleValueChange(e.target.value)}
            className="h-9 w-24"
          />
        );
      }
      if (filter.operator === 'DATE_BETWEEN') {
        return (
          <div className="flex items-center gap-2">
            <DatePicker
              date={
                filter.dateRange?.from
                  ? parseCalendarDate(filter.dateRange.from)
                  : undefined
              }
              onDateChange={(date) =>
                handleDateRangeChange(
                  'from',
                  date ? formatCalendarDate(date) : ''
                )
              }
              placeholder={t('placeholders.from')}
              className="h-9 w-36"
            />
            <span className="text-muted-foreground">{t('conjunctions.and')}</span>
            <DatePicker
              date={
                filter.dateRange?.to ? parseCalendarDate(filter.dateRange.to) : undefined
              }
              onDateChange={(date) =>
                handleDateRangeChange(
                  'to',
                  date ? formatCalendarDate(date) : ''
                )
              }
              placeholder={t('placeholders.to')}
              className="h-9 w-36"
            />
          </div>
        );
      }
      return (
        <DatePicker
          date={filter.value ? parseCalendarDate(filter.value) : undefined}
          onDateChange={(date) =>
            handleValueChange(date ? formatCalendarDate(date) : '')
          }
          placeholder={t('placeholders.selectDate')}
          className="h-9 min-w-[200px]"
        />
      );

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD: {
      const options =
        (field as SelectField | RadioField | CheckboxField).options || [];

      // CONTAINS and NOT_CONTAINS use single value selection (dropdown)
      if (
        filter.operator === 'CONTAINS' ||
        filter.operator === 'NOT_CONTAINS'
      ) {
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
              <SelectValue placeholder={t('placeholders.selectOption')} />
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
                  <span className="text-muted-foreground">
                    {filter.values?.length
                      ? t('placeholders.selectedCount', { values: { count: filter.values.length } })
                      : t('placeholders.selectOptions')}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {options.map((option, index) => {
                const isSelected = filter.values?.includes(option) ?? false;
                return (
                  <div
                    key={index}
                    className="flex items-center space-x-2 p-2 hover:bg-background"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      id={`${field.id}-${index}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const currentValues = filter.values || [];
                        const newValues =
                          checked && typeof checked === 'boolean'
                            ? [...currentValues, option]
                            : currentValues.filter((v) => v !== option);
                        onChange({
                          fieldId: filter.fieldId,
                          operator: filter.operator,
                          values: newValues,
                          active: newValues.length > 0,
                        });
                      }}
                    />
                    <Label
                      htmlFor={`${field.id}-${index}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1 min-w-0 truncate"
                      title={option}
                    >
                      {option}
                    </Label>
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

const renderMetaFilterInput = (
  field: MetaFilterField,
  filter: FilterState,
  onChange: (filter: Partial<FilterState>) => void,
  t: TranslateFn,
  formId?: string
) => {
  if (!filter.operator || filter.operator === 'IS_EMPTY' || filter.operator === 'IS_NOT_EMPTY') {
    return null;
  }

  const handleValueChange = (value: string) => {
    onChange({ fieldId: filter.fieldId, operator: filter.operator, value, active: true });
  };

  const handleNumberRangeChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    onChange({
      fieldId: filter.fieldId,
      operator: filter.operator,
      numberRange: { ...filter.numberRange, [type]: numValue },
      active: true,
    });
  };

  const handleDateRangeChange = (type: 'from' | 'to', value: string) => {
    onChange({
      fieldId: filter.fieldId,
      operator: filter.operator,
      dateRange: { ...filter.dateRange, [type]: value || undefined },
      active: true,
    });
  };

  const handleValuesChange = (values: string[]) => {
    onChange({ fieldId: filter.fieldId, operator: filter.operator, values, active: values.length > 0 });
  };

  switch (field.kind) {
    case 'text':
      if (field.supportsSuggestions && formId) {
        return (
          <AsyncValueCombobox
            formId={formId}
            fieldId={field.id}
            value={filter.value || ''}
            onChange={handleValueChange}
            placeholder={t('placeholders.enterValue')}
            noMatchesLabel={t('metaSuggestions.noMatches')}
            className="min-w-[200px]"
          />
        );
      }
      return (
        <Input
          placeholder={t('placeholders.enterValue')}
          value={filter.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          className="h-9 min-w-[200px]"
        />
      );

    case 'number':
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
            <span className="text-muted-foreground">{t('conjunctions.and')}</span>
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
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={t('placeholders.enterNumber')}
            value={filter.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            className="h-9 min-w-[140px]"
          />
          {(field.unitKey || field.unit) && (
            <span className="text-sm text-muted-foreground">{field.unitKey ? t(field.unitKey) : field.unit}</span>
          )}
        </div>
      );

    case 'date':
      if (filter.operator === 'DATE_TODAY') return null;
      if (filter.operator === 'DATE_LAST_N_DAYS') {
        return (
          <Input
            type="number"
            placeholder={t('placeholders.enterDays')}
            value={filter.value || '7'}
            min={1}
            onChange={(e) => handleValueChange(e.target.value)}
            className="h-9 w-24"
          />
        );
      }
      if (filter.operator === 'DATE_BETWEEN') {
        return (
          <div className="flex items-center gap-2">
            <DatePicker
              date={filter.dateRange?.from ? parseCalendarDate(filter.dateRange.from) : undefined}
              onDateChange={(date) => handleDateRangeChange('from', date ? formatCalendarDate(date) : '')}
              placeholder={t('placeholders.from')}
              className="h-9 w-36"
            />
            <span className="text-muted-foreground">{t('conjunctions.and')}</span>
            <DatePicker
              date={filter.dateRange?.to ? parseCalendarDate(filter.dateRange.to) : undefined}
              onDateChange={(date) => handleDateRangeChange('to', date ? formatCalendarDate(date) : '')}
              placeholder={t('placeholders.to')}
              className="h-9 w-36"
            />
          </div>
        );
      }
      return (
        <DatePicker
          date={filter.value ? parseCalendarDate(filter.value) : undefined}
          onDateChange={(date) => handleValueChange(date ? formatCalendarDate(date) : '')}
          placeholder={t('placeholders.selectDate')}
          className="h-9 min-w-[200px]"
        />
      );

    case 'boolean': {
      const options = field.booleanOptions ?? [];
      return (
        <Select value={filter.value || ''} onValueChange={handleValueChange}>
          <SelectTrigger className="h-9 min-w-[160px]">
            <SelectValue placeholder={t('metaSelectValuePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case 'enum': {
      const options = field.enumOptions ?? [];
      if (filter.operator === 'EQUALS' || filter.operator === 'NOT_EQUALS') {
        return (
          <Select value={filter.value || ''} onValueChange={handleValueChange}>
            <SelectTrigger className="h-9 min-w-[200px]">
              <SelectValue placeholder={t('metaSelectValuePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      // IN / NOT_IN: multi-select checkboxes, mirroring SELECT_FIELD's IN/NOT_IN rendering.
      return (
        <div className="relative min-w-[200px]">
          <Select value="placeholder" onValueChange={() => {}}>
            <SelectTrigger className="h-9">
              <SelectValue>
                <span className="text-muted-foreground">
                  {filter.values?.length
                    ? t('placeholders.selectedCount', { values: { count: filter.values.length } })
                    : t('placeholders.selectOptions')}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {options.map((option, index) => {
                const isSelected = filter.values?.includes(option.value) ?? false;
                return (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2 p-2 hover:bg-background"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      id={`${field.id}-${index}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const currentValues = filter.values || [];
                        const newValues =
                          checked && typeof checked === 'boolean'
                            ? [...currentValues, option.value]
                            : currentValues.filter((v) => v !== option.value);
                        handleValuesChange(newValues);
                      }}
                    />
                    <Label
                      htmlFor={`${field.id}-${index}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1 min-w-0 truncate"
                    >
                      {t(option.labelKey)}
                    </Label>
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

/** Dispatches on whether `field` is a real form field or a response meta-filter — the
 * single entry point ConditionRulesEditor.tsx and DigestFiltersEditor.tsx also call.
 * `formId` is only used by suggestible meta fields (AsyncValueCombobox) — harmless to
 * omit for a real form field or a non-suggestible meta field. */
export const renderFilterInput = (
  field: FilterableField,
  filter: FilterState,
  onChange: (filter: Partial<FilterState>) => void,
  t: TranslateFn,
  formId?: string
) => {
  if (isMetaFilterField(field)) return renderMetaFilterInput(field, filter, onChange, t, formId);
  return renderFormFieldInput(field, filter, onChange, t);
};

export const FilterRow: React.FC<FilterRowProps> = ({
  fields,
  metaFields = [],
  formId,
  filter,
  onChange,
  onRemove,
  isFirst = false,
  filterLogic,
}) => {
  const { t } = useTranslation('filterRow');
  const currentField = fields.find((f) => f.id === filter.fieldId);
  const currentMeta = !currentField ? metaFields.find((m) => m.id === filter.fieldId) : undefined;
  const activeField: FilterableField | undefined = currentField ?? currentMeta;
  const operatorOptions = activeField ? getOperatorOptions(activeField, t) : [];

  const handleFieldChange = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId) ?? metaFields.find((m) => m.id === fieldId);
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
    // Set default value for DATE_LAST_N_DAYS operator
    const defaultValue = operator === 'DATE_LAST_N_DAYS' ? '7' : undefined;

    onChange({
      fieldId: filter.fieldId, // Preserve the selected field
      operator,
      value: defaultValue,
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
      active:
        operator === 'IS_EMPTY' ||
        operator === 'IS_NOT_EMPTY' ||
        operator === 'DATE_TODAY' ||
        operator === 'DATE_LAST_N_DAYS',
    });
  };

  return (
    <div className="p-4 bg-white border border-[var(--tf-border-medium)] rounded-lg space-y-3">
      {/* Header Row: "and" connector + Remove Button */}
      <div className="flex items-center justify-between">
        {!isFirst ? (
          <div className="text-sm font-medium text-foreground">
            {filterLogic === 'AND' ? 'and' : 'or'}
          </div>
        ) : (
          <div></div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 hover:bg-[var(--tf-border-faint)] flex-shrink-0"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Row 1: Field Selection */}
      <div>
        <FilterFieldSelect
          fields={fields}
          metaFields={metaFields}
          value={filter.fieldId || ''}
          onChange={handleFieldChange}
          t={t}
          triggerClassName="h-10 w-full bg-[var(--tf-icon-teal)] border-[var(--tf-green-bg-md)] hover:bg-[rgba(23,119,103,0.06)]"
          testId="filter-field-select"
        />
      </div>

      {/* Row 2: Operator and Value */}
      {activeField && (
        <div className="flex items-center gap-3">
          {/* Operator Selection */}
          <div className="min-w-0 flex-shrink-0">
            <Select
              value={filter.operator || ''}
              onValueChange={handleOperatorChange}
            >
              <SelectTrigger
                className="h-10 min-w-[140px]"
                data-testid="filter-operator-select"
              >
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
            <div
              className="flex-1 min-w-0"
              data-testid="filter-value-container"
            >
              {renderFilterInput(activeField, filter, onChange, t, formId)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
