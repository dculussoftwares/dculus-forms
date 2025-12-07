import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { DatePicker, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { FieldValidationError } from './types';

interface FormDatePickerFieldProps {
  /** Field name for form control */
  name: string;
  /** Display label for the field */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** React Hook Form control */
  control: Control<any>;
  /** Form validation errors */
  error?: FieldValidationError;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Minimum allowed date */
  minDate?: Date;
  /** Maximum allowed date */
  maxDate?: Date;
}

/**
 * Reusable form date picker field component with consistent styling and error handling
 * Uses shadcn DatePicker component with Popover + Calendar
 */
export const FormDatePickerField: React.FC<FormDatePickerFieldProps> = ({
  name,
  label,
  placeholder,
  control,
  error,
  disabled = false,
  className = '',
  minDate,
  maxDate,
}) => {
  const constants = useFieldSettingsConstants();
  const hasError = Boolean(error);
  const inputId = `field-${name}`;

  return (
    <div className={constants.CSS_CLASSES.INPUT_SPACING}>
      <Label htmlFor={inputId} className={constants.CSS_CLASSES.LABEL_STYLE}>
        {label}
      </Label>
      
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          // Convert string date (YYYY-MM-DD) to Date object for the picker
          const dateValue = field.value ? new Date(field.value) : undefined;
          
          return (
            <DatePicker
              id={inputId}
              date={dateValue}
              onDateChange={(date) => {
                // Store as ISO date string (YYYY-MM-DD) for form data
                field.onChange(date ? date.toISOString().split('T')[0] : '');
              }}
              placeholder={placeholder}
              disabled={disabled}
              error={hasError}
              minDate={minDate}
              maxDate={maxDate}
              className={className}
            />
          );
        }}
      />
      
      <ErrorMessage error={error} />
    </div>
  );
};
