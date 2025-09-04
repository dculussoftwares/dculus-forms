import React, { useEffect, useRef } from 'react';
import { NumberField } from '@dculus/types';
import { Settings } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Label } from '@dculus/ui';
import { useNumberFieldForm } from '../../../hooks/field-forms';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FieldSettingsFooter,
  FormInputField,
  FIELD_SETTINGS_CONSTANTS
} from '../field-settings';

interface NumberFieldSettingsProps {
  field: NumberField | null;
  isConnected: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
  onFieldSwitch?: () => void;
}

/**
 * Specialized settings component for number fields
 * Handles NUMBER_FIELD type with numeric validation and constraints
 */
export const NumberFieldSettings: React.FC<NumberFieldSettingsProps> = ({
  field,
  isConnected,
  onUpdate,
  onFieldSwitch: _onFieldSwitch,
}) => {
  const {
    form,
    isSaving,
    isValid,
    errors,
    handleSave,
    handleCancel,
    handleReset,
    handleAutoSave,
  } = useNumberFieldForm({
    field,
    onSave: (updates) => onUpdate?.(updates),
    onCancel: () => console.log('Number field edit cancelled'),
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
          <p className="text-sm">Select a number field to edit its settings</p>
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

          {/* Basic Settings */}
          <div className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_TITLE}>
              {FIELD_SETTINGS_CONSTANTS.SECTION_TITLES.BASIC_SETTINGS}
            </h4>
            
            {/* Label */}
            <FormInputField
              name="label"
              label={FIELD_SETTINGS_CONSTANTS.LABELS.LABEL}
              placeholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.FIELD_LABEL}
              control={control}
              error={errors.label}
              disabled={!isConnected}
            />

            {/* Hint */}
            <FormInputField
              name="hint"
              label={FIELD_SETTINGS_CONSTANTS.LABELS.HELP_TEXT}
              placeholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.HELP_TEXT}
              multiline={true}
              rows={2}
              control={control}
              error={errors.hint}
              disabled={!isConnected}
            />

            {/* Placeholder */}
            <FormInputField
              name="placeholder"
              label={FIELD_SETTINGS_CONSTANTS.LABELS.PLACEHOLDER}
              placeholder="Enter placeholder for number input"
              control={control}
              error={errors.placeholder}
              disabled={!isConnected}
            />

            {/* Prefix */}
            <FormInputField
              name="prefix"
              label={FIELD_SETTINGS_CONSTANTS.LABELS.PREFIX}
              placeholder="e.g., $, €, #"
              control={control}
              error={errors.prefix}
              disabled={!isConnected}
            />

            {/* Default Value */}
            <FormInputField
              name="defaultValue"
              label={FIELD_SETTINGS_CONSTANTS.LABELS.DEFAULT_VALUE}
              placeholder="Enter default number"
              type="number"
              control={control}
              error={errors.defaultValue}
              disabled={!isConnected}
              transform={{
                output: (value: string) => value === '' ? undefined : parseFloat(value)
              }}
            />
          </div>

          {/* Number Range Settings */}
          <div className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_TITLE}>
              Number Constraints
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Minimum Value */}
              <FormInputField
                name="min"
                label="Minimum Value"
                placeholder="No minimum"
                type="number"
                control={control}
                error={errors.min}
                disabled={!isConnected}
                transform={{
                  output: (value: string) => value === '' ? undefined : parseFloat(value)
                }}
              />

              {/* Maximum Value */}
              <FormInputField
                name="max"
                label="Maximum Value"
                placeholder="No maximum"
                type="number"
                control={control}
                error={errors.max}
                disabled={!isConnected}
                transform={{
                  output: (value: string) => value === '' ? undefined : parseFloat(value)
                }}
              />
            </div>
          </div>

          {/* Validation Settings */}
          <div className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_TITLE}>
              {FIELD_SETTINGS_CONSTANTS.SECTION_TITLES.VALIDATION}
            </h4>
            
            {/* Required field toggle */}
            <div className="flex items-center space-x-2">
              <Controller
                name="required"
                control={control}
                render={({ field: controllerField }) => (
                  <input
                    type="checkbox"
                    id="field-required"
                    checked={controllerField.value || false}
                    onChange={controllerField.onChange}
                    disabled={!isConnected}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                )}
              />
              <Label 
                htmlFor="field-required" 
                className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.LABEL_STYLE}
              >
                {FIELD_SETTINGS_CONSTANTS.LABELS.REQUIRED_FIELD}
              </Label>
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

export default NumberFieldSettings;