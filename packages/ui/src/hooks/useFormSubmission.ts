import { useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FieldValues } from 'react-hook-form';
import { FormPage } from '@dculus/types';
import { validatePageData } from '../utils/zodSchemaBuilder';

/**
 * Custom hook for handling form submission logic
 * Centralizes validation, store updates, and error handling
 */
export const useFormSubmission = (
  methods: UseFormReturn<FieldValues>,
  page: FormPage,
  store: any,
  onSubmit: (pageId: string, data: Record<string, any>) => void
) => {
  const { getValues } = methods;

  // Handle form submission with validation
  const handleSubmit = useCallback(async (data: Record<string, any>) => {
    try {
      // Validate the data using our schema
      const validationResult = validatePageData(page, data);

      if (validationResult.isValid) {
        // Save to store and trigger callback
        store.setPageResponses(page.id, data);
        onSubmit(page.id, data);
        return { success: true };
      } else {
        console.error('Form validation failed:', validationResult.errors);
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validationResult.errors
        };
      }
    } catch (error: unknown) {
      console.error('Form submission error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown submission error'
      };
    }
  }, [page, store, onSubmit]);

  // Submit current form values programmatically
  const submitCurrentValues = useCallback(() => {
    const currentData = getValues();
    return handleSubmit(currentData);
  }, [getValues, handleSubmit]);

  // Check if form is ready for submission
  const isReadyForSubmission = useCallback((isValid: boolean, hasRequiredData: boolean = true) => {
    return isValid && hasRequiredData;
  }, []);

  return {
    handleSubmit,
    submitCurrentValues,
    isReadyForSubmission
  };
};