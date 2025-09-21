import React, { useImperativeHandle, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormPage } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { FormFieldRenderer } from './FormFieldRenderer';
import { createPageSchema } from '../utils/zodSchemaBuilder';
import { FormValidationState } from '../types/validation';
import { useFormInitialization, useFormValidation, useStoreSync, useFormSubmission } from '../hooks';
import { ValidationErrorSummary, FormControls, PageHeader } from '../components';
import { DEFAULT_LAYOUT_STYLES, FORM_CONSTANTS } from '../constants/formStyles';
import { useFormResponseStore } from '../stores/useFormResponseStore';

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
  submitButtonText = FORM_CONSTANTS.DEFAULT_SUBMIT_TEXT,
  className = '',
  formRef,
  onValidationChange,
  enableRealtimeValidation = true,
}) => {
  // Initialize custom hooks
  const { getInitialValues, store } = useFormInitialization(page);

  // Create Zod schema for this page (memoized for performance)
  const validationSchema = useMemo(() => createPageSchema(page), [page]);

  // Initialize React Hook Form
  const methods = useForm({
    defaultValues: getInitialValues(),
    mode: enableRealtimeValidation ? 'onChange' : 'onSubmit',
    resolver: zodResolver(validationSchema),
    criteriaMode: 'all',
  });

  const { handleSubmit, reset, control } = methods;

  // Initialize validation hook
  const {
    isValid,
    isSubmitting,
    validationStates,
    validatePage,
    getValidationState,
    showAllValidationErrors,
    getFormattedErrors
  } = useFormValidation(methods, page, onValidationChange);

  // Initialize submission hook
  const { handleSubmit: handleFormSubmit, submitCurrentValues } = useFormSubmission(
    methods,
    page,
    store,
    onSubmit
  );

  // Initialize store synchronization
  useStoreSync(control, page.id, store, (values) => {
    reset(getInitialValues());
  });

  // Expose methods to parent via ref
  useImperativeHandle(formRef, () => ({
    submit: submitCurrentValues,
    validate: validatePage,
    getValidationState,
    showAllValidationErrors,
  }), [submitCurrentValues, validatePage, getValidationState, showAllValidationErrors]);

  // Determine styles to use
  const styles = layoutStyles || DEFAULT_LAYOUT_STYLES;

  // Early return for empty pages
  if (!page.fields || page.fields.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500 text-sm">
          {FORM_CONSTANTS.EMPTY_PAGE_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className={`space-y-4 ${className}`}>
        <PageHeader title={page.title} />

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

        <FormControls
          showSubmitButton={showSubmitButton}
          submitButtonText={submitButtonText}
          isSubmitting={isSubmitting}
          isValid={isValid}
          errors={getFormattedErrors()}
          buttonStyles={styles.submitButton}
        />
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