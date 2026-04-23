import React, { useEffect } from 'react';
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

// Helper function to sanitize HTML content using DOMParser for safe parsing
const sanitizeHtmlContent = (content: string): string => {
  if (!content) return '';

  // Use DOMParser for safe HTML parsing instead of regex
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');

  // Remove all script elements
  const scripts = doc.querySelectorAll('script');
  scripts.forEach((script) => script.remove());

  // Remove all elements with dangerous event handlers
  const allElements = doc.querySelectorAll('*');
  allElements.forEach((element) => {
    // Get all attributes
    const attributeNames = element.getAttributeNames();
    attributeNames.forEach((attrName) => {
      const lowerAttr = attrName.toLowerCase();
      // Remove event handlers (on*)
      if (lowerAttr.startsWith('on')) {
        element.removeAttribute(attrName);
      }
      // Remove javascript: URIs from href/src
      const attrValue = element.getAttribute(attrName);
      if (attrValue && /^\s*javascript:/i.test(attrValue)) {
        element.removeAttribute(attrName);
      }
    });
  });

  // Return sanitized HTML from body
  return doc.body.innerHTML.trim();
};

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
        updates.content = sanitizeHtmlContent(updates.content);
      }
      if (onUpdate) {
        await onUpdate(updates);
      }
    },
    onCancel: () => console.log('Rich text field edit cancelled'),
  });

  // Cast errors to any to handle union type properties
  const errors = formErrors as any;

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
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
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
          {!isValid && Object.keys(errors).length > 0 && (
            <ValidationSummary errors={errors} />
          )}

          {/* Rich Text Content Settings */}
          <RichTextSettings
            control={control}
            errors={errors}
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
        errors={errors}
        onReset={handleReset}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </div>
  );
};

export default RichTextFieldSettings;
