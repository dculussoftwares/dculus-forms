import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { RichTextFormField } from '@dculus/types';
import { z } from 'zod';

// Type for rich text field form data
interface RichTextFieldFormData {
  content: string;
}

// Props interface for the hook
export interface UseRichTextFieldFormProps {
  field: RichTextFormField | null;
  onSave: (updates: Record<string, any>) => void;
  onCancel?: () => void;
}

// Return type for the hook
export interface UseRichTextFieldFormReturn {
  form: ReturnType<typeof useForm<RichTextFieldFormData>>;
  isDirty: boolean;
  isSaving: boolean;
  isValid: boolean;
  errors: any;
  handleSave: () => void;
  handleCancel: () => void;
  handleReset: () => void;
  setValue: ReturnType<typeof useForm<RichTextFieldFormData>>['setValue'];
  getValues: ReturnType<typeof useForm<RichTextFieldFormData>>['getValues'];
  // Rich text specific loading state
  isContentLoading: boolean;
  setIsContentLoading: (loading: boolean) => void;
}

// Validation schema for rich text fields
const richTextFieldValidationSchema = z.object({
  content: z.string(),
});

// Helper function to sanitize HTML content
const sanitizeHtmlContent = (content: string): string => {
  if (!content) return '';
  
  // Basic HTML sanitization - remove script tags and dangerous attributes
  let sanitized = content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
    
  return sanitized.trim();
};

// Helper function to extract data from rich text field
const extractRichTextFieldData = (field: RichTextFormField): RichTextFieldFormData => {
  const content = field.content || '';
  return {
    content: content || '<p></p>',
  };
};

/**
 * Custom hook for managing rich text field form state with enhanced stability
 * Handles RICH_TEXT_FIELD type with content synchronization and loading states
 */
export function useRichTextFieldForm({ field, onSave, onCancel }: UseRichTextFieldFormProps): UseRichTextFieldFormReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(false);

  // Memoized validation schema to prevent unnecessary re-renders
  const validationSchema = useMemo(() => richTextFieldValidationSchema, []);

  // Create form with stable default values
  const form = useForm<RichTextFieldFormData>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
    defaultValues: {
      content: '<p></p>', // Always start with empty, will be reset with actual content
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

  // Watch content for real-time validation
  const content = watch('content');

  // Re-trigger validation when content changes (with debounce)
  const validationTimeoutRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    // Clear existing timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    
    // Debounce validation to avoid excessive triggering while typing
    validationTimeoutRef.current = setTimeout(() => {
      trigger(['content']);
    }, 300);
  }, [content, trigger]);

  // Memoized field data extraction to prevent unnecessary re-computation
  const fieldData = useMemo(() => {
    return field ? extractRichTextFieldData(field) : null;
  }, [field?.id, field?.type, field?.content]); // Include content in dependencies for rich text

  // Track which field we've initialized to prevent unnecessary resets
  const initializedFieldRef = useRef<string | null>(null);

  // Update form when field changes
  useEffect(() => {
    if (field && fieldData) {
      // Reset for new field or if content has changed
      if (field.id !== initializedFieldRef.current) {
        setIsContentLoading(true);
        
        // Reset immediately without delay to prevent empty state
        reset(fieldData);
        setIsContentLoading(false);
        initializedFieldRef.current = field.id;
      }
    } else if (!field) {
      // Clear initialized field ref when no field is selected
      initializedFieldRef.current = null;
    }
  }, [field?.id, field?.content, reset, fieldData]);


  // Save form data with proper error handling and content sanitization
  const handleSave = useCallback(handleSubmit(async (data) => {
    if (!field) return;
    
    setIsSaving(true);
    try {
      // Transform form data to field updates with sanitization
      const updates: Record<string, any> = {
        content: sanitizeHtmlContent(data.content),
      };

      await onSave(updates);
      
      // Reset form to mark it as clean after successful save
      reset(data, { keepDefaultValues: false });
    } catch (error) {
      console.error('Failed to save rich text field:', error);
      throw error; // Re-throw to allow component-level error handling
    } finally {
      setIsSaving(false);
    }
  }), [field, handleSubmit, onSave, reset]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    if (field && fieldData) {
      setIsContentLoading(true);
      setTimeout(() => {
        reset(fieldData);
        setIsContentLoading(false);
      }, 100);
    }
    onCancel?.();
  }, [field, fieldData, reset, onCancel]);

  // Reset to original values
  const handleReset = useCallback(() => {
    if (field && fieldData) {
      setIsContentLoading(true);
      setTimeout(() => {
        reset(fieldData);
        setIsContentLoading(false);
      }, 100);
    }
  }, [field, fieldData, reset]);

  // Enhanced setValue for rich text with content synchronization
  const setValueWithSync = useCallback((name: keyof RichTextFieldFormData, value: any, options?: any) => {
    if (name === 'content') {
      // Sanitize content before setting
      const sanitizedValue = sanitizeHtmlContent(value);
      setValue(name, sanitizedValue, options);
    } else {
      setValue(name as any, value, options);
    }
  }, [setValue]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
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
    setValue: setValueWithSync,
    getValues,
    isContentLoading,
    setIsContentLoading,
  };
}