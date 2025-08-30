import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';

interface NumberRangeSettingsProps {
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
}

export const NumberRangeSettings: React.FC<NumberRangeSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Number Range</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="field-min" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Minimum
          </Label>
          <Controller
            name="min"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="field-min"
                type="number"
                placeholder="Min"
                disabled={!isConnected}
                className={`text-sm ${errors.min ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={field.value || ''}
              />
            )}
          />
          <ErrorMessage error={errors.min?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="field-max" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Maximum
          </Label>
          <Controller
            name="max"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="field-max"
                type="number"
                placeholder="Max"
                disabled={!isConnected}
                className={`text-sm ${errors.max ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={field.value || ''}
              />
            )}
          />
          <ErrorMessage error={errors.max?.message} />
        </div>
      </div>
    </div>
  );
};