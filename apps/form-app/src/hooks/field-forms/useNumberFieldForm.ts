import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { NumberField } from '@dculus/types';
import { z } from 'zod';

// Type for number field form data
interface NumberFieldFormData {
  label: string;
  hint?: string;
  placeholder?: string;
  prefix?: string;
  defaultValue?: number;
  required: boolean;
  min?: number;
  max?: number;
}

// Props interface for the hook
export interface UseNumberFieldFormProps {
  field: NumberField | null;
  onSave: (updates: Record<string, any>) => void;
  onCancel?: () => void;
}

// Return type for the hook
export interface UseNumberFieldFormReturn {
  form: ReturnType<typeof useForm<NumberFieldFormData>>;
  isDirty: boolean;
  isSaving: boolean;
  isValid: boolean;
  errors: any;
  handleSave: () => void;
  handleCancel: () => void;
  handleReset: () => void;
  setValue: ReturnType<typeof useForm<NumberFieldFormData>>['setValue'];
  getValues: ReturnType<typeof useForm<NumberFieldFormData>>['getValues'];
}

// Validation schema for number fields
const numberFieldValidationSchema = z.object({
  label: z.string().min(1, 'Field label is required'),
  hint: z.string().optional(),
  placeholder: z.string().optional(),
  prefix: z.string().optional(),
  defaultValue: z.number().optional(),
  required: z.boolean().default(false),
  min: z.number().optional(),
  max: z.number().optional(),
}).refine(
  (data) => {
    // Cross-field validation: min should be less than or equal to max
    if (data.min !== undefined && data.max !== undefined) {
      return data.min <= data.max;
    }
    return true;
  },
  {
    message: 'Minimum value must be less than or equal to maximum value',
    path: ['max'],
  }
).refine(
  (data) => {
    // Cross-field validation: default value should be within min/max range
    if (data.defaultValue === undefined) return true;
    
    if (data.min !== undefined && data.defaultValue < data.min) {
      return false;
    }
    if (data.max !== undefined && data.defaultValue > data.max) {
      return false;
    }
    return true;
  },
  {
    message: 'Default value must be within the specified range',
    path: ['defaultValue'],
  }
);

// Helper function to safely parse number values
const parseNumberValue = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return isNaN(parsed) ? undefined : parsed;
};

// Helper function to extract data from number field
const extractNumberFieldData = (field: NumberField): NumberFieldFormData => {
  const validation = (field as any).validation || {};
  
  return {
    label: field.label || '',
    hint: field.hint || '',
    placeholder: field.placeholder || '',
    prefix: field.prefix || '',
    defaultValue: parseNumberValue(field.defaultValue),
    required: validation.required || false,
    min: parseNumberValue(field.min),
    max: parseNumberValue(field.max),
  };
};

/**
 * Custom hook for managing number field form state with enhanced stability
 * Handles NUMBER_FIELD type with proper number validation and parsing
 */
export function useNumberFieldForm({ field, onSave, onCancel }: UseNumberFieldFormProps): UseNumberFieldFormReturn {
  const [isSaving, setIsSaving] = useState(false);

  // Memoized validation schema to prevent unnecessary re-renders
  const validationSchema = useMemo(() => numberFieldValidationSchema, []);

  const form = useForm<NumberFieldFormData>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
    defaultValues: {
      label: 'Field Label',
      hint: '',
      placeholder: '',
      prefix: '',
      defaultValue: undefined,
      required: false,
      min: undefined,
      max: undefined,
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
  const minValue = watch('min');
  const maxValue = watch('max');
  const defaultValue = watch('defaultValue');

  // Re-trigger validation when related fields change
  useEffect(() => {
    trigger(['min', 'max', 'defaultValue']);
  }, [minValue, maxValue, defaultValue, trigger]);

  // Memoized field data extraction to prevent unnecessary re-computation
  const fieldData = useMemo(() => {
    return field ? extractNumberFieldData(field) : null;
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

  // Save form data with proper error handling and number conversion
  const handleSave = useCallback(handleSubmit(async (data) => {
    if (!field) return;
    
    setIsSaving(true);
    try {
      // Transform form data to field updates with proper number handling
      const updates: Record<string, any> = {
        label: data.label,
        hint: data.hint || '',
        placeholder: data.placeholder || '',
        prefix: data.prefix || '',
        defaultValue: data.defaultValue,
        min: data.min,
        max: data.max,
        validation: {
          ...((field as any)?.validation || {}),
          required: data.required,
        },
      };

      await onSave(updates);
      
      // Reset form to mark it as clean after successful save
      reset(data, { keepDefaultValues: false });
    } catch (error) {
      console.error('Failed to save number field:', error);
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
  };
}