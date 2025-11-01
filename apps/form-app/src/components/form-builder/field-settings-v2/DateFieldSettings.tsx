import React, { useEffect, useRef } from 'react';
import { DateField } from '@dculus/types';
import { Settings } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Label, Checkbox } from '@dculus/ui';
import { useDateFieldForm } from '../../../hooks/field-forms';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FieldSettingsFooter,
  FormInputField,
  useFieldSettingsConstants
} from '../field-settings';

interface DateFieldSettingsProps {
  field: DateField | null;
  isConnected: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
  onFieldSwitch?: () => void;
}

/**
 * Specialized settings component for date fields
 * Handles DATE_FIELD type with date validation and constraints
 */
export const DateFieldSettings: React.FC<DateFieldSettingsProps> = ({
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
    errors,
    handleSave,
    handleCancel,
    handleReset,
  } = useDateFieldForm({
    field,
    onSave: (updates) => onUpdate?.(updates),
    onCancel: () => console.log('Date field edit cancelled'),
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

            {/* Default Value */}
            <FormInputField
              name="defaultValue"
              label={constants.LABELS.DEFAULT_VALUE}
              placeholder={constants.PLACEHOLDERS.DEFAULT_VALUE}
              type="date"
              control={control}
              error={errors.defaultValue}
              disabled={!isConnected}
            />
          </div>

          {/* Date Range Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.DATE_RANGE}
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Minimum Date */}
              <FormInputField
                name="minDate"
                label={constants.LABELS.MINIMUM_DATE}
                placeholder={constants.PLACEHOLDERS.NO_MINIMUM}
                type="date"
                control={control}
                error={errors.minDate}
                disabled={!isConnected}
              />

              {/* Maximum Date */}
              <FormInputField
                name="maxDate"
                label={constants.LABELS.MAXIMUM_DATE}
                placeholder={constants.PLACEHOLDERS.NO_MAXIMUM}
                type="date"
                control={control}
                error={errors.maxDate}
                disabled={!isConnected}
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

export default DateFieldSettings;