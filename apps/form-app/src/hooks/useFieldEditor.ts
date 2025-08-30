import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, useRef } from 'react';
import { FormField, FieldType, getFieldValidationSchema } from '@dculus/types';

interface UseFieldEditorProps {
  field: FormField | null;
  onSave: (updates: Record<string, any>) => void;
  onCancel?: () => void;
}

export function useFieldEditor({ field, onSave, onCancel }: UseFieldEditorProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Get the appropriate validation schema for the field type
  const validationSchema = field ? getFieldValidationSchema(field.type) : null;

  const form = useForm<any>({
    resolver: validationSchema ? zodResolver(validationSchema) : undefined,
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
    }
  }, [minDateValue, maxDateValue, minValue, maxValue, defaultValue, minLengthValue, maxLengthValue, field?.type, trigger]);

  // Extract field data for form initialization (memoized to prevent re-renders)
  const extractFieldData = useCallback((field: FormField): any => {
    const baseData = {
      label: ('label' in field && field.label) || '',
      hint: ('hint' in field && field.hint) || '',
      placeholder: ('placeholder' in field && field.placeholder) || '',
      defaultValue: ('defaultValue' in field && field.defaultValue) || '',
      prefix: ('prefix' in field && field.prefix) || '',
      required: (field as any).validation?.required || false,
    };

    // Add field-specific properties
    switch (field.type) {
      case FieldType.TEXT_INPUT_FIELD:
      case FieldType.TEXT_AREA_FIELD:
        return {
          ...baseData,
          validation: {
            required: (field as any).validation?.required || false,
            minLength: (field as any).validation?.minLength || undefined,
            maxLength: (field as any).validation?.maxLength || undefined,
          },
        } as any;
      
      case FieldType.NUMBER_FIELD:
        return {
          ...baseData,
          min: ('min' in field && field.min) || undefined,
          max: ('max' in field && field.max) || undefined,
        } as any;
      
      case FieldType.SELECT_FIELD:
        return {
          ...baseData,
          options: ('options' in field && field.options) || [],
          multiple: ('multiple' in field && field.multiple) || false,
        } as any;
      
      case FieldType.RADIO_FIELD:
        return {
          ...baseData,
          options: ('options' in field && field.options) || [],
        } as any;
      
      case FieldType.CHECKBOX_FIELD:
        return {
          ...baseData,
          options: ('options' in field && field.options) || [],
          multiple: ('multiple' in field && field.multiple) || true,
        } as any;
      
      case FieldType.DATE_FIELD:
        return {
          ...baseData,
          minDate: ('minDate' in field && field.minDate) || '',
          maxDate: ('maxDate' in field && field.maxDate) || '',
        } as any;
      
      default:
        return baseData as any;
    }
  }, []); // Empty dependency array since this function doesn't use any external state

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
      const formData = extractFieldData(field);
      reset(formData);
      initializedFieldRef.current = field.id;
    }
  }, [field?.id, reset, extractFieldData]);

  // Also update form when field properties change (for existing fields)
  useEffect(() => {
    if (field && field.id === initializedFieldRef.current) {
      const formData = extractFieldData(field);
      // Only reset if the field data has actually changed to prevent unnecessary resets
      const currentValues = getValues();
      const hasChanged = JSON.stringify(formData) !== JSON.stringify(currentValues);
      if (hasChanged) {
        reset(formData);
      }
    }
  }, [field, reset, extractFieldData, getValues]);

  // Save form data
  const handleSave = useCallback(handleSubmit(async (data) => {
    if (!field) return;
    
    setIsSaving(true);
    try {
      // Convert form data to field updates - exclude nested validation object first
      const { validation: _, required: __, ...cleanData } = data;
      const updates: Record<string, any> = { ...cleanData };
      
      // Handle validation object updates
      if ('required' in data || ('validation' in data && data.validation)) {
        if (field.type === FieldType.TEXT_INPUT_FIELD || field.type === FieldType.TEXT_AREA_FIELD) {
          // For text fields, handle the validation object with character limits
          const validationData = data.validation || {};
          updates.validation = {
            ...((field as any)?.validation || {}),
            required: data.required !== undefined ? data.required : validationData.required || false,
            minLength: validationData.minLength,
            maxLength: validationData.maxLength,
          };
        } else {
          // For other field types, handle only required
          updates.validation = {
            ...((field as any)?.validation || {}),
            required: data.required || false,
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
    if (field) {
      const formData = extractFieldData(field);
      reset(formData);
    }
    onCancel?.();
  }, [field, reset, onCancel, extractFieldData]);

  // Reset to original values
  const handleReset = useCallback(() => {
    if (field) {
      const formData = extractFieldData(field);
      reset(formData);
    }
  }, [field, reset, extractFieldData]);

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

  // Add option (for select/radio/checkbox fields)
  const addOption = useCallback(() => {
    const currentOptions = getValues('options' as any) || [];
    setValue('options' as any, [...currentOptions, ''], { shouldDirty: true });
  }, [getValues, setValue]);

  // Update option (for select/radio/checkbox fields)
  const updateOption = useCallback((index: number, value: string) => {
    const currentOptions = getValues('options' as any) || [];
    const newOptions = [...currentOptions];
    newOptions[index] = value;
    setValue('options' as any, newOptions, { shouldDirty: true });
  }, [getValues, setValue]);

  // Remove option (for select/radio/checkbox fields)
  const removeOption = useCallback((index: number) => {
    const currentOptions = getValues('options' as any) || [];
    const newOptions = currentOptions.filter((_: any, i: number) => i !== index);
    setValue('options' as any, newOptions, { shouldDirty: true });
  }, [getValues, setValue]);

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
    addOption,
    updateOption,
    removeOption,
    setValue,
    getValues,
  };
}
