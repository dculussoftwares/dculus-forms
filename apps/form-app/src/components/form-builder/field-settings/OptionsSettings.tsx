import React from 'react';
import { Button, Input } from '@dculus/ui';
import { Plus, X } from 'lucide-react';
import { ErrorMessage } from './ErrorMessage';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { OptionsSettingsProps } from './types';

/**
 * Settings component for option-based fields (Select, Radio, Checkbox)
 * Handles adding, editing, and removing options
 */
export const OptionsSettings: React.FC<OptionsSettingsProps> = ({
  options,
  isConnected,
  errors,
  addOption,
  updateOption,
  removeOption
}) => {
  const constants = useFieldSettingsConstants();
  
  return (
    <div className={constants.CSS_CLASSES.SECTION_SPACING}>
      <div className="flex items-center justify-between">
        <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
          {constants.SECTION_TITLES.OPTIONS}
        </h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={addOption}
          disabled={!isConnected}
          className="h-8 px-2"
          type="button"
        >
          <Plus className="w-4 h-4 mr-1" />
          {constants.BUTTONS.ADD}
        </Button>
      </div>
      
      <div className={constants.CSS_CLASSES.INPUT_SPACING}>
        {options.map((option: string, index: number) => {
          const isEmpty = !option || option.trim() === '';
          const hasError = errors.options && Array.isArray(errors.options) && errors.options[index];
          
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center space-x-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={constants.PLACEHOLDERS.OPTION_PLACEHOLDER(index)}
                  disabled={!isConnected}
                  className={`${constants.CSS_CLASSES.TEXT_SMALL} flex-1 ${
                    isEmpty ? constants.CSS_CLASSES.EMPTY_OPTION : ''
                  }`}
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
                  {constants.ERROR_MESSAGES.OPTION_EMPTY}
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