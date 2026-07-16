import React, { createContext, useContext, useEffect, useMemo, useCallback, useState } from 'react';
import type { FormSchema, FormLayout } from '@dculus/types';
import { LayoutRenderer } from './LayoutRenderer';
import { RendererMode } from '@dculus/utils';
import { useFormResponseStore, useFormResponseUtils } from '../stores/useFormResponseStore';
import { useConditionalVisibility } from '../hooks/useConditionalVisibility';

export interface ResponseCopySettings {
  enabled: boolean;
  mode: 'always' | 'respondentChoice';
}

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
  /** "Send me a copy of my responses" — only relevant to the public form-viewer. */
  responseCopySettings?: ResponseCopySettings;
  onResponseCopyConsentChange?: (consent: boolean) => void;
}

// Context for sharing form response state throughout the form
export interface FormResponseContextValue {
  formSchema?: FormSchema;
  mode: RendererMode;
  onFormSubmit?: (formId: string, responses: Record<string, any>) => void;
  onResponseUpdate?: (responseId: string, responses: Record<string, any>) => void;
  formId?: string;
  responseId?: string;
  responseCopySettings?: ResponseCopySettings;
  onResponseCopyConsentChange?: (consent: boolean) => void;
  // Conditional logic — one evaluation shared by rendering, validation,
  // navigation, and submit (docs/conditional-logic-v1-strategy.md §3.1)
  hiddenFieldIds: ReadonlySet<string>;
  hiddenPageIds: ReadonlySet<string>;
  getHiddenFieldIds: () => ReadonlySet<string>;
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
  responseId,
  responseCopySettings,
  onResponseCopyConsentChange,
}) => {
  const { getFormattedResponses } = useFormResponseUtils();
  const store = useFormResponseStore();
  const [initializationKey, setInitializationKey] = useState<string>('');
  const { hiddenFieldIds, hiddenPageIds, getHiddenFieldIds } =
    useConditionalVisibility(formSchema);

  // Initialize form with existing response data when in EDIT mode - SYNCHRONOUSLY
  useMemo(() => {
    // Only initialize in EDIT mode with valid data
    if (mode !== RendererMode.EDIT || !existingResponseData || Object.keys(existingResponseData).length === 0) {
      return false;
    }

    // Create a unique key for this initialization to prevent re-running
    const currentKey = `${mode}-${JSON.stringify(existingResponseData)}-${formSchema?.pages?.length || 0}`;

    if (currentKey !== initializationKey) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') console.log('FormRenderer - Synchronously initializing with existing data:', existingResponseData);

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

        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') console.log('FormRenderer - Field to page mapping:', fieldToPageMap);
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') console.log('FormRenderer - Existing response data fields:', Object.keys(existingResponseData));

        // Build page responses object
        const pageResponses: Record<string, Record<string, any>> = {};

        Object.entries(existingResponseData).forEach(([fieldId, value]) => {
          // Prevent prototype pollution by checking fieldId is not a prototype property
          if (fieldId === '__proto__' || fieldId === 'constructor' || fieldId === 'prototype') {
            console.warn('FormRenderer - Skipping potentially dangerous field ID:', fieldId);
            return;
          }
          const pageId = fieldToPageMap[fieldId] || formSchema.pages[0]?.id || 'default';
          // Also check pageId for prototype pollution
          if (pageId === '__proto__' || pageId === 'constructor' || pageId === 'prototype') {
            console.warn('FormRenderer - Skipping potentially dangerous page ID:', pageId);
            return;
          }
          if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') console.log(`FormRenderer - Mapping field ${fieldId} to page ${pageId}`);
          if (!Object.prototype.hasOwnProperty.call(pageResponses, pageId)) {
            pageResponses[pageId] = {};
          }
          pageResponses[pageId][fieldId] = value;
        });

        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') console.log('FormRenderer - Final page responses:', pageResponses);

        // Set all page responses SYNCHRONOUSLY before render
        Object.entries(pageResponses).forEach(([pageId, responses]) => {
          if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') console.log(`FormRenderer - Setting page ${pageId} responses:`, responses);
          store.setPageResponses(pageId, responses);
        });
      } else {
        // Fallback: put all fields in a default page
        store.setPageResponses('default', existingResponseData);
      }

      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') console.log('FormRenderer - Synchronous initialization completed');

      // Update the key to prevent re-running
      setInitializationKey(currentKey);
      return true;
    }

    return initializationKey === currentKey;
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
    responseCopySettings,
    onResponseCopyConsentChange,
    hiddenFieldIds,
    hiddenPageIds,
    getHiddenFieldIds,
  }), [formSchema, mode, onFormSubmit, onResponseUpdate, formId, responseId, responseCopySettings, onResponseCopyConsentChange, hiddenFieldIds, hiddenPageIds, getHiddenFieldIds]);

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
