import React from 'react';
import { Controller } from 'react-hook-form';
import { Label, Checkbox } from '@dculus/ui';
import { FormInputField } from './FormInputField';
import { FIELD_SETTINGS_CONSTANTS } from './constants';
import { FieldAwareSettingsProps } from './types';
import { FieldType } from '@dculus/types';

/**
 * Settings component for field validation rules
 * Handles required field toggle and character limits for text fields
 */
export const ValidationSettings: React.FC<FieldAwareSettingsProps> = ({
  control,
  isConnected,
  errors,
  field
}) => {
  // Check if the field supports character limits
  const supportsCharacterLimits = field.type === FieldType.TEXT_INPUT_FIELD || field.type === FieldType.TEXT_AREA_FIELD;

  return (
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
          className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.LABEL_STYLE}
        >
          {FIELD_SETTINGS_CONSTANTS.LABELS.REQUIRED_FIELD}
        </Label>
      </div>

      {/* Character Limits for text fields */}
      {supportsCharacterLimits && (
        <>
          <FormInputField
            name="validation.minLength"
            label={FIELD_SETTINGS_CONSTANTS.LABELS.MINIMUM_LENGTH}
            placeholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.NO_MINIMUM}
            type="number"
            min="0"
            control={control}
            error={(errors.validation as any)?.minLength}
            disabled={!isConnected}
            transform={{
              output: (value: string) => value === '' ? undefined : parseInt(value)
            }}
          />

          <FormInputField
            name="validation.maxLength"
            label={FIELD_SETTINGS_CONSTANTS.LABELS.MAXIMUM_LENGTH}
            placeholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.NO_MAXIMUM}
            type="number"
            min="1"
            control={control}
            error={(errors.validation as any)?.maxLength}
            disabled={!isConnected}
            transform={{
              output: (value: string) => value === '' ? undefined : parseInt(value)
            }}
          />
        </>
      )}
    </div>
  );
};