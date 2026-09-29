import React from 'react';
import DOMPurify from 'dompurify';
import { RichTextFormField } from '@dculus/types';
import { Settings } from 'lucide-react';
import { useFieldEditor } from '../../../hooks';
import {
  ValidationSummary,
  FieldSettingsHeader,
  RichTextSettings,
  useFieldSettingsConstants,
} from '../field-settings';

interface RichTextFieldSettingsProps {
  field: RichTextFormField | null;
  isConnected: boolean;
  isReadOnly?: boolean;
  onUpdate?: (updates: Record<string, any>, fieldId: string) => void;
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
  const isEditable = isConnected && !isReadOnly;

  const {
    form,
    isValid,
    errors: formErrors,
    saveStatus,
    handleSave,
  } = useFieldEditor({
    field,
    enabled: isEditable && !!onUpdate,
    onSave: (updates, fieldId) => {
      if (updates.content) {
        updates.content = DOMPurify.sanitize(updates.content);
      }
      onUpdate?.(updates, fieldId);
    },
  });

  const { control } = form;

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
      <FieldSettingsHeader field={field} saveStatus={saveStatus} isConnected={isConnected} />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="p-4 space-y-6"
        >
          {/* Validation Error Summary */}
          {!isValid && Object.keys(formErrors).length > 0 && (
            <ValidationSummary errors={formErrors} />
          )}

          {/* Rich Text Content Settings */}
          <RichTextSettings
            control={control as any}
            errors={formErrors}
            isConnected={isConnected}
            isReadOnly={isReadOnly}
            fieldId={field.id}
          />

          {/* Add some bottom padding to prevent content from being hidden behind the floating actions */}
          <div className="pb-4"></div>
        </form>
      </div>
    </div>
  );
};

export default RichTextFieldSettings;
