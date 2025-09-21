import { useCallback, useMemo } from 'react';
import { FieldType, FormPage } from '@dculus/types';
import { useFormResponseStore } from '../stores/useFormResponseStore';
import { createPageDefaultValues } from '../utils/zodSchemaBuilder';

/**
 * Custom hook for handling form initialization with store data
 * Optimizes the initialization process and eliminates timing dependencies
 */
export const useFormInitialization = (page: FormPage) => {
  const store = useFormResponseStore();

  // Get default field value based on field type
  const getFieldDefaultValue = useCallback((fieldType: FieldType) => {
    switch (fieldType) {
      case FieldType.CHECKBOX_FIELD:
        return [];
      default:
        return '';
    }
  }, []);

  // Create cleaned initial values for the form
  const getInitialValues = useCallback(() => {
    const defaults = createPageDefaultValues(page);
    const storedResponses = store.getPageResponses(page.id);

    // Use stored responses if they exist, fallback to defaults
    const hasStoredData = Object.keys(storedResponses).length > 0;
    const merged = hasStoredData ? { ...defaults, ...storedResponses } : defaults;

    // Ensure no undefined values in the merged object
    const cleanedValues: Record<string, any> = {};

    page.fields.forEach(field => {
      const value = merged[field.id];
      cleanedValues[field.id] = value !== undefined
        ? value
        : getFieldDefaultValue(field.type);
    });

    return cleanedValues;
  }, [page, store, getFieldDefaultValue]);

  // Check if the form has stored data (for conditional logic)
  const hasStoredData = useMemo(() => {
    const storedResponses = store.getPageResponses(page.id);
    return Object.keys(storedResponses).length > 0;
  }, [store, page.id]);

  // Get current store values (memoized to prevent unnecessary recalculations)
  const currentStoreValues = useMemo(() => {
    return store.getPageResponses(page.id);
  }, [store, page.id]);

  return {
    getInitialValues,
    hasStoredData,
    currentStoreValues,
    store
  };
};