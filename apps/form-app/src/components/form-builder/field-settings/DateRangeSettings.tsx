import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';

interface DateRangeSettingsProps {
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
}

export const DateRangeSettings: React.FC<DateRangeSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Date Range</h4>
      
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="field-min-date" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Minimum Date
          </Label>
          <Controller
            name="minDate"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="field-min-date"
                type="date"
                disabled={!isConnected}
                className={`text-sm ${errors.minDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={field.value || ''}
              />
            )}
          />
          <ErrorMessage error={errors.minDate?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="field-max-date" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Maximum Date
          </Label>
          <Controller
            name="maxDate"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="field-max-date"
                type="date"
                disabled={!isConnected}
                className={`text-sm ${errors.maxDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={field.value || ''}
              />
            )}
          />
          <ErrorMessage error={errors.maxDate?.message} />
        </div>
      </div>
    </div>
  );
};