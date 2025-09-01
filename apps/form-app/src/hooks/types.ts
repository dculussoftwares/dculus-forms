import { UseFormReturn, FieldErrors } from 'react-hook-form';
import { FormField, FieldFormData } from '@dculus/types';

/**
 * Props for the useFieldEditor hook
 */
export interface UseFieldEditorProps {
  /** The form field being edited (null when no field selected) */
  field: FormField | null;
  /** Callback when field is saved */
  onSave: (updates: Record<string, any>) => void;
  /** Callback when editing is cancelled */
  onCancel?: () => void;
}

/**
 * Return type for the useFieldEditor hook
 */
export interface UseFieldEditorReturn {
  /** React Hook Form instance */
  form: UseFormReturn<FieldFormData>;
  /** Whether form has unsaved changes */
  isDirty: boolean;
  /** Whether save operation is in progress */
  isSaving: boolean;
  /** Whether form data is valid */
  isValid: boolean;
  /** Form validation errors */
  errors: FieldErrors<FieldFormData>;
  /** Save the current form data */
  handleSave: () => Promise<void>;
  /** Cancel editing and revert changes */
  handleCancel: () => void;
  /** Reset form to original field data */
  handleReset: () => void;
  /** Auto-save if valid and dirty */
  handleAutoSave: () => void;
  /** Add a new option (for option-based fields) */
  addOption: () => void;
  /** Update an option at specific index */
  updateOption: (index: number, value: string) => void;
  /** Remove an option at specific index */
  removeOption: (index: number) => void;
  /** Set a form field value */
  setValue: (name: any, value: any) => void;
  /** Get form field values */
  getValues: (name?: string) => any;
}

/**
 * Options configuration for option-based fields
 */
export interface OptionFieldData {
  options: string[];
}

/**
 * Validation configuration for text fields
 */
export interface ValidationFieldData {
  validation: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
  };
}

/**
 * Range configuration for number fields
 */
export interface NumberRangeFieldData {
  min?: number;
  max?: number;
}

/**
 * Date range configuration for date fields
 */
export interface DateRangeFieldData {
  minDate?: string;
  maxDate?: string;
}

/**
 * Selection validation configuration for checkbox fields
 */
export interface CheckboxValidationFieldData {
  validation: {
    required: boolean;
    minSelections?: number;
    maxSelections?: number;
  };
}

/**
 * Base field data that all fields share
 */
export interface BaseFieldData {
  label: string;
  hint?: string;
  placeholder?: string;
  defaultValue?: string | string[];
  prefix?: string;
  required: boolean;
}