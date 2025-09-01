import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';

interface SelectionLimitSettingsProps {
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
}

export const SelectionLimitSettings: React.FC<SelectionLimitSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="field-min-selections" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Minimum Selections
        </Label>
        <Controller
          name="validation.minSelections"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="field-min-selections"
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
        <ErrorMessage error={errors.validation?.minSelections?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="field-max-selections" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Maximum Selections
        </Label>
        <Controller
          name="validation.maxSelections"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="field-max-selections"
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
        <ErrorMessage error={errors.validation?.maxSelections?.message} />
      </div>
    </div>
  );
};