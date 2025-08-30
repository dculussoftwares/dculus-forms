import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';

interface PrefixSettingsProps {
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
}

export const PrefixSettings: React.FC<PrefixSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="field-prefix" className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Prefix
      </Label>
      <Controller
        name="prefix"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            id="field-prefix"
            placeholder="e.g., $, @"
            disabled={!isConnected}
            className="text-sm"
            value={field.value || ''}
          />
        )}
      />
      <ErrorMessage error={errors.prefix?.message} />
    </div>
  );
};