import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import type { FormSchema } from '@dculus/types';
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
  formId?: string;
}

// Context for sharing form response state throughout the form
export interface FormResponseContextValue {
  formSchema?: FormSchema;
  mode: RendererMode;
  onFormSubmit?: (formId: string, responses: Record<string, any>) => void;
  formId?: string;
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
  formId
}) => {
  const { getFormattedResponses } = useFormResponseUtils();
  
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
    formId,
  }), [formSchema, mode, onFormSubmit, formId]);

  return (
    <FormResponseContext.Provider value={contextValue}>
      <LayoutRenderer
        layoutCode={formSchema?.layout.code ?? 'L9'}
        layout={formSchema?.layout}
        pages={formSchema?.pages ?? []}
        className={className}
        cdnEndpoint={cdnEndpoint}
        mode={mode}
      />
    </FormResponseContext.Provider>
  );
};
