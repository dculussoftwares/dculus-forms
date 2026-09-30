import React from 'react';
import { DateField, type DateFieldFormData } from "@dculus/types";
import { type FieldErrors } from "react-hook-form";
import { Settings } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Label, Checkbox } from '@dculus/ui';
import { useFieldEditor } from '../../../hooks';
import { useQuizMode } from '../../../contexts/QuizModeContext';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FormInputField,
  FormDatePickerField,
  useFieldSettingsConstants
} from '../field-settings';
import { GradingSettings } from './GradingSettings';

interface DateFieldSettingsProps {
  field: DateField | null;
  isConnected: boolean;
  isReadOnly?: boolean;
  onUpdate?: (updates: Record<string, any>, fieldId: string) => void;
  onFieldSwitch?: () => void;
}

/**
 * Specialized settings component for date fields
 * Handles DATE_FIELD type with date validation and constraints
 */
export const DateFieldSettings: React.FC<DateFieldSettingsProps> = ({
  field,
  isConnected,
  isReadOnly = false,
  onUpdate,
  onFieldSwitch: _onFieldSwitch,
}) => {
  const constants = useFieldSettingsConstants();
  const isEditable = isConnected && !isReadOnly;
  const { enabled: isQuizModeEnabled } = useQuizMode();
  const {
    form,
    errors: formErrors,
    saveStatus,
    handleSave,
  } = useFieldEditor({
    field,
    enabled: isEditable && !!onUpdate,
    onSave: (updates, fieldId) => onUpdate?.(updates, fieldId),
  });

  const { control, watch, setValue } = form;
  const errors = formErrors as FieldErrors<DateFieldFormData>;

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

            {/* Default Value */}
            <FormDatePickerField
              name="defaultValue"
              label={constants.LABELS.DEFAULT_VALUE}
              placeholder={constants.PLACEHOLDERS.DEFAULT_VALUE}
              control={control}
              error={errors.defaultValue}
              disabled={!isEditable}
            />
          </div>

          {/* Date Range Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.DATE_RANGE}
            </h4>
            
            <div className="space-y-4">
              {/* Minimum Date */}
              <FormDatePickerField
                name="minDate"
                label={constants.LABELS.MINIMUM_DATE}
                placeholder={constants.PLACEHOLDERS.NO_MINIMUM}
                control={control}
                error={errors.minDate}
                disabled={!isEditable}
              />

              {/* Maximum Date */}
              <FormDatePickerField
                name="maxDate"
                label={constants.LABELS.MAXIMUM_DATE}
                placeholder={constants.PLACEHOLDERS.NO_MAXIMUM}
                control={control}
                error={errors.maxDate}
                disabled={!isEditable}
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

          {/* Answer key — only when quiz mode is on for this form. Absent/disabled
              quiz settings must render byte-for-byte nothing here (additive guarantee,
              GitHub epic #289). */}
          {isQuizModeEnabled && (
            <GradingSettings
              fieldType={field.type}
              watch={watch}
              setValue={setValue}
              errors={formErrors}
              isEditable={isEditable}
            />
          )}

          {/* Add some bottom padding to prevent content from being hidden behind the floating actions */}
          <div className="pb-4"></div>

          <ValidationSummary errors={formErrors} />
        </form>
      </div>
    </div>
  );
};

export default DateFieldSettings;