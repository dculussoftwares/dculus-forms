import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FieldType, FormField, TextInputField, TextAreaField, EmailField } from '@dculus/types';
import { z } from 'zod';

// Type for text field form data
interface TextFieldFormData {
  label: string;
  hint?: string;
  placeholder?: string;
  prefix?: string;
  defaultValue?: string;
  required: boolean;
  validation: {
    minLength?: number;
    maxLength?: number;
  };
}

// Props interface for the hook
export interface UseTextFieldFormProps {
  field: TextInputField | TextAreaField | EmailField | null;
  onSave: (updates: Record<string, any>) => void;
  onCancel?: () => void;
}

// Return type for the hook
export interface UseTextFieldFormReturn {
  form: ReturnType<typeof useForm<TextFieldFormData>>;
  isDirty: boolean;
  isSaving: boolean;
  isValid: boolean;
  errors: any;
  handleSave: () => void;
  handleCancel: () => void;
  handleReset: () => void;
  handleAutoSave: () => void;
  setValue: ReturnType<typeof useForm<TextFieldFormData>>['setValue'];
  getValues: ReturnType<typeof useForm<TextFieldFormData>>['getValues'];
}

// Validation schema for text fields
const textFieldValidationSchema = z.object({
  label: z.string().min(1, 'Field label is required'),
  hint: z.string().optional(),
  placeholder: z.string().optional(),
  prefix: z.string().optional(),
  defaultValue: z.string().optional(),
  required: z.boolean().default(false),
  validation: z.object({
    minLength: z.number().min(0, 'Minimum length must be 0 or greater').optional(),
    maxLength: z.number().min(1, 'Maximum length must be 1 or greater').optional(),
  }).optional().refine(
    (validation) => {
      if (!validation) return true;
      const { minLength, maxLength } = validation;
      if (minLength !== undefined && maxLength !== undefined) {
        return minLength <= maxLength;
      }
      return true;
    },
    {
      message: 'Minimum length must be less than or equal to maximum length',
      path: ['maxLength'],
    }
  ),
}).refine(
  (data) => {
    // Cross-field validation: default value should respect length constraints
    if (!data.defaultValue || !data.validation) return true;
    
    const { minLength, maxLength } = data.validation;
    const defaultLength = data.defaultValue.length;
    
    if (minLength !== undefined && defaultLength < minLength) {
      return false;
    }
    if (maxLength !== undefined && defaultLength > maxLength) {
      return false;
    }
    return true;
  },
  {
    message: 'Default value must respect character length constraints',
    path: ['defaultValue'],
  }
);

// Helper function to extract data from text field
const extractTextFieldData = (field: TextInputField | TextAreaField | EmailField): TextFieldFormData => {
  const validation = (field as any).validation || {};
  
  return {
    label: field.label || '',
    hint: field.hint || '',
    placeholder: field.placeholder || '',
    prefix: field.prefix || '',
    defaultValue: field.defaultValue || '',
    required: validation.required || false,
    validation: {
      minLength: validation.minLength,
      maxLength: validation.maxLength,
    },
  };
};

/**
 * Custom hook for managing text field form state with enhanced stability
 * Handles TEXT_INPUT_FIELD, TEXT_AREA_FIELD, and EMAIL_FIELD types
 */
export function useTextFieldForm({ field, onSave, onCancel }: UseTextFieldFormProps): UseTextFieldFormReturn {
  const [isSaving, setIsSaving] = useState(false);

  // Memoized validation schema to prevent unnecessary re-renders
  const validationSchema = useMemo(() => textFieldValidationSchema, []);

  const form = useForm<TextFieldFormData>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
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
  const minLengthValue = watch('validation.minLength');
  const maxLengthValue = watch('validation.maxLength');
  const defaultValue = watch('defaultValue');

  // Re-trigger validation when related fields change
  useEffect(() => {
    trigger(['validation.minLength', 'validation.maxLength', 'defaultValue']);
  }, [minLengthValue, maxLengthValue, defaultValue, trigger]);

  // Memoized field data extraction to prevent unnecessary re-computation
  const fieldData = useMemo(() => {
    return field ? extractTextFieldData(field) : null;
  }, [field?.id, field?.type]);

  // Track which field we've initialized to prevent unnecessary resets
  const initializedFieldRef = useRef<string | null>(null);

  // Update form when field changes
  useEffect(() => {
    if (field && fieldData && field.id !== initializedFieldRef.current) {
      reset(fieldData);
      initializedFieldRef.current = field.id;
    }
  }, [field?.id, reset, fieldData]);

  // Placeholder for auto-save (disabled)
  const handleAutoSave = useCallback(() => {
    // Auto-save disabled
  }, []);

  // Save form data with proper error handling
  const handleSave = useCallback(handleSubmit(async (data) => {
    if (!field) return;
    
    setIsSaving(true);
    try {
      // Transform form data to field updates
      const updates: Record<string, any> = {
        label: data.label,
        hint: data.hint || '',
        placeholder: data.placeholder || '',
        prefix: data.prefix || '',
        defaultValue: data.defaultValue || '',
        validation: {
          ...((field as any)?.validation || {}),
          required: data.required,
          minLength: data.validation?.minLength,
          maxLength: data.validation?.maxLength,
        },
      };

      await onSave(updates);
      
      // Reset form to mark it as clean after successful save
      reset(data, { keepDefaultValues: false });
    } catch (error) {
      console.error('Failed to save text field:', error);
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
    handleAutoSave,
    setValue,
    getValues,
  };
}