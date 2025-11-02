import React, { useEffect, useRef } from 'react';
import { RichTextFormField } from '@dculus/types';
import { Settings } from 'lucide-react';
import { useRichTextFieldForm } from '../../../hooks/field-forms';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FieldSettingsFooter,
  RichTextSettings,
  useFieldSettingsConstants
} from '../field-settings';

interface RichTextFieldSettingsProps {
  field: RichTextFormField | null;
  isConnected: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
  onFieldSwitch?: () => void;
}

/**
 * Specialized settings component for rich text fields
 * Handles RICH_TEXT_FIELD type with content management and loading states
 */
export const RichTextFieldSettings: React.FC<RichTextFieldSettingsProps> = ({
  field,
  isConnected,
  onUpdate,
  onFieldSwitch: _onFieldSwitch,
}) => {
  const { t } = useTranslation('richTextFieldSettings');
  const constants = useFieldSettingsConstants();
  const {
    form,
    isSaving,
    isValid,
    errors,
    handleSave,
    handleCancel,
    handleReset,
    isContentLoading,
  } = useRichTextFieldForm({
    field,
    onSave: (updates) => onUpdate?.(updates),
    onCancel: () => console.log('Rich text field edit cancelled'),
  });

  const { control, formState: { isDirty } } = form;

  // Track field changes (auto-save disabled)
  const fieldIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Track field changes without auto-save
    fieldIdRef.current = field?.id || null;
  }, [field?.id]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleCancel]);

  if (!field) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{constants.INFO_MESSAGES.SELECT_FIELD_TO_EDIT}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <FieldSettingsHeader field={field} isDirty={isDirty} />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSave} className={`p-4 space-y-6 transition-all duration-200 ${
          isDirty ? 'bg-gradient-to-b from-orange-25 to-transparent dark:from-orange-950/10' : ''
        }`}>
          {/* Validation Error Summary */}
          {!isValid && Object.keys(errors).length > 0 && (
            <ValidationSummary errors={errors} />
          )}

          {/* Loading Indicator */}
          {isContentLoading && (
            <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span className="text-sm">{t('loadingContent')}</span>
              </div>
            </div>
          )}

          {/* Rich Text Content Settings */}
          {!isContentLoading && (
            <div className={constants.CSS_CLASSES.SECTION_SPACING}>
              <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
                {t('sections.content')}
              </h4>
              
              <RichTextSettings
                control={control}
                errors={errors}
                isConnected={isConnected}
              />
            </div>
          )}

          {/* Field Information */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {t('sections.fieldInformation')}
            </h4>
            
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
              <p>
                <span className="font-medium">{t('fieldInfo.fieldId')}</span> {field.id}
              </p>
              <p>
                <span className="font-medium">{t('fieldInfo.fieldType')}</span> {t('fieldInfo.richText')}
              </p>
              <p>
                <span className="font-medium">{t('fieldInfo.contentLength')}</span> {t('fieldInfo.characters', { values: { count: field.content?.length || 0 } })}
              </p>
            </div>
          </div>

          {/* Content Guidelines */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {t('sections.contentGuidelines')}
            </h4>
            
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
              <ul className="list-disc list-inside space-y-1">
                <li>{t('guidelines.supportFormatting')}</li>
                <li>{t('guidelines.autoSanitized')}</li>
                <li>{t('guidelines.useRichText')}</li>
                <li>{t('guidelines.autoSave')}</li>
              </ul>
            </div>
          </div>

          {/* Add some bottom padding to prevent content from being hidden behind the floating actions */}
          <div className="pb-4"></div>
        </form>
      </div>

      <FieldSettingsFooter
        isDirty={isDirty}
        isValid={isValid}
        isConnected={isConnected}
        isSaving={isSaving}
        errors={errors}
        onReset={handleReset}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </div>
  );
};

export default RichTextFieldSettings;