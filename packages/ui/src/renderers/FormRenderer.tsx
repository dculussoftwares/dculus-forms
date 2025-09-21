import React, { createContext, useContext, useEffect, useMemo, useCallback, useState } from 'react';
import type { FormSchema, FormLayout } from '@dculus/types';
import { LayoutRenderer } from './LayoutRenderer';
import { RendererMode } from '@dculus/utils';
import { useFormResponseStore, useFormResponseUtils } from '../stores/useFormResponseStore';

export interface FormRendererProps {
  formSchema?: FormSchema;
  cdnEndpoint?: string;
  className?: string;
  mode: RendererMode;
  onResponseChange?: (responses: Record<string, any>) => void;
  onFormSubmit?: (formId: string, responses: Record<string, any>) => void;
  onResponseUpdate?: (responseId: string, responses: Record<string, any>) => void;
  onLayoutChange?: (updates: Partial<FormLayout>) => void;
  formId?: string;
  existingResponseData?: Record<string, any>;
  responseId?: string;
}

// Context for sharing form response state throughout the form
export interface FormResponseContextValue {
  formSchema?: FormSchema;
  mode: RendererMode;
  onFormSubmit?: (formId: string, responses: Record<string, any>) => void;
  onResponseUpdate?: (responseId: string, responses: Record<string, any>) => void;
  formId?: string;
  responseId?: string;
}

export const FormResponseContext = createContext<FormResponseContextValue | null>(null);

export const useFormResponseContext = () => {
  const context = useContext(FormResponseContext);
  if (!context) {
    throw new Error('useFormResponseContext must be used within a FormRenderer');
  }
  return context;
};

export const FormRenderer: React.FC<FormRendererProps> = ({
  formSchema,
  cdnEndpoint,
  className = '',
  mode,
  onResponseChange,
  onFormSubmit,
  onResponseUpdate,
  onLayoutChange,
  formId,
  existingResponseData,
  responseId
}) => {
  const { getFormattedResponses } = useFormResponseUtils();
  const store = useFormResponseStore();
  const [initializationKey, setInitializationKey] = useState<string>('');

  // Initialize form with existing response data when in EDIT mode
  useEffect(() => {
    // Only initialize in EDIT mode with valid data
    if (mode !== RendererMode.EDIT || !existingResponseData || Object.keys(existingResponseData).length === 0) {
      return;
    }

    // Create a unique key for this initialization to prevent re-running
    const currentKey = `${mode}-${JSON.stringify(existingResponseData)}-${formSchema?.pages?.length || 0}`;

    if (currentKey !== initializationKey) {
      console.log('Initializing form with existing data:', existingResponseData);

      // Check if store already has data to avoid re-initialization
      const existingData = store.getAllResponses();
      const hasExistingData = Object.keys(existingData).some(pageId =>
        Object.keys(existingData[pageId] || {}).length > 0
      );

      if (!hasExistingData) {
        // Use requestAnimationFrame to ensure DOM is ready and avoid render loops
        requestAnimationFrame(() => {
          // Clear existing responses first
          store.clearAllResponses();

          if (formSchema?.pages) {
            // Create a mapping of fieldId to pageId
            const fieldToPageMap: Record<string, string> = {};
            formSchema.pages.forEach((page: any) => {
              page.fields?.forEach((field: any) => {
                if (field.id) {
                  fieldToPageMap[field.id] = page.id;
                }
              });
            });

            // Build page responses object
            const pageResponses: Record<string, Record<string, any>> = {};

            Object.entries(existingResponseData).forEach(([fieldId, value]) => {
              const pageId = fieldToPageMap[fieldId] || formSchema.pages[0]?.id || 'default';
              if (!pageResponses[pageId]) {
                pageResponses[pageId] = {};
              }
              pageResponses[pageId][fieldId] = value;
            });

            // Set all page responses at once to minimize re-renders
            Object.entries(pageResponses).forEach(([pageId, responses]) => {
              store.setPageResponses(pageId, responses);
            });
          } else {
            // Fallback: put all fields in a default page
            store.setPageResponses('default', existingResponseData);
          }

          console.log('Form initialization completed');
        });
      }

      setInitializationKey(currentKey);
    }
  }, [mode, existingResponseData, formSchema, store, initializationKey]);

  // Memoize callback to prevent unnecessary re-subscriptions
  const handleResponseChange = useCallback(() => {
    if (onResponseChange) {
      onResponseChange(getFormattedResponses());
    }
  }, [onResponseChange, getFormattedResponses]);

  // Optional: Notify parent component when responses change
  useEffect(() => {
    if (onResponseChange) {
      const unsubscribe = useFormResponseStore.subscribe(handleResponseChange);
      return () => unsubscribe();
    }
  }, [onResponseChange, handleResponseChange]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: FormResponseContextValue = useMemo(() => ({
    formSchema,
    mode,
    onFormSubmit,
    onResponseUpdate,
    formId,
    responseId,
  }), [formSchema, mode, onFormSubmit, onResponseUpdate, formId, responseId]);

  return (
    <FormResponseContext.Provider value={contextValue}>
      <LayoutRenderer
        layoutCode={formSchema?.layout.code ?? 'L9'}
        layout={formSchema?.layout}
        pages={formSchema?.pages ?? []}
        className={className}
        cdnEndpoint={cdnEndpoint}
        mode={mode}
        onLayoutChange={onLayoutChange}
      />
    </FormResponseContext.Provider>
  );
};
