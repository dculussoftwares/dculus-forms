import { UseFormReturn, FieldErrors } from 'react-hook-form';
import { FormField, FieldFormData } from '@dculus/types';

/**
 * Autosave state of the field settings panel:
 * - idle: nothing edited since the field was selected
 * - pending: edits waiting for the debounce (or for the connection to return)
 * - saved: every edit has been written to the collaborative document
 * - invalid: edits are held back until validation errors are fixed
 */
export type FieldSaveStatus = 'idle' | 'pending' | 'saved' | 'invalid';

/**
 * Props for the useFieldEditor hook
 */
export interface UseFieldEditorProps {
  /** The form field being edited (null when no field selected) */
  field: FormField | null;
  /** Writes changed properties to the field; `fieldId` is the field the values belong to */
  onSave: (updates: Record<string, any>, fieldId: string) => void;
  /** When false (read-only or disconnected), edits are held instead of saved */
  enabled?: boolean;
}

/**
 * Return type for the useFieldEditor hook
 */
export interface UseFieldEditorReturn {
  /** React Hook Form instance */
  form: UseFormReturn<FieldFormData>;
  /** Whether form data is valid */
  isValid: boolean;
  /** Form validation errors */
  errors: FieldErrors<FieldFormData>;
  /** Autosave state for the status indicator */
  saveStatus: FieldSaveStatus;
  /** Save pending edits immediately (skips the debounce) */
  handleSave: () => void;
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
 * Rich text content configuration for rich text fields
 */
export interface RichTextFieldData {
  content: string;
}

/**
 * File upload configuration for file upload fields
 */
export interface FileUploadFieldData {
  allowedMimeTypes?: string[];
  maxFileSizeMb?: number;
  maxFiles?: number;
}

/**
 * Default-country hint for phone number fields
 */
export interface PhoneNumberFieldData {
  defaultCountry?: string;
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
  suffix?: string;
  required: boolean;
}
