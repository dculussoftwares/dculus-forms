import React from 'react';
import { FormInputField } from './FormInputField';
import { FIELD_SETTINGS_CONSTANTS } from './constants';
import { BaseFieldSettingsProps } from './types';

/**
 * Settings component for text input fields (placeholder configuration)
 * Used by TEXT_INPUT, TEXT_AREA, EMAIL, and NUMBER field types
 */
export const TextInputSettings: React.FC<BaseFieldSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <FormInputField
      name="placeholder"
      label={FIELD_SETTINGS_CONSTANTS.LABELS.PLACEHOLDER}
      placeholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.PLACEHOLDER_TEXT}
      control={control}
      error={errors.placeholder}
      disabled={!isConnected}
    />
  );
};