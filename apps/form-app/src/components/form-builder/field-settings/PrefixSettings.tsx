import React from 'react';
import { FormInputField } from './FormInputField';
import { FIELD_SETTINGS_CONSTANTS } from './constants';
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
  return (
    <FormInputField
      name="prefix"
      label={FIELD_SETTINGS_CONSTANTS.LABELS.PREFIX}
      placeholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.PREFIX_TEXT}
      control={control}
      error={errors.prefix}
      disabled={!isConnected}
    />
  );
};