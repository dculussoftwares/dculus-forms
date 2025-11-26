import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { SelectField, RadioField, CheckboxField } from '@dculus/types';
import { z } from 'zod';

// Type for selection field form data
interface SelectionFieldFormData {
  label: string;
  hint?: string;
  prefix?: string;
  defaultValue?: string | string[];
  required: boolean;
  options: string[];
  multiple?: boolean; // For select fields
  validation?: {
    minSelections?: number;
    maxSelections?: number;
  };
}

// Props interface for the hook
export interface UseSelectionFieldFormProps {
  field: SelectField | RadioField | CheckboxField | null;
  onSave: (updates: Record<string, any>) => void;
  onCancel?: () => void;
}

// Return type for the hook
export interface UseSelectionFieldFormReturn {
  form: ReturnType<typeof useForm<SelectionFieldFormData>>;
  isDirty: boolean;
  isSaving: boolean;
  isValid: boolean;
  errors: any;
  handleSave: () => void;
  handleCancel: () => void;
  handleReset: () => void;
  setValue: ReturnType<typeof useForm<SelectionFieldFormData>>['setValue'];
  getValues: ReturnType<typeof useForm<SelectionFieldFormData>>['getValues'];
  // Option management functions
  addOption: () => void;
  updateOption: (index: number, value: string) => void;
  removeOption: (index: number) => void;
}

// Validation schema for selection fields
const selectionFieldValidationSchema = z.object({
  label: z.string()
    .min(1, 'fieldSettingsConstants:errorMessages.labelRequired')
    .max(200, 'fieldSettingsConstants:errorMessages.labelTooLong'),
  hint: z.string()
    .max(500, 'fieldSettingsConstants:errorMessages.hintTooLong')
    .optional(),
  prefix: z.string()
    .max(10, 'fieldSettingsConstants:errorMessages.prefixTooLong')
    .optional(),
  defaultValue: z.union([z.string(), z.array(z.string())]).optional(),
  required: z.boolean().default(false),
  options: z.array(
    z.string()
      .min(1, 'Option cannot be empty')
      .max(100, 'Option is too long (max 100 characters)')
  ).min(1, 'At least one option is required')
    .refine(
      (options) => {
        // Check that all options are non-empty strings
        return options.every(option => option && option.trim().length > 0);
      },
      {
        message: 'All options must have values. Please remove or fill empty options.',
      }
    ),
  multiple: z.boolean().optional(),
  validation: z.object({
    minSelections: z.number().min(0, 'Minimum selections must be 0 or greater').optional(),
    maxSelections: z.number().min(1, 'Maximum selections must be 1 or greater').optional(),
  }).optional().refine(
    (validation) => {
      if (!validation) return true;
      const { minSelections, maxSelections } = validation;
      if (minSelections !== undefined && maxSelections !== undefined) {
        return minSelections <= maxSelections;
      }
      return true;
    },
    {
      message: 'Minimum selections must be less than or equal to maximum selections',
      path: ['maxSelections'],
    }
  ),
}).refine(
  (data) => {
    // Validate that options are unique and non-empty
    const nonEmptyOptions = data.options.filter(option => option.trim().length > 0);
    const uniqueOptions = Array.from(new Set(nonEmptyOptions));
    return uniqueOptions.length === nonEmptyOptions.length && nonEmptyOptions.length > 0;
  },
  {
    message: 'Options must be unique and non-empty',
    path: ['options'],
  }
).refine(
  (data) => {
    // Cross-field validation: default value should be valid option(s)
    if (!data.defaultValue || data.options.length === 0) return true;
    
    const validOptions = data.options.filter(option => option.trim().length > 0);
    
    if (Array.isArray(data.defaultValue)) {
      return data.defaultValue.every(value => validOptions.includes(value));
    } else {
      return validOptions.includes(data.defaultValue);
    }
  },
  {
    message: 'Default value must be a valid option',
    path: ['defaultValue'],
  }
).refine(
  (data) => {
    // Cross-field validation: selection limits should be reasonable for checkbox fields
    if (!data.validation || data.validation.maxSelections === undefined) return true;
    
    const validOptionsCount = data.options.filter(option => option.trim().length > 0).length;
    return data.validation.maxSelections <= validOptionsCount;
  },
  {
    message: 'Maximum selections cannot exceed the number of available options',
    path: ['validation', 'maxSelections'],
  }
);

// Helper function to extract data from selection field
const extractSelectionFieldData = (field: SelectField | RadioField | CheckboxField): SelectionFieldFormData => {
  const validation = (field as any).validation || {};
  
  // Handle different field types
  const isSelectField = field.type === 'select_field';
  const isCheckboxField = field.type === 'checkbox_field';
  
  // Get the correct default value property based on field type
  let defaultValue;
  if (isCheckboxField) {
    // CheckboxField uses 'defaultValues' (plural) property
    defaultValue = (field as CheckboxField).defaultValues || [];
  } else {
    // SelectField and RadioField use 'defaultValue' (singular) property
    defaultValue = field.defaultValue || '';
  }
  
  return {
    label: field.label || '',
    hint: field.hint || '',
    prefix: field.prefix || '',
    defaultValue,
    required: validation.required || false,
    options: (field as any).options || [''],
    multiple: isSelectField ? (field as any).multiple : undefined,
    validation: isCheckboxField ? {
      minSelections: validation.minSelections,
      maxSelections: validation.maxSelections,
    } : undefined,
  };
};

/**
 * Custom hook for managing selection field form state with enhanced stability
 * Handles SELECT_FIELD, RADIO_FIELD, and CHECKBOX_FIELD types
 */
export function useSelectionFieldForm({ field, onSave, onCancel }: UseSelectionFieldFormProps): UseSelectionFieldFormReturn {
  const [isSaving, setIsSaving] = useState(false);

  // Memoized validation schema to prevent unnecessary re-renders
  const validationSchema = useMemo(() => selectionFieldValidationSchema, []);

  const form = useForm<SelectionFieldFormData>({
    resolver: zodResolver(validationSchema as any),
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
    defaultValues: {
      label: 'Field Label',
      hint: '',
      prefix: '',
      defaultValue: '',
      required: false,
      options: [''],
      multiple: undefined,
      validation: undefined,
    },
  });

  const { 
    handleSubmit, 
    reset, 
    watch, 
    trigger,
    formState: { errors, isValid, isDirty },
    setValue,
    getValues
  } = form;

  // Watch all form values to detect changes
  watch();

  // Watch specific fields for cross-field validation
  const options = watch('options') || [];
  const minSelectionsValue = watch('validation.minSelections');
  const maxSelectionsValue = watch('validation.maxSelections');
  const defaultValue = watch('defaultValue');

  // Re-trigger validation when related fields change
  useEffect(() => {
    trigger(['options', 'validation.minSelections', 'validation.maxSelections', 'defaultValue']);
  }, [options, minSelectionsValue, maxSelectionsValue, defaultValue, trigger]);

  // Memoized field data extraction to prevent unnecessary re-computation
  const fieldData = useMemo(() => {
    return field ? extractSelectionFieldData(field) : null;
  }, [
    field?.id, 
    field?.type,
    field?.label,
    field?.hint,
    field?.prefix,
    field?.defaultValue, // For SelectField and RadioField
    (field as CheckboxField)?.defaultValues, // For CheckboxField
    (field as any)?.options,
    (field as any)?.multiple, // For SelectField
    (field as any)?.validation?.required,
    (field as any)?.validation?.minSelections, // For CheckboxField
    (field as any)?.validation?.maxSelections, // For CheckboxField
  ]);

  // Track which field we've initialized to prevent unnecessary resets
  const initializedFieldRef = useRef<string | null>(null);

  // Update form when field changes
  useEffect(() => {
    if (field && fieldData && field.id !== initializedFieldRef.current) {
      reset(fieldData);
      initializedFieldRef.current = field.id;
    }
  }, [field?.id, reset, fieldData]);


  // Memoized option management functions
  const optionHandlers = useMemo(() => ({
    addOption: () => {
      const currentOptions = getValues('options') || [];
      setValue('options', [...currentOptions, ''], { shouldDirty: true });
    },
    updateOption: (index: number, value: string) => {
      const currentOptions = getValues('options') || [];
      const newOptions = [...currentOptions];
      newOptions[index] = value;
      setValue('options', newOptions, { shouldDirty: true });
    },
    removeOption: (index: number) => {
      const currentOptions = getValues('options') || [];
      const newOptions = currentOptions.filter((_, i) => i !== index);
      // Ensure at least one option remains
      if (newOptions.length === 0) {
        newOptions.push('');
      }
      setValue('options', newOptions, { shouldDirty: true });
    },
  }), [getValues, setValue]);

  // Save form data with proper error handling
  const handleSave = useCallback(handleSubmit(async (data) => {
    if (!field) return;
    
    setIsSaving(true);
    try {
      // Filter out empty options
      const validOptions = data.options.filter(option => option.trim().length > 0);
      
      // Transform form data to field updates
      const updates: Record<string, any> = {
        label: data.label,
        hint: data.hint || '',
        prefix: data.prefix || '',
        defaultValue: data.defaultValue,
        options: validOptions,
      };

      // Add field-type specific properties
      if (field.type === 'select_field') {
        updates.multiple = data.multiple || false;
      }

      // Handle validation object for checkbox fields
      if (field.type === 'checkbox_field' && data.validation) {
        updates.validation = {
          ...((field as any)?.validation || {}),
          required: data.required,
          minSelections: data.validation.minSelections,
          maxSelections: data.validation.maxSelections,
        };
      } else {
        updates.validation = {
          ...((field as any)?.validation || {}),
          required: data.required,
        };
      }

      await onSave(updates);
      
      // Reset form to mark it as clean after successful save
      reset(data, { keepDefaultValues: false });
    } catch (error) {
      console.error('Failed to save selection field:', error);
      throw error; // Re-throw to allow component-level error handling
    } finally {
      setIsSaving(false);
    }
  }), [field, handleSubmit, onSave, reset]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    if (field && fieldData) {
      reset(fieldData);
    }
    onCancel?.();
  }, [field, fieldData, reset, onCancel]);

  // Reset to original values
  const handleReset = useCallback(() => {
    if (field && fieldData) {
      reset(fieldData);
    }
  }, [field, fieldData, reset]);


  return {
    form,
    isDirty,
    isSaving,
    isValid,
    errors,
    handleSave,
    handleCancel,
    handleReset,
    setValue,
    getValues,
    addOption: optionHandlers.addOption,
    updateOption: optionHandlers.updateOption,
    removeOption: optionHandlers.removeOption,
  };
}