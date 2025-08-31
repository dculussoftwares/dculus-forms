import React from 'react';
import { Label } from '@dculus/ui';
import { FormInputField } from './FormInputField';
import { DefaultValueInput } from './DefaultValueInput';
import { FIELD_SETTINGS_CONSTANTS } from './constants';
import { WatchableSettingsProps } from './types';
import { FormField } from '@dculus/types';

/**
 * Props interface extending both base and watchable settings props
 */
interface BasicSettingsProps extends WatchableSettingsProps {
  /** FormField can be null when no field is selected */
  field: FormField | null;
}

/**
 * Basic settings component for all field types
 * Handles label, help text, and default value configuration
 */
export const BasicSettings: React.FC<BasicSettingsProps> = ({
  control,
  errors,
  isConnected,
  field,
  watch,
  setValue
}) => {
  return (
    <div className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_SPACING}>
      <h4 className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.SECTION_TITLE}>
        {FIELD_SETTINGS_CONSTANTS.SECTION_TITLES.BASIC_SETTINGS}
      </h4>
      
      {/* Label */}
      <FormInputField
        name="label"
        label={FIELD_SETTINGS_CONSTANTS.LABELS.LABEL}
        placeholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.FIELD_LABEL}
        control={control}
        error={errors.label}
        disabled={!isConnected}
      />

      {/* Hint */}
      <FormInputField
        name="hint"
        label={FIELD_SETTINGS_CONSTANTS.LABELS.HELP_TEXT}
        placeholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.HELP_TEXT}
        multiline={true}
        rows={2}
        control={control}
        error={errors.hint}
        disabled={!isConnected}
      />

      {/* Default Value */}
      <div className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.INPUT_SPACING}>
        <Label 
          htmlFor="field-default" 
          className={FIELD_SETTINGS_CONSTANTS.CSS_CLASSES.LABEL_STYLE}
        >
          {FIELD_SETTINGS_CONSTANTS.LABELS.DEFAULT_VALUE}
        </Label>
        <DefaultValueInput
          field={field}
          control={control}
          errors={errors}
          isConnected={isConnected}
          watch={watch}
          setValue={setValue}
        />
      </div>
    </div>
  );
};