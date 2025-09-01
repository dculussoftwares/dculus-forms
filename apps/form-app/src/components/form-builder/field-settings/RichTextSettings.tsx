import React from 'react';
import { Controller } from 'react-hook-form';
import { RichTextEditor } from '@dculus/ui';
import { FIELD_SETTINGS_CONSTANTS } from './constants';
import { BaseFieldSettingsProps } from './types';

/**
 * Settings component for Rich Text fields
 * Allows editing of rich text content using Lexical editor
 * 
 * Since RichTextFormField is non-fillable, it doesn't have the typical
 * label, placeholder, or validation properties - only content
 */
export const RichTextSettings: React.FC<BaseFieldSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <div className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_SPACING}>
      <h4 className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_TITLE}>
        Rich Text Content
      </h4>
      
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Content
        </label>
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <div className="border border-gray-200 rounded-lg">
              <RichTextEditor
                value={field.value || ''}
                onChange={field.onChange}
                placeholder="Enter rich text content..."
                editable={isConnected}
                className="min-h-32"
              />
            </div>
          )}
        />
        {errors.content && (
          <p className="text-xs text-red-600" role="alert">
            {(errors.content as any)?.message || 'Invalid content'}
          </p>
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        This content will be displayed as read-only text in the form.
      </div>
    </div>
  );
};