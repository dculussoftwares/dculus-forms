import React from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { RichTextEditor } from '@dculus/ui';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { BaseFieldSettingsProps } from './types';

interface RichTextSettingsProps extends BaseFieldSettingsProps {
  /** Field ID used to remount the editor when switching between fields */
  fieldId?: string;
}

/**
 * Settings component for Rich Text fields
 * Allows editing of rich text content using Lexical editor
 *
 * Since RichTextFormField is non-fillable, it doesn't have the typical
 * label, placeholder, or validation properties - only content
 */
export const RichTextSettings: React.FC<RichTextSettingsProps> = ({
  control,
  errors,
  isConnected,
  isReadOnly = false,
  fieldId,
}) => {
  const constants = useFieldSettingsConstants();
  const isEditable = isConnected && !isReadOnly;

  // Watch the content value to track form initialization
  const contentValue = useWatch({
    control,
    name: 'content',
    defaultValue: '',
  });

  return (
    <div className={constants.CSS_CLASSES.SECTION_SPACING}>
      <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>Rich Text Content</h4>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Content
        </label>
        <Controller
          name="content"
          control={control}
          render={({ field }) => {
            const editorValue = contentValue ?? field.value ?? '';

            return (
              <div className="border border-gray-200 rounded-lg">
                <RichTextEditor
                  key={fieldId}
                  value={editorValue}
                  onChange={field.onChange}
                  placeholder={constants.PLACEHOLDERS.RICH_TEXT_CONTENT}
                  editable={isEditable}
                  className="min-h-32"
                />
              </div>
            );
          }}
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
