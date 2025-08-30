import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Label } from '@dculus/ui';

interface MultipleSelectionSettingsProps {
  control: Control<any>;
  isConnected: boolean;
}

export const MultipleSelectionSettings: React.FC<MultipleSelectionSettingsProps> = ({
  control,
  isConnected
}) => {
  return (
    <div className="flex items-center space-x-2">
      <Controller
        name="multiple"
        control={control}
        render={({ field }) => (
          <input
            type="checkbox"
            id="field-multiple"
            checked={field.value || false}
            onChange={field.onChange}
            disabled={!isConnected}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
        )}
      />
      <Label htmlFor="field-multiple" className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Allow multiple selections
      </Label>
    </div>
  );
};