import React from 'react';
import { FormInputField } from './FormInputField';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
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
  const constants = useFieldSettingsConstants();
  
  return (
    <FormInputField
      name="placeholder"
      label={constants.LABELS.PLACEHOLDER}
      placeholder={constants.PLACEHOLDERS.PLACEHOLDER_TEXT}
      control={control}
      error={errors.placeholder}
      disabled={!isConnected}
    />
  );
};