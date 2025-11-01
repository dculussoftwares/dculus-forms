import React from 'react';
import { FormInputField } from './FormInputField';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { BaseFieldSettingsProps } from './types';

/**
 * Settings component for prefix configuration
 * Used by TEXT_INPUT, TEXT_AREA, and NUMBER field types
 */
export const PrefixSettings: React.FC<BaseFieldSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  const constants = useFieldSettingsConstants();
  
  return (
    <FormInputField
      name="prefix"
      label={constants.LABELS.PREFIX}
      placeholder={constants.PLACEHOLDERS.PREFIX_TEXT}
      control={control}
      error={errors.prefix}
      disabled={!isConnected}
    />
  );
};