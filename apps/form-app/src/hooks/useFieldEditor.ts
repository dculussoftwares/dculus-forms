import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FieldType, getFieldValidationSchema, FieldFormData } from '@dculus/types';
import { UseFieldEditorProps, UseFieldEditorReturn } from './types';
import { extractFieldData } from './fieldDataExtractor';

/**
 * Custom hook for managing field editor form state and operations
 * Provides type-safe form handling with validation and auto-save functionality
 */
export function useFieldEditor({ field, onSave, onCancel }: UseFieldEditorProps): UseFieldEditorReturn {
  const [isSaving, setIsSaving] = useState(false);

  // Memoize validation schema to prevent unnecessary re-renders
  const validationSchema = useMemo(() => {
    return field ? getFieldValidationSchema(field.type) : null;
  }, [field?.type]);

  const form = useForm<FieldFormData>({
    resolver: validationSchema ? zodResolver(validationSchema as any) : undefined,
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

  // Watch all form values to detect changes (with stable reference)
  watch();
  

  // Watch specific fields for cross-field validation re-triggering
  const minDateValue = watch('minDate');
  const maxDateValue = watch('maxDate');
  const minValue = watch('min');
  const maxValue = watch('max');
  const defaultValue = watch('defaultValue');
  const minLengthValue = watch('validation.minLength');
  const maxLengthValue = watch('validation.maxLength');
  const minSelectionsValue = watch('validation.minSelections');
  const maxSelectionsValue = watch('validation.maxSelections');

  // Re-trigger validation when related fields change (for cross-field validation)
  useEffect(() => {
    if (field?.type === FieldType.DATE_FIELD) {
      // Trigger validation for all date-related fields when any of them change
      trigger(['minDate', 'maxDate', 'defaultValue']);
    } else if (field?.type === FieldType.NUMBER_FIELD) {
      // Trigger validation for all number-related fields when any of them change
      trigger(['min', 'max', 'defaultValue']);
    } else if (field?.type === FieldType.TEXT_INPUT_FIELD || field?.type === FieldType.TEXT_AREA_FIELD) {
      // Trigger validation for character limit fields when any of them change
      trigger(['validation.minLength', 'validation.maxLength', 'defaultValue']);
    } else if (field?.type === FieldType.CHECKBOX_FIELD) {
      // Trigger validation for selection limit fields when any of them change
      trigger(['validation.minSelections', 'validation.maxSelections', 'defaultValue', 'options']);
    }
  }, [minDateValue, maxDateValue, minValue, maxValue, defaultValue, minLengthValue, maxLengthValue, minSelectionsValue, maxSelectionsValue, field?.type, trigger]);

  // Memoized field data extraction to prevent unnecessary re-computation
  const fieldData = useMemo(() => {
    return field ? extractFieldData(field) : {};
  }, [field?.id, field?.type, 'content' in (field || {}) ? (field as any)?.content : null]); // Re-compute when field ID, type, or Rich Text content changes

  // Track which field we've initialized to prevent unnecessary resets
  const initializedFieldRef = useRef<string | null>(null);
  
  // Memoize the initial data extraction to prevent unnecessary re-renders
  // const initialData = useMemo(() => {
  //   if (!field) return {};
  //   return extractFieldData(field);
  // }, [field?.id, extractFieldData]);

  // Update form when field changes
  useEffect(() => {
    if (field && field.id !== initializedFieldRef.current) {
      
      // Reset the form with field data
      reset(fieldData);
      
      
      initializedFieldRef.current = field.id;
    }
  }, [field?.id, reset, fieldData]);

  // Save form data
  const handleSave = useCallback(handleSubmit(async (data) => {
    if (!field) return;
    
    
    setIsSaving(true);
    try {
      // Convert form data to field updates - exclude nested validation object first
      const anyData = data as any;
      const { validation: _, required: __, ...cleanData } = anyData;
      const updates: Record<string, any> = { ...cleanData };
      
      // Handle validation object updates
      if ('required' in anyData || ('validation' in anyData && anyData.validation)) {
        if (field.type === FieldType.TEXT_INPUT_FIELD || field.type === FieldType.TEXT_AREA_FIELD) {
          // For text fields, handle the validation object with character limits
          const validationData = anyData.validation || {};
          updates.validation = {
            ...((field as any)?.validation || {}),
            required: anyData.required !== undefined ? anyData.required : validationData.required || false,
            minLength: validationData.minLength,
            maxLength: validationData.maxLength,
          };
        } else if (field.type === FieldType.CHECKBOX_FIELD) {
          // For checkbox fields, handle the validation object with selection limits
          const validationData = anyData.validation || {};
          updates.validation = {
            ...((field as any)?.validation || {}),
            required: anyData.required !== undefined ? anyData.required : validationData.required || false,
            minSelections: validationData.minSelections,
            maxSelections: validationData.maxSelections,
          };
        } else {
          // For other field types, handle only required
          updates.validation = {
            ...((field as any)?.validation || {}),
            required: anyData.required || false,
          };
        }
      }

      onSave(updates);
      // Reset form to mark it as clean (not dirty) after successful save
      reset(data, { keepDefaultValues: false });
    } catch (error) {
      console.error('Failed to save field:', error);
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

  // Auto-save if valid and dirty (with debounce to prevent loops)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const handleAutoSave = useCallback(() => {
    if (!isDirty || !isValid || !field || isSaving) return;
    
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Execute save immediately for auto-save (no debounce needed for auto-save)
    handleSave();
  }, [isDirty, isValid, field, isSaving, handleSave]);

  // Memoized option management functions for better performance
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
      setValue('options', newOptions, { shouldDirty: true });
    },
  }), [getValues, setValue]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

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
    addOption: optionHandlers.addOption,
    updateOption: optionHandlers.updateOption,
    removeOption: optionHandlers.removeOption,
    setValue,
    getValues,
  };
}
