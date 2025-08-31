import React from 'react';
import { FormField } from '@dculus/types';
import { BaseFieldSettingsProps, OptionsSettingsProps } from './types';
import { getFieldSettingsConfig } from './fieldSettingsConfig';

interface FieldTypeSpecificSettingsProps extends BaseFieldSettingsProps, OptionsSettingsProps {
  /** The form field being configured */
  field: FormField;
}

/**
 * Renders field-type-specific settings components based on configuration
 * Uses a declarative configuration approach instead of switch statements
 */
export const FieldTypeSpecificSettings: React.FC<FieldTypeSpecificSettingsProps> = ({
  field,
  control,
  errors,
  isConnected,
  options,
  addOption,
  updateOption,
  removeOption
}) => {
  // Get configuration for this field type
  const config = getFieldSettingsConfig(field.type);
  
  if (!config) {
    return null;
  }

  // Base props that all components receive
  const baseProps = {
    control,
    errors,
    isConnected,
    options,
    addOption,
    updateOption,
    removeOption,
  };

  // Render all configured components for this field type
  return (
    <>
      {config.components.map((componentConfig, index) => {
        const Component = componentConfig.component;
        
        // Get component-specific props if defined
        const componentProps = componentConfig.getProps 
          ? { ...baseProps, ...componentConfig.getProps(baseProps) }
          : baseProps;

        return (
          <Component
            key={`${field.type}-component-${index}`}
            {...componentProps}
          />
        );
      })}
    </>
  );
};