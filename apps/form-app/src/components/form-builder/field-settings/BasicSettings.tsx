import React from 'react';
import { Label } from '@dculus/ui';
import { FormInputField } from './FormInputField';
import { DefaultValueInput } from './DefaultValueInput';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
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
  const constants = useFieldSettingsConstants();
  
  return (
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

      {/* Default Value */}
      <div className={constants.CSS_CLASSES.INPUT_SPACING}>
        <Label 
          htmlFor="field-default" 
          className={constants.CSS_CLASSES.LABEL_STYLE}
        >
          {constants.LABELS.DEFAULT_VALUE}
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