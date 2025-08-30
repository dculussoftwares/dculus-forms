import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';

interface TextInputSettingsProps {
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
}

export const TextInputSettings: React.FC<TextInputSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="field-placeholder" className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Placeholder
      </Label>
      <Controller
        name="placeholder"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            id="field-placeholder"
            placeholder="Placeholder text"
            disabled={!isConnected}
            className="text-sm"
            value={field.value || ''}
          />
        )}
      />
      <ErrorMessage error={errors.placeholder?.message} />
    </div>
  );
};