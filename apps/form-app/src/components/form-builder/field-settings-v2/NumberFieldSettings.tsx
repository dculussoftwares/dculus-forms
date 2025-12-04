import React, { useEffect, useRef } from 'react';
import { NumberField } from '@dculus/types';
import { Settings } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Label, Checkbox } from '@dculus/ui';
import { useFieldEditor } from '../../../hooks';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FieldSettingsFooter,
  FormInputField,
  useFieldSettingsConstants
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
      if (onUpdate) {
        await onUpdate(updates);
      }
    },
    onCancel: () => console.log('Number field edit cancelled'),
  });

  // Cast errors to any to handle union type properties
  const errors = formErrors as any;

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

          {/* Basic Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.BASIC_SETTINGS}
            </h4>
            
            {/* Label */}
            <FormInputField
              name="label"
              label={constants.LABELS.LABEL}
              placeholder={constants.PLACEHOLDERS.FIELD_LABEL}
              control={control}
              error={errors.label}
              disabled={!isConnected}
            />

            {/* Hint */}
            <FormInputField
              name="hint"
              label={constants.LABELS.HELP_TEXT}
              placeholder={constants.PLACEHOLDERS.HELP_TEXT}
              multiline={true}
              rows={2}
              control={control}
              error={errors.hint}
              disabled={!isConnected}
            />

            {/* Placeholder */}
            <FormInputField
              name="placeholder"
              label={constants.LABELS.PLACEHOLDER}
              placeholder={constants.PLACEHOLDERS.PLACEHOLDER_TEXT}
              control={control}
              error={errors.placeholder}
              disabled={!isConnected}
            />

            {/* Prefix */}
            <FormInputField
              name="prefix"
              label={constants.LABELS.PREFIX}
              placeholder={constants.PLACEHOLDERS.PREFIX_TEXT}
              control={control}
              error={errors.prefix}
              disabled={!isConnected}
            />

            {/* Default Value */}
            <FormInputField
              name="defaultValue"
              label={constants.LABELS.DEFAULT_VALUE}
              placeholder={constants.PLACEHOLDERS.DEFAULT_VALUE}
              type="number"
              control={control}
              error={errors.defaultValue}
              disabled={!isConnected}
              transform={{
                output: (value: string) => value === '' ? undefined : value // Let useFieldEditor handle type conversion or keep as string for now
              }}
            />
          </div>

          {/* Number Range Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.NUMBER_RANGE}
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Minimum Value */}
              <FormInputField
                name="min"
                label={constants.LABELS.MINIMUM}
                placeholder={constants.PLACEHOLDERS.NO_MINIMUM}
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
                label={constants.LABELS.MAXIMUM}
                placeholder={constants.PLACEHOLDERS.NO_MAXIMUM}
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
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.VALIDATION}
            </h4>
            
            {/* Required field toggle */}
            <div className="flex items-center space-x-2">
              <Controller
                name="required"
                control={control}
                render={({ field: controllerField }) => (
                  <Checkbox
                    id="field-required"
                    checked={controllerField.value || false}
                    onCheckedChange={controllerField.onChange}
                    disabled={!isConnected}
                  />
                )}
              />
              <Label 
                htmlFor="field-required" 
                className={constants.CSS_CLASSES.LABEL_STYLE}
              >
                {constants.LABELS.REQUIRED_FIELD}
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