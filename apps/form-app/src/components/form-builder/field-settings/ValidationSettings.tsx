import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Label } from '@dculus/ui';

interface ValidationSettingsProps {
  control: Control<any>;
  isConnected: boolean;
}

export const ValidationSettings: React.FC<ValidationSettingsProps> = ({
  control,
  isConnected
}) => {
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
              data-testid="field-required-toggle"
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
    </div>
  );
};