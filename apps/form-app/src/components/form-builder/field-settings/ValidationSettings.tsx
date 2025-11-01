import React from 'react';
import { Controller } from 'react-hook-form';
import { Label, Checkbox } from '@dculus/ui';
import { FormInputField } from './FormInputField';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { FieldAwareSettingsProps } from './types';
import { FieldType } from '@dculus/types';

/**
 * Settings component for field validation rules
 * Handles required field toggle and character limits for text fields
 */
export const ValidationSettings: React.FC<FieldAwareSettingsProps> = ({
  control,
  isConnected,
  field
}) => {
  const constants = useFieldSettingsConstants();
  
  // Check if the field supports character limits
  const supportsCharacterLimits = field.type === FieldType.TEXT_INPUT_FIELD || field.type === FieldType.TEXT_AREA_FIELD;

  return (
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

      {/* Character Limits for text fields */}
      {supportsCharacterLimits && (
        <>
                    <FormInputField
            name="validation.minLength"
            control={control}
            label={constants.LABELS.MINIMUM_LENGTH}
            placeholder={constants.PLACEHOLDERS.NO_MINIMUM}
            type="number"
            min={0}
          />

          <FormInputField
            name="validation.maxLength"
            control={control}
            label={constants.LABELS.MAXIMUM_LENGTH}
            placeholder={constants.PLACEHOLDERS.NO_MAXIMUM}
            type="number"
            min={1}
          />
        </>
      )}
    </div>
  );
};