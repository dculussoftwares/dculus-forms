import { Control, FieldErrors } from 'react-hook-form';
import { FormField } from '@dculus/types';

/**
 * Base props interface for all field settings components
 */
export interface BaseFieldSettingsProps {
  /** React Hook Form control instance */
  control: Control<any>;
  /** Form validation errors */
  errors: FieldErrors<any>;
  /** WebSocket connection status */
  isConnected: boolean;
}

/**
 * Props for settings components that need access to the field instance
 */
export interface FieldAwareSettingsProps extends BaseFieldSettingsProps {
  /** The form field being edited */
  field: FormField;
}

/**
 * Props for option-based settings components (Select, Radio, Checkbox)
 */
export interface OptionsSettingsProps extends BaseFieldSettingsProps {
  /** Array of options for the field */
  options: string[];
  /** Function to add a new option */
  addOption: () => void;
  /** Function to update an option at a specific index */
  updateOption: (index: number, value: string) => void;
  /** Function to remove an option at a specific index */
  removeOption: (index: number) => void;
}

/**
 * Props for settings components that need form watching and value setting
 */
export interface WatchableSettingsProps extends BaseFieldSettingsProps {
  /** Function to watch form field values */
  watch: (name: string) => any;
  /** Function to set form field values */
  setValue?: (name: string, value: any) => void;
}

/**
 * Common field validation error types
 */
export type FieldValidationError = {
  message?: string;
  type?: string;
} | string | undefined;

/**
 * Props for error message components
 */
export interface ErrorMessageProps {
  /** Error object or message string */
  error?: FieldValidationError;
}

/**
 * Configuration for field-specific settings
 */
export interface FieldSettingsConfig {
  /** Component to render for this field type */
  component: React.ComponentType<any>;
  /** Additional props to pass to the component */
  props?: Record<string, any>;
  /** Whether this field type supports character limits */
  supportsCharacterLimits?: boolean;
  /** Whether this field type supports prefix/suffix */
  supportsPrefix?: boolean;
  /** Whether this field type has options */
  hasOptions?: boolean;
}