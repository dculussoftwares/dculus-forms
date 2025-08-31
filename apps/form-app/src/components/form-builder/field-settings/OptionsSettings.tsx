import React from 'react';
import { Button, Input } from '@dculus/ui';
import { Plus, X } from 'lucide-react';
import { ErrorMessage } from './ErrorMessage';

interface OptionsSettingsProps {
  options: string[];
  isConnected: boolean;
  errors: Record<string, any>;
  addOption: () => void;
  updateOption: (index: number, value: string) => void;
  removeOption: (index: number) => void;
}

export const OptionsSettings: React.FC<OptionsSettingsProps> = ({
  options,
  isConnected,
  errors,
  addOption,
  updateOption,
  removeOption
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Options</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={addOption}
          disabled={!isConnected}
          className="h-8 px-2"
          type="button"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>
      
      <div className="space-y-2">
        {options.map((option: string, index: number) => {
          const isEmpty = !option || option.trim() === '';
          const hasError = errors.options && Array.isArray(errors.options) && errors.options[index];
          
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center space-x-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  disabled={!isConnected}
                  className={`text-sm flex-1 ${isEmpty ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeOption(index)}
                  disabled={!isConnected}
                  className="h-8 w-8 text-gray-500 hover:text-red-600"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {isEmpty && (
                <div className="text-xs text-red-600 dark:text-red-400 ml-1">
                  Option text cannot be empty
                </div>
              )}
              {hasError && (
                <ErrorMessage error={hasError} />
              )}
            </div>
          );
        })}
      </div>
      <ErrorMessage error={errors.options?.message} />
    </div>
  );
};