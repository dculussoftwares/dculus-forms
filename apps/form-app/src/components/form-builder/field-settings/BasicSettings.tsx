import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label, Textarea } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';
import { DefaultValueInput } from './DefaultValueInput';
import { FormField } from '@dculus/types';

interface BasicSettingsProps {
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
  field: FormField | null;
  watch: (name: string) => any;
}

export const BasicSettings: React.FC<BasicSettingsProps> = ({
  control,
  errors,
  isConnected,
  field,
  watch
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Basic Settings</h4>
      
      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="field-label" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Label
        </Label>
        <Controller
          name="label"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="field-label"
              placeholder="Field label"
              disabled={!isConnected}
              className="text-sm"
              value={field.value || ''}
            />
          )}
        />
        <ErrorMessage error={errors.label?.message} />
      </div>

      {/* Hint */}
      <div className="space-y-2">
        <Label htmlFor="field-hint" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Help Text
        </Label>
        <Controller
          name="hint"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              id="field-hint"
              placeholder="Help text for this field"
              disabled={!isConnected}
              className="text-sm resize-none"
              rows={2}
              value={field.value || ''}
            />
          )}
        />
        <ErrorMessage error={errors.hint?.message} />
      </div>

      {/* Default Value */}
      <div className="space-y-2">
        <Label htmlFor="field-default" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Default Value
        </Label>
        <DefaultValueInput
          field={field}
          control={control}
          errors={errors}
          isConnected={isConnected}
          watch={watch}
        />
        <ErrorMessage error={errors.defaultValue?.message} />
      </div>
    </div>
  );
};