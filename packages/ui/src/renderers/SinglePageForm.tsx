import React, { useEffect, useImperativeHandle, useCallback, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormPage, generatePageDefaultValues, FieldType } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { FormFieldRenderer } from './FormFieldRenderer';
import { useFormResponseStore } from '../stores/useFormResponseStore';
import { createPageSchema, createPageDefaultValues, validatePageData } from '../utils/zodSchemaBuilder';
import { FormValidationState, PageValidationHook } from '../types/validation';

interface FieldStyles {
  container: string;
  label: string;
  input: string;
  textarea: string;
  select: string;
}

export interface LayoutStyles {
  field: FieldStyles;
  submitButton: string;
}

export interface SinglePageFormProps {
  page: FormPage;
  layoutStyles?: LayoutStyles;
  mode?: RendererMode;
  onSubmit: (pageId: string, data: Record<string, any>) => void;
  showSubmitButton?: boolean;
  submitButtonText?: string;
  className?: string;
  formRef?: React.RefObject<{ 
    submit: () => void;
    validate: () => Promise<boolean>;
    getValidationState: () => FormValidationState;
    showAllValidationErrors: () => Promise<void>;
  }>;
  onValidationChange?: (isValid: boolean) => void;
  enableRealtimeValidation?: boolean;
}

export const SinglePageForm: React.FC<SinglePageFormProps> = ({
  page,
  layoutStyles,
  mode = RendererMode.PREVIEW,
  onSubmit,
  showSubmitButton = false,
  submitButtonText = 'Submit',
  className = '',
  formRef,
  onValidationChange,
  enableRealtimeValidation = true,
}) => {
  const store = useFormResponseStore();

  // Create Zod schema for this page
  const validationSchema = useMemo(() => createPageSchema(page), [page]);

  // Get initial values from Zustand store, fallback to defaults
  const getInitialValues = useCallback(() => {
    const defaults = createPageDefaultValues(page);
    const storedResponses = store.getPageResponses(page.id);
    const merged = { ...defaults, ...storedResponses };
    
    // Ensure no undefined values in the merged object
    const cleanedValues: Record<string, any> = {};
    page.fields.forEach(field => {
      const value = merged[field.id];
      if (value !== undefined) {
        cleanedValues[field.id] = value;
      } else {
        // Set appropriate default based on field type
        switch (field.type) {
          case FieldType.CHECKBOX_FIELD:
            cleanedValues[field.id] = [];
            break;
          default:
            cleanedValues[field.id] = '';
        }
      }
    });
    
    return cleanedValues;
  }, [page, store]);

  const methods = useForm({
    defaultValues: getInitialValues(),
    mode: enableRealtimeValidation ? 'onChange' : 'onSubmit',
    resolver: zodResolver(validationSchema),
    criteriaMode: 'all', // Show all validation errors
  });

  const { handleSubmit, reset, control, getValues, formState, trigger, clearErrors, setFocus } = methods;
  const { isValid, errors, isSubmitting, touchedFields, isSubmitted, submitCount } = formState;

  // Reset form when page changes or stored values change
  useEffect(() => {
    const initialValues = getInitialValues();
    reset(initialValues);
  }, [page.id, reset, getInitialValues]);

  // Calculate if navigation should be allowed on first attempt
  const allowNavigationOnFirstAttempt = submitCount === 0;
  const showLenientValidation = submitCount > 0 && !isValid;

  // Notify parent of validation state changes
  useEffect(() => {
    if (onValidationChange) {
      // Always report the actual validation state
      // The parent (PageRenderer) will handle button enabling/disabling
      onValidationChange(isValid);
    }
  }, [isValid, onValidationChange]);

  // Form submission handler
  const onFormSubmit = useCallback(async (data: Record<string, any>) => {
    try {
      // Validate the data using our schema
      const validationResult = validatePageData(page, data);
      
      if (validationResult.isValid) {
        // Save to store and trigger callback
        store.setPageResponses(page.id, data);
        onSubmit(page.id, data);
      } else {
        console.error('Form validation failed:', validationResult.errors);
      }
    } catch (error: unknown) {
      console.error('Form submission error:', error);
    }
  }, [page, store, onSubmit]);

  // Validation helper functions
  const validatePage = useCallback(async (): Promise<boolean> => {
    const result = await trigger();
    return result;
  }, [trigger]);

  const getValidationState = useCallback((): FormValidationState => {
    return {
      isValid,
      isSubmitting,
      isSubmitted,
      submitCount,
      errors,
      touchedFields,
      allowNavigationOnFirstAttempt,
    };
  }, [isValid, isSubmitting, isSubmitted, submitCount, errors, touchedFields, allowNavigationOnFirstAttempt]);

  // Force show all validation errors (for navigation attempts)
  const showAllValidationErrors = useCallback(async () => {
    // Trigger validation for all fields first
    await trigger();
    
    // Focus each field briefly to mark it as touched and show errors
    for (const field of page.fields) {
      try {
        setFocus(field.id);
        // Small delay to ensure the field is properly focused and touched
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        // Continue if field doesn't exist or can't be focused
        console.warn(`Could not focus field ${field.id}:`, error);
      }
    }
    
    // Final validation trigger to ensure all errors are displayed
    await trigger();
  }, [trigger, page.fields, setFocus]);

  // Expose methods to parent via ref
  useImperativeHandle(formRef, () => ({
    submit: () => {
      // Get current form values and submit them
      const currentData = getValues();
      onFormSubmit(currentData);
    },
    validate: validatePage,
    getValidationState,
    showAllValidationErrors,
  }), [getValues, onFormSubmit, validatePage, getValidationState, showAllValidationErrors]);

  const defaultLayoutStyles: LayoutStyles = {
    field: {
      container: 'mb-4',
      label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
      input: 'w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-gray-500',
      textarea: 'w-full h-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-500',
      select: 'w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-gray-500',
    },
    submitButton: 'w-full h-10 bg-blue-600 text-white rounded-md flex items-center justify-center hover:bg-blue-700 transition-colors',
  };

  const styles = layoutStyles || defaultLayoutStyles;

  if (!page.fields || page.fields.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500 text-sm">
          No fields in this page yet.
        </p>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onFormSubmit)} className={`space-y-4 ${className}`}>
        {/* Page Title */}
        {page.title && (
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {page.title}
          </h3>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          {page.fields.map((field) => (
            <FormFieldRenderer
              key={field.id}
              field={field}
              control={control}
              fieldStyles={styles.field}
              mode={mode}
            />
          ))}
        </div>

        {/* Submit Button (optional) */}
        {showSubmitButton && (
          <div className="space-y-2">
            {/* Show validation errors summary if form is invalid */}
            {!isValid && Object.keys(errors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600 font-medium mb-2">
                  Please fix the following errors:
                </p>
                <ul className="text-sm text-red-600 space-y-1">
                  {Object.entries(errors).map(([fieldId, error]) => {
                    const message = error && typeof error === 'object' && 'message' in error 
                      ? error.message as string 
                      : 'Unknown error';
                    return (
                      <li key={fieldId}>• {message}</li>
                    );
                  })}
                </ul>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${styles.submitButton} ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              } ${!isValid ? 'bg-red-500 hover:bg-red-600' : ''}`}
            >
              {isSubmitting ? 'Submitting...' : submitButtonText}
            </button>
          </div>
        )}
      </form>
    </FormProvider>
  );
};

// Hook to access form methods from outside the component
export const useSinglePageForm = (page: FormPage) => {
  const store = useFormResponseStore();
  
  return {
    submitPage: (formRef: React.RefObject<HTMLFormElement>) => {
      // Trigger form submission programmatically
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    },
    getPageData: () => {
      return store.getPageResponses(page.id);
    },
    hasPageData: () => {
      const responses = store.getPageResponses(page.id);
      return Object.keys(responses).length > 0;
    },
  };
};