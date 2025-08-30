import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input } from '@dculus/ui';
import { FormField, FieldType } from '@dculus/types';

interface DefaultValueInputProps {
  field: FormField | null;
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
  watch: (name: string) => any;
}

export const DefaultValueInput: React.FC<DefaultValueInputProps> = ({
  field,
  control,
  errors,
  isConnected,
  watch
}) => {
  return (
    <Controller
      name="defaultValue"
      control={control}
      render={({ field: controlField }) => {
        if (field?.type === FieldType.DATE_FIELD) {
          const minDateValue = watch('minDate');
          const maxDateValue = watch('maxDate');
          
          return (
            <Input
              {...controlField}
              id="field-default"
              type="date"
              min={minDateValue || undefined}
              max={maxDateValue || undefined}
              disabled={!isConnected}
              className={`text-sm ${errors.defaultValue ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              value={controlField.value || ''}
            />
          );
        }
        
        return (
          <Input
            {...controlField}
            id="field-default"
            placeholder="Default value"
            disabled={!isConnected}
            className={`text-sm ${errors.defaultValue ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            value={controlField.value || ''}
          />
        );
      }}
    />
  );
};