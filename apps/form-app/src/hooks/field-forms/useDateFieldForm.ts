import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { DateField } from '@dculus/types';
import { z } from 'zod';

// Type for date field form data
interface DateFieldFormData {
  label: string;
  hint?: string;
  placeholder?: string;
  prefix?: string;
  defaultValue?: string; // ISO date string
  required: boolean;
  minDate?: string; // ISO date string
  maxDate?: string; // ISO date string
}

// Props interface for the hook
export interface UseDateFieldFormProps {
  field: DateField | null;
  onSave: (updates: Record<string, any>) => void;
  onCancel?: () => void;
}

// Return type for the hook
export interface UseDateFieldFormReturn {
  form: ReturnType<typeof useForm<DateFieldFormData>>;
  isDirty: boolean;
  isSaving: boolean;
  isValid: boolean;
  errors: any;
  handleSave: () => void;
  handleCancel: () => void;
  handleReset: () => void;
  handleAutoSave: () => void;
  setValue: ReturnType<typeof useForm<DateFieldFormData>>['setValue'];
  getValues: ReturnType<typeof useForm<DateFieldFormData>>['getValues'];
}

// Helper function to safely parse date values
const parseDateValue = (value: any): string | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  
  // If it's already a valid ISO string, return it
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  
  // Try to parse as Date and convert to ISO string
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch {
    return undefined;
  }
};

// Helper function to compare dates (returns true if first date is before or equal to second)
const isDateBeforeOrEqual = (date1: string | undefined, date2: string | undefined): boolean => {
  if (!date1 || !date2) return true;
  return new Date(date1) <= new Date(date2);
};

// Validation schema for date fields
const dateFieldValidationSchema = z.object({
  label: z.string().min(1, 'Field label is required'),
  hint: z.string().optional(),
  placeholder: z.string().optional(),
  prefix: z.string().optional(),
  defaultValue: z.string().optional().refine(
    (value) => {
      if (!value) return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
    },
    { message: 'Invalid date format. Use YYYY-MM-DD format.' }
  ),
  required: z.boolean().default(false),
  minDate: z.string().optional().refine(
    (value) => {
      if (!value) return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
    },
    { message: 'Invalid minimum date format. Use YYYY-MM-DD format.' }
  ),
  maxDate: z.string().optional().refine(
    (value) => {
      if (!value) return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
    },
    { message: 'Invalid maximum date format. Use YYYY-MM-DD format.' }
  ),
}).refine(
  (data) => {
    // Cross-field validation: minDate should be before or equal to maxDate
    return isDateBeforeOrEqual(data.minDate, data.maxDate);
  },
  {
    message: 'Minimum date must be before or equal to maximum date',
    path: ['maxDate'],
  }
).refine(
  (data) => {
    // Cross-field validation: default value should be within min/max date range
    if (!data.defaultValue) return true;
    
    const defaultDate = new Date(data.defaultValue);
    
    if (data.minDate && defaultDate < new Date(data.minDate)) {
      return false;
    }
    if (data.maxDate && defaultDate > new Date(data.maxDate)) {
      return false;
    }
    return true;
  },
  {
    message: 'Default value must be within the specified date range',
    path: ['defaultValue'],
  }
);

// Helper function to extract data from date field
const extractDateFieldData = (field: DateField): DateFieldFormData => {
  const validation = (field as any).validation || {};
  
  return {
    label: field.label || '',
    hint: field.hint || '',
    placeholder: field.placeholder || '',
    prefix: field.prefix || '',
    defaultValue: parseDateValue(field.defaultValue),
    required: validation.required || false,
    minDate: parseDateValue(field.minDate),
    maxDate: parseDateValue(field.maxDate),
  };
};

/**
 * Custom hook for managing date field form state with enhanced stability
 * Handles DATE_FIELD type with proper date validation and parsing
 */
export function useDateFieldForm({ field, onSave, onCancel }: UseDateFieldFormProps): UseDateFieldFormReturn {
  const [isSaving, setIsSaving] = useState(false);

  // Memoized validation schema to prevent unnecessary re-renders
  const validationSchema = useMemo(() => dateFieldValidationSchema, []);

  const form = useForm<DateFieldFormData>({
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
  const minDateValue = watch('minDate');
  const maxDateValue = watch('maxDate');
  const defaultValue = watch('defaultValue');

  // Re-trigger validation when related fields change
  useEffect(() => {
    trigger(['minDate', 'maxDate', 'defaultValue']);
  }, [minDateValue, maxDateValue, defaultValue, trigger]);

  // Memoized field data extraction to prevent unnecessary re-computation
  const fieldData = useMemo(() => {
    return field ? extractDateFieldData(field) : null;
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

  // Save form data with proper error handling and date conversion
  const handleSave = useCallback(handleSubmit(async (data) => {
    if (!field) return;
    
    setIsSaving(true);
    try {
      // Transform form data to field updates with proper date handling
      const updates: Record<string, any> = {
        label: data.label,
        hint: data.hint || '',
        placeholder: data.placeholder || '',
        prefix: data.prefix || '',
        defaultValue: data.defaultValue,
        minDate: data.minDate,
        maxDate: data.maxDate,
        validation: {
          ...((field as any)?.validation || {}),
          required: data.required,
        },
      };

      await onSave(updates);
      
      // Reset form to mark it as clean after successful save
      reset(data, { keepDefaultValues: false });
    } catch (error) {
      console.error('Failed to save date field:', error);
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