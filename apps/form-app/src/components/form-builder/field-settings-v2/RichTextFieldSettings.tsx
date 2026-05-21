import React, { useEffect } from 'react';
import DOMPurify from 'dompurify';
import { RichTextFormField } from '@dculus/types';
import { Settings } from 'lucide-react';
import { useFieldEditor } from '../../../hooks';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FieldSettingsFooter,
  RichTextSettings,
  useFieldSettingsConstants,
} from '../field-settings';

interface RichTextFieldSettingsProps {
  field: RichTextFormField | null;
  isConnected: boolean;
  isReadOnly?: boolean;
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
  isReadOnly = false,
  onUpdate,
  onFieldSwitch: _onFieldSwitch,
}) => {
  const constants = useFieldSettingsConstants();

  const {
    form,
    isSaving,
    isValid,
    errors: formErrors,
    handleSave,
    handleCancel,
    handleReset,
  } = useFieldEditor({
    field,
    onSave: async (updates) => {
      // Sanitize content before saving
      if (updates.content) {
        updates.content = DOMPurify.sanitize(updates.content);
      }
      if (onUpdate) {
        await onUpdate(updates);
      }
    },
    onCancel: () => console.log('Rich text field edit cancelled'),
  });

  const {
    control,
    formState: { isDirty },
  } = form;

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
      <div className="h-full flex items-center justify-center text-muted-foreground dark:text-gray-400">
        <div className="text-center">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {constants.INFO_MESSAGES.SELECT_FIELD_TO_EDIT}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <FieldSettingsHeader field={field} isDirty={isDirty} />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <form
          onSubmit={handleSave}
          className={`p-4 space-y-6 transition-all duration-200 ${
            isDirty
              ? 'bg-gradient-to-b from-orange-25 to-transparent dark:from-orange-950/10'
              : ''
          }`}
        >
          {/* Validation Error Summary */}
          {!isValid && Object.keys(formErrors).length > 0 && (
            <ValidationSummary errors={formErrors} />
          )}

          {/* Rich Text Content Settings */}
          <RichTextSettings
            control={control}
            errors={formErrors}
            isConnected={isConnected}
            isReadOnly={isReadOnly}
            fieldId={field.id}
          />

          {/* Add some bottom padding to prevent content from being hidden behind the floating actions */}
          <div className="pb-4"></div>
        </form>
      </div>

      <FieldSettingsFooter
        isDirty={isDirty}
        isValid={isValid}
        isConnected={isConnected}
        isReadOnly={isReadOnly}
        isSaving={isSaving}
        errors={formErrors}
        onReset={handleReset}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </div>
  );
};

export default RichTextFieldSettings;
