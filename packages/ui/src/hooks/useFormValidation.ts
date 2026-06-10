import { useCallback, useMemo, useEffect } from 'react';
import { FormState, UseFormReturn } from 'react-hook-form';
import { FieldValues } from 'react-hook-form';
import { FormPage } from '@dculus/types';
import { FormValidationState } from '../types/validation';

/**
 * Custom hook for centralized form validation logic
 * Handles validation state, error management, and validation triggers
 */
export const useFormValidation = (
  methods: UseFormReturn<FieldValues>,
  page: FormPage,
  onValidationChange?: (isValid: boolean) => void
) => {
  const { formState, trigger, setFocus } = methods;
  const { isValid, errors, isSubmitting, touchedFields, isSubmitted, submitCount } = formState;

  // Calculate validation-related states
  const validationStates = useMemo(() => ({
    allowNavigationOnFirstAttempt: submitCount === 0,
    showLenientValidation: submitCount > 0 && !isValid,
    hasErrors: Object.keys(errors).length > 0,
    errorCount: Object.keys(errors).length
  }), [submitCount, isValid, errors]);

  // Notify parent of validation state changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [isValid, onValidationChange]);

  // Validate the entire page
  const validatePage = useCallback(async (): Promise<boolean> => {
    return await trigger();
  }, [trigger]);

  // Get complete validation state object
  const getValidationState = useCallback((): FormValidationState => {
    return {
      isValid,
      isSubmitting,
      isSubmitted,
      submitCount,
      errors,
      touchedFields,
      allowNavigationOnFirstAttempt: validationStates.allowNavigationOnFirstAttempt,
    };
  }, [isValid, isSubmitting, isSubmitted, submitCount, errors, touchedFields, validationStates]);

  // Show all validation errors by focusing each field
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

  // Format error messages for display
  const getFormattedErrors = useCallback(() => {
    return Object.entries(errors).map(([fieldId, error]) => {
      const message = error && typeof error === 'object' && 'message' in error
        ? error.message as string
        : 'Unknown error';
      return { fieldId, message };
    });
  }, [errors]);

  return {
    // Validation states
    isValid,
    errors,
    isSubmitting,
    validationStates,

    // Helper functions
    validatePage,
    getValidationState,
    showAllValidationErrors,
    getFormattedErrors
  };
};