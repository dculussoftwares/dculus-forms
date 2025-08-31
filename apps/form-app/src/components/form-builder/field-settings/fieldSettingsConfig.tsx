import React from 'react';
import { FieldType } from '@dculus/types';
import { TextInputSettings } from './TextInputSettings';
import { PrefixSettings } from './PrefixSettings';
import { NumberRangeSettings } from './NumberRangeSettings';
import { DateRangeSettings } from './DateRangeSettings';
import { OptionsSettings } from './OptionsSettings';
import { BaseFieldSettingsProps, OptionsSettingsProps } from './types';

/**
 * Configuration for field-specific settings components
 * Replaces switch statement with declarative configuration
 */
export interface FieldSettingsComponentConfig {
  /** React components to render for this field type */
  components: Array<{
    /** Component to render */
    component: React.ComponentType<any>;
    /** Props to pass to the component */
    getProps?: (baseProps: BaseFieldSettingsProps & OptionsSettingsProps) => Record<string, any>;
  }>;
  /** Whether this field type supports character limits */
  supportsCharacterLimits: boolean;
  /** Whether this field type supports prefix/suffix */
  supportsPrefix: boolean;
  /** Whether this field type has options */
  hasOptions: boolean;
}

/**
 * Field settings configuration map
 * Defines which components to render for each field type
 */
export const FIELD_SETTINGS_CONFIG: Partial<Record<FieldType, FieldSettingsComponentConfig>> = {
  [FieldType.TEXT_INPUT_FIELD]: {
    components: [
      { component: TextInputSettings },
      { component: PrefixSettings },
    ],
    supportsCharacterLimits: true,
    supportsPrefix: true,
    hasOptions: false,
  },

  [FieldType.TEXT_AREA_FIELD]: {
    components: [
      { component: TextInputSettings },
      { component: PrefixSettings },
    ],
    supportsCharacterLimits: true,
    supportsPrefix: true,
    hasOptions: false,
  },

  [FieldType.EMAIL_FIELD]: {
    components: [
      { component: TextInputSettings },
    ],
    supportsCharacterLimits: false,
    supportsPrefix: false,
    hasOptions: false,
  },

  [FieldType.NUMBER_FIELD]: {
    components: [
      { component: TextInputSettings },
      { component: PrefixSettings },
      { component: NumberRangeSettings },
    ],
    supportsCharacterLimits: false,
    supportsPrefix: true,
    hasOptions: false,
  },

  [FieldType.SELECT_FIELD]: {
    components: [
      {
        component: OptionsSettings,
        getProps: (baseProps) => ({
          options: baseProps.options,
          addOption: baseProps.addOption,
          updateOption: baseProps.updateOption,
          removeOption: baseProps.removeOption,
        }),
      },
    ],
    supportsCharacterLimits: false,
    supportsPrefix: false,
    hasOptions: true,
  },

  [FieldType.RADIO_FIELD]: {
    components: [
      {
        component: OptionsSettings,
        getProps: (baseProps) => ({
          options: baseProps.options,
          addOption: baseProps.addOption,
          updateOption: baseProps.updateOption,
          removeOption: baseProps.removeOption,
        }),
      },
    ],
    supportsCharacterLimits: false,
    supportsPrefix: false,
    hasOptions: true,
  },

  [FieldType.CHECKBOX_FIELD]: {
    components: [
      {
        component: OptionsSettings,
        getProps: (baseProps) => ({
          options: baseProps.options,
          addOption: baseProps.addOption,
          updateOption: baseProps.updateOption,
          removeOption: baseProps.removeOption,
        }),
      },
    ],
    supportsCharacterLimits: false,
    supportsPrefix: false,
    hasOptions: true,
  },

  [FieldType.DATE_FIELD]: {
    components: [
      { component: DateRangeSettings },
    ],
    supportsCharacterLimits: false,
    supportsPrefix: false,
    hasOptions: false,
  },
};

/**
 * Helper function to get field configuration
 */
export function getFieldSettingsConfig(fieldType: FieldType): FieldSettingsComponentConfig | null {
  return FIELD_SETTINGS_CONFIG[fieldType] || null;
}

/**
 * Helper function to check if a field type supports a specific feature
 */
export function fieldSupportsFeature(
  fieldType: FieldType, 
  feature: keyof Pick<FieldSettingsComponentConfig, 'supportsCharacterLimits' | 'supportsPrefix' | 'hasOptions'>
): boolean {
  const config = getFieldSettingsConfig(fieldType);
  return config ? config[feature] : false;
}