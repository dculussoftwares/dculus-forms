import React, { useMemo } from 'react';
import { FormField, FieldType } from '@dculus/types';
import { Input, Textarea, Select, SelectTrigger, SelectContent, SelectValue, SelectItem, Label } from './index';

interface FieldPreviewProps {
  field: FormField;
  disabled?: boolean;
  showValidation?: boolean;
}

export const FieldPreview: React.FC<FieldPreviewProps> = ({
  field,
  disabled = true,
  showValidation = true
}) => {
  // Memoize field data extraction to make it reactive to field changes
  const fieldData = useMemo(() => {
    const getFieldLabel = (): string => {
      if ('label' in field && typeof field.label === 'string' && field.label) {
        return field.label;
      }
      return getDefaultLabel(field.type);
    };

    const getFieldHint = (): string => {
      if ('hint' in field && typeof field.hint === 'string' && field.hint) {
        return field.hint;
      }
      return '';
    };

    const getFieldPlaceholder = (): string => {
      if ('placeholder' in field && typeof field.placeholder === 'string' && field.placeholder) {
        return field.placeholder;
      }
      return '';
    };

    const getFieldPrefix = (): string => {
      if ('prefix' in field && typeof field.prefix === 'string' && field.prefix) {
        return field.prefix;
      }
      return '';
    };

    const getFieldDefaultValue = (): string => {
      if ('defaultValue' in field && typeof field.defaultValue === 'string' && field.defaultValue) {
        return field.defaultValue;
      }
      return '';
    };

    const getFieldDefaultValueArray = (): string[] => {
      // CheckboxField should have defaultValues array
      if ('defaultValues' in field && Array.isArray((field as any).defaultValues)) {
        return (field as any).defaultValues;
      }
      return [];
    };

    const getFieldOptions = (): string[] => {
      if ('options' in field && Array.isArray(field.options)) {
        return field.options;
      }
      return [];
    };

    const getFieldRequired = (): boolean => {
      if ('validation' in field && field.validation && typeof field.validation === 'object') {
        return (field.validation as any).required || false;
      }
      return false;
    };

    return {
      label: getFieldLabel(),
      hint: getFieldHint(),
      placeholder: getFieldPlaceholder(),
      prefix: getFieldPrefix(),
      defaultValue: getFieldDefaultValue(),
      defaultValueArray: getFieldDefaultValueArray(),
      options: getFieldOptions(),
      required: getFieldRequired()
    };
  }, [
    field,
    // Add specific dependencies to ensure re-computation when field data changes
    'label' in field ? field.label : null,
    'hint' in field ? field.hint : null,
    'placeholder' in field ? field.placeholder : null,
    'prefix' in field ? field.prefix : null,
    'defaultValue' in field ? field.defaultValue : null,
    'defaultValues' in field ? (field as any).defaultValues : null,
    'options' in field ? field.options : null,
    'validation' in field ? field.validation : null,
  ]);

  const getDefaultLabel = (type: FieldType): string => {
    switch (type) {
      case FieldType.TEXT_INPUT_FIELD:
        return 'Short Text';
      case FieldType.TEXT_AREA_FIELD:
        return 'Long Text';
      case FieldType.EMAIL_FIELD:
        return 'Email';
      case FieldType.NUMBER_FIELD:
        return 'Number';
      case FieldType.SELECT_FIELD:
        return 'Dropdown';
      case FieldType.RADIO_FIELD:
        return 'Radio';
      case FieldType.CHECKBOX_FIELD:
        return 'Checkbox';
      case FieldType.DATE_FIELD:
        return 'Date';
      default:
        return 'Field';
    }
  };

  const renderFieldInput = () => {
    const placeholder = fieldData.placeholder || `Enter your ${fieldData.label.toLowerCase()}`;
    const defaultValue = fieldData.defaultValue;
    const prefix = fieldData.prefix;
    const options = fieldData.options;

    switch (field.type) {
      case FieldType.TEXT_INPUT_FIELD:
        return (
          <div className="relative">
            {prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {prefix}
              </span>
            )}
            <Input
              type="text"
              placeholder={placeholder}
              defaultValue={defaultValue}
              disabled={disabled}
              className={`text-sm ${prefix ? 'pl-8' : ''}`}
            />
          </div>
        );

      case FieldType.TEXT_AREA_FIELD:
        return (
          <div className="relative">
            {prefix && (
              <span className="absolute left-3 top-3 text-gray-500 text-sm z-10">
                {prefix}
              </span>
            )}
            <Textarea
              placeholder={placeholder}
              defaultValue={defaultValue}
              disabled={disabled}
              className={`text-sm min-h-[80px] resize-none ${prefix ? 'pl-8' : ''}`}
            />
          </div>
        );

      case FieldType.EMAIL_FIELD:
        return (
          <div className="relative">
            {prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {prefix}
              </span>
            )}
            <Input
              type="email"
              placeholder={placeholder || "Enter your email"}
              defaultValue={defaultValue}
              disabled={disabled}
              className={`text-sm ${prefix ? 'pl-8' : ''}`}
            />
          </div>
        );

      case FieldType.NUMBER_FIELD:
        const numberField = field as any;
        return (
          <div className="relative">
            {prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {prefix}
              </span>
            )}
            <Input
              type="number"
              placeholder={placeholder || "Enter a number"}
              defaultValue={defaultValue}
              min={numberField.min}
              max={numberField.max}
              disabled={disabled}
              className={`text-sm ${prefix ? 'pl-8' : ''}`}
            />
          </div>
        );

      case FieldType.SELECT_FIELD:
        return (
          <Select disabled={disabled} defaultValue={fieldData.defaultValue || undefined}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={placeholder || "Choose an option"} />
            </SelectTrigger>
            <SelectContent>
              {options.length > 0 ? (
                options.filter(option => option && option.trim() !== '').map((option, index) => (
                  <SelectItem key={index} value={option}>
                    {option}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-options-placeholder" disabled>
                  No options added yet
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        );

      case FieldType.RADIO_FIELD:
        return (
          <div className="space-y-2">
            {options.length > 0 ? (
              options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${field.id}-${index}`}
                    name={field.id}
                    value={option}
                    defaultChecked={fieldData.defaultValue === option}
                    disabled={disabled}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <label
                    htmlFor={`${field.id}-${index}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {option}
                  </label>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 italic">No options added yet</div>
            )}
          </div>
        );

      case FieldType.CHECKBOX_FIELD:
        const defaultValues = fieldData.defaultValueArray;
        return (
          <div className="space-y-2">
            {options.length > 0 ? (
              options.map((option, index) => {
                const isChecked = defaultValues.includes(option);
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`${field.id}-${index}`}
                      name={field.id}
                      value={option}
                      checked={isChecked}
                      disabled={disabled}
                      onChange={() => {}} // Disabled preview - no actual interaction
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <label
                      htmlFor={`${field.id}-${index}`}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {option}
                    </label>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500 italic">No options added yet</div>
            )}
          </div>
        );

      case FieldType.DATE_FIELD:
        const dateField = field as any;
        return (
          <Input
            type="date"
            defaultValue={defaultValue}
            min={dateField.minDate}
            max={dateField.maxDate}
            disabled={disabled}
            className="text-sm"
          />
        );

      default:
        return (
          <div className="text-sm text-gray-500 italic">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-2">
      {/* Field Label */}
      <div className="flex items-center space-x-1">
        <Label className="text-sm font-medium text-gray-900 dark:text-white">
          {fieldData.label}
          {fieldData.required && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </Label>
      </div>

      {/* Field Input */}
      {renderFieldInput()}

      {/* Field Hint */}
      {fieldData.hint && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {fieldData.hint}
        </p>
      )}
    </div>
  );
};

export default FieldPreview;