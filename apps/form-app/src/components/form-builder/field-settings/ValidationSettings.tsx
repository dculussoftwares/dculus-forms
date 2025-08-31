import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';
import { FormField, FieldType } from '@dculus/types';

interface ValidationSettingsProps {
  control: Control<any>;
  isConnected: boolean;
  errors: Record<string, any>;
  field: FormField;
}

export const ValidationSettings: React.FC<ValidationSettingsProps> = ({
  control,
  isConnected,
  errors,
  field
}) => {
  // Check if the field supports character limits
  const supportsCharacterLimits = field.type === FieldType.TEXT_INPUT_FIELD || field.type === FieldType.TEXT_AREA_FIELD;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Validation</h4>
      
      <div className="flex items-center space-x-2">
        <Controller
          name="required"
          control={control}
          render={({ field }) => (
            <input
              type="checkbox"
              id="field-required"
              checked={field.value || false}
              onChange={field.onChange}
              disabled={!isConnected}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          )}
        />
        <Label htmlFor="field-required" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Required field
        </Label>
      </div>

      {/* Character Limits for text fields */}
      {supportsCharacterLimits && (
        <>
          <div className="space-y-2">
            <Label htmlFor="field-min-length" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Minimum Length
            </Label>
            <Controller
              name="validation.minLength"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="field-min-length"
                  type="number"
                  min="0"
                  placeholder="No minimum"
                  disabled={!isConnected}
                  className="text-sm"
                  value={field.value || ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                    field.onChange(value);
                  }}
                />
              )}
            />
            <ErrorMessage error={errors.validation?.minLength?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-max-length" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Maximum Length
            </Label>
            <Controller
              name="validation.maxLength"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="field-max-length"
                  type="number"
                  min="1"
                  placeholder="No maximum"
                  disabled={!isConnected}
                  className="text-sm"
                  value={field.value || ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                    field.onChange(value);
                  }}
                />
              )}
            />
            <ErrorMessage error={errors.validation?.maxLength?.message} />
          </div>
        </>
      )}
    </div>
  );
};