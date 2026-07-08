import React, { useEffect } from 'react';
import { PhoneNumberField, type PhoneNumberFieldFormData } from "@dculus/types";
import { Controller, useWatch, type FieldErrors } from "react-hook-form";
import { Settings } from 'lucide-react';
import { Label, Checkbox, CountrySelect, PhoneNumberInput, type CountryCode } from '@dculus/ui';
import { useFieldEditor } from '../../../hooks';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FieldSettingsFooter,
  FormInputField,
  ErrorMessage,
  useFieldSettingsConstants
} from '../field-settings';

interface PhoneNumberFieldSettingsProps {
  field: PhoneNumberField | null;
  isConnected: boolean;
  isReadOnly?: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
  onFieldSwitch?: () => void;
}

/**
 * Specialized settings component for phone number fields
 * Handles PHONE_NUMBER_FIELD type with a default country picker and a
 * country-aware default value input (both reuse the shared PhoneNumberInput
 * widget from @dculus/ui, the same one used by the form viewer/preview).
 */
export const PhoneNumberFieldSettings: React.FC<PhoneNumberFieldSettingsProps> = ({
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
    onCancel: () => console.log('Phone number field edit cancelled'),
  });

  const { control, formState: { isDirty } } = form;
  const errors = formErrors as FieldErrors<PhoneNumberFieldFormData>;

  // The default-value input needs the currently-selected default country to
  // interpret what the user types — watch it so it stays in sync as the user
  // changes the country picker above, without waiting for a save.
  const watchedDefaultCountry = useWatch({
    control,
    name: 'defaultCountry' as any,
  }) as CountryCode | undefined;

  // Track field changes (auto-save disabled)
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
          {!isValid && Object.keys(formErrors).length > 0 && (
            <ValidationSummary errors={formErrors} />
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
              multiline={true}
              rows={2}
              control={control}
              error={errors.label}
              disabled={!isEditable}
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
              disabled={!isEditable}
            />

            {/* Placeholder */}
            <FormInputField
              name="placeholder"
              label={constants.LABELS.PLACEHOLDER}
              placeholder={constants.PLACEHOLDERS.PLACEHOLDER_TEXT}
              control={control}
              error={errors.placeholder}
              disabled={!isEditable}
            />
          </div>

          {/* Phone Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.PHONE_SETTINGS}
            </h4>

            {/* Default Country — pre-selects the country selector when the field is empty; does not restrict which country a respondent can pick */}
            <div className={constants.CSS_CLASSES.INPUT_SPACING}>
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                {constants.LABELS.DEFAULT_COUNTRY}
              </Label>
              <Controller
                name={"defaultCountry" as any}
                control={control}
                render={({ field: cf }) => (
                  <CountrySelect
                    value={cf.value as CountryCode | undefined}
                    onChange={cf.onChange}
                    disabled={!isEditable}
                    placeholder={constants.PLACEHOLDERS.SELECT_COUNTRY}
                  />
                )}
              />
            </div>

            {/* Default Value */}
            <div className={constants.CSS_CLASSES.INPUT_SPACING}>
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                {constants.LABELS.DEFAULT_VALUE}
              </Label>
              <Controller
                name="defaultValue"
                control={control}
                render={({ field: cf }) => (
                  <PhoneNumberInput
                    value={(cf.value as string) || ''}
                    onChange={cf.onChange}
                    onBlur={cf.onBlur}
                    defaultCountry={watchedDefaultCountry}
                    disabled={!isEditable}
                    error={!!errors.defaultValue}
                  />
                )}
              />
              <ErrorMessage error={errors.defaultValue} />
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
                    disabled={!isEditable}
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

export default PhoneNumberFieldSettings;
