import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@dculus/ui';
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
        
        if (field?.type === FieldType.SELECT_FIELD) {
          const options = watch('options') || [];
          
          return (
            <Select
              value={controlField.value || '__none__'}
              onValueChange={(value) => controlField.onChange(value === '__none__' ? '' : value)}
              disabled={!isConnected}
            >
              <SelectTrigger className={`text-sm ${errors.defaultValue ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}>
                <SelectValue placeholder="Select default option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  None
                </SelectItem>
                {options.map((option: string, index: number) => (
                  <SelectItem key={index} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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