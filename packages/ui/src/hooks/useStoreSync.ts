import { useEffect, useRef, useCallback } from 'react';
import { Control, useWatch } from 'react-hook-form';
import { FieldValues } from 'react-hook-form';

/**
 * Optimized hook for synchronizing form values with store
 * Uses shallow comparison instead of JSON.stringify for better performance
 */
export const useStoreSync = (
  control: Control<FieldValues>,
  pageId: string,
  store: any,
  onExternalChange?: (values: Record<string, any>) => void
) => {
  const watchedValues = useWatch({ control });
  const previousWatchedValues = useRef<Record<string, any>>({});
  const previousStoreValues = useRef<Record<string, any>>({});

  // Shallow comparison utility for better performance than JSON.stringify
  const shallowEqual = useCallback((obj1: Record<string, any>, obj2: Record<string, any>) => {
    if (!obj1 || !obj2) return obj1 === obj2;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => obj1[key] === obj2[key]);
  }, []);

  // Update store when form values change (user input)
  useEffect(() => {
    if (!watchedValues || Object.keys(watchedValues).length === 0) return;

    const hasChanged = !shallowEqual(watchedValues, previousWatchedValues.current);

    if (hasChanged) {
      // Additional check against current store to prevent loops
      const currentStoreValues = store.getPageResponses(pageId);
      const isDifferentFromStore = !shallowEqual(watchedValues, currentStoreValues);

      if (isDifferentFromStore) {
        store.setPageResponses(pageId, watchedValues);
      }

      previousWatchedValues.current = { ...watchedValues };
    }
  }, [watchedValues, store, pageId, shallowEqual]);

  // Handle external store changes (from other sources like FormRenderer)
  useEffect(() => {
    const currentStoreValues = store.getPageResponses(pageId);
    const hasExternalChange = !shallowEqual(currentStoreValues, previousStoreValues.current);

    if (hasExternalChange && Object.keys(currentStoreValues).length > 0) {
      // Only trigger callback if this is truly an external change (not from form input)
      const isDifferentFromForm = !shallowEqual(currentStoreValues, watchedValues);

      if (isDifferentFromForm && onExternalChange) {
        onExternalChange(currentStoreValues);
      }

      previousStoreValues.current = { ...currentStoreValues };
    }
  }, [store.getPageResponses(pageId), watchedValues, onExternalChange, pageId, shallowEqual]);

  // Initialize refs on first render
  useEffect(() => {
    previousWatchedValues.current = watchedValues || {};
    previousStoreValues.current = store.getPageResponses(pageId);
  }, []); // Only run once

  return {
    shallowEqual
  };
};