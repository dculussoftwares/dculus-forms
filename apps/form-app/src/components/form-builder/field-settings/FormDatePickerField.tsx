import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { DatePicker, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { FieldValidationError } from './types';
import { parseLocalDate, formatLocalDate } from '../../../utils/dateHelpers';

interface FormDatePickerFieldProps {
  name: string;
  label: string;
  placeholder?: string;
  control: Control<any>;
  error?: FieldValidationError;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

/**
 * Reusable form date picker field with timezone-safe string ↔ Date conversion.
 *
 * Stores value as "YYYY-MM-DD" in the form; converts to/from a local Date object
 * for the picker. Uses parseLocalDate / formatLocalDate instead of new Date(string)
 * / toISOString() to prevent the off-by-one timezone bug.
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
          // SAFE: parse "YYYY-MM-DD" as local midnight, not UTC midnight
          const dateValue = field.value ? parseLocalDate(field.value) : undefined;

          return (
            <DatePicker
              id={inputId}
              date={dateValue}
              onDateChange={(date) => {
                // SAFE: format using local date parts, not toISOString() which would shift to UTC
                field.onChange(date ? formatLocalDate(date) : '');
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
