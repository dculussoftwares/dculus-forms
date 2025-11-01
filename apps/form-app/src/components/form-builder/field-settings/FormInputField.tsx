import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label, Textarea } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { FieldValidationError } from './types';

interface FormInputFieldProps {
  /** Field name for form control */
  name: string;
  /** Display label for the field */
  label: string;
  /** Input placeholder text */
  placeholder?: string;
  /** HTML input type */
  type?: 'text' | 'number' | 'email' | 'date';
  /** Whether to render as textarea */
  multiline?: boolean;
  /** Number of textarea rows (only if multiline=true) */
  rows?: number;
  /** Minimum value for number inputs */
  min?: string | number;
  /** Maximum value for number inputs */
  max?: string | number;
  /** React Hook Form control */
  control: Control<any>;
  /** Form validation errors */
  error?: FieldValidationError;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom transform function for input values */
  transform?: {
    input?: (value: any) => any;
    output?: (value: any) => any;
  };
}

/**
 * Reusable form input field component with consistent styling and error handling
 * Reduces duplication across field settings components
 */
export const FormInputField: React.FC<FormInputFieldProps> = ({
  name,
  label,
  placeholder,
  type = 'text',
  multiline = false,
  rows = 2,
  min,
  max,
  control,
  error,
  disabled = false,
  className = '',
  transform,
}) => {
  const constants = useFieldSettingsConstants();
  const hasError = Boolean(error);
  const inputClassName = `${constants.CSS_CLASSES.TEXT_SMALL} ${
    hasError ? constants.CSS_CLASSES.ERROR_INPUT : ''
  } ${className}`;

  const inputId = `field-${name}`;

  return (
    <div className={constants.CSS_CLASSES.INPUT_SPACING}>
      <Label 
        htmlFor={inputId} 
        className={constants.CSS_CLASSES.LABEL_STYLE}
      >
        {label}
      </Label>
      
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const fieldValue = transform?.input ? transform.input(field.value) : (field.value || '');
          const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const value = e.target.value;
            const transformedValue = transform?.output ? transform.output(value) : value;
            field.onChange(transformedValue);
          };

          if (multiline) {
            return (
              <Textarea
                {...field}
                id={inputId}
                placeholder={placeholder}
                disabled={disabled}
                className={`${inputClassName} resize-none`}
                rows={rows}
                value={fieldValue}
                onChange={handleChange}
              />
            );
          }

          return (
            <Input
              {...field}
              id={inputId}
              type={type}
              placeholder={placeholder}
              min={min}
              max={max}
              disabled={disabled}
              className={inputClassName}
              value={fieldValue}
              onChange={handleChange}
            />
          );
        }}
      />
      
      <ErrorMessage error={error} />
    </div>
  );
};