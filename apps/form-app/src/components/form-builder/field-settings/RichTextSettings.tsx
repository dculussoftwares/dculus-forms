import React, { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
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
  const [isFormReady, setIsFormReady] = useState(false);
  
  // Watch the content value to track form initialization
  const contentValue = useWatch({
    control,
    name: 'content',
    defaultValue: ''
  });
  
  // Track when the form has been properly initialized
  useEffect(() => {
    // Wait for the form to be initialized with actual content
    // The form is ready when we either have content or explicitly have an empty state
    const timer = setTimeout(() => {
      setIsFormReady(true);
    }, 50); // Small delay to ensure form reset has completed
    
    return () => clearTimeout(timer);
  }, [control]);

  if (!isFormReady) {
    return (
      <div className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_SPACING}>
        <h4 className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_TITLE}>
          Rich Text Content
        </h4>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Content
          </label>
          <div className="border border-gray-200 rounded-lg min-h-32 flex items-center justify-center text-gray-500">
            Loading editor...
          </div>
        </div>
      </div>
    );
  }

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
          render={({ field }) => {
            // Use the watched value instead of field.value for better synchronization
            const editorValue = contentValue ?? field.value ?? '';
            
            return (
              <div className="border border-gray-200 rounded-lg">
                <RichTextEditor
                  value={editorValue}
                  onChange={field.onChange}
                  placeholder="Enter rich text content..."
                  editable={isConnected}
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