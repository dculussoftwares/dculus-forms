import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';

interface CharacterLimitSettingsProps {
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
}

export const CharacterLimitSettings: React.FC<CharacterLimitSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <div className="space-y-4">
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
              data-testid="field-min-length-input"
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
              data-testid="field-max-length-input"
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
    </div>
  );
};