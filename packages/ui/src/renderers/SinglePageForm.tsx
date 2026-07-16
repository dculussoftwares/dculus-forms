import React, { useCallback, useContext, useImperativeHandle, useMemo } from 'react';
import { useForm, FormProvider, Resolver, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormPage } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { FormFieldRenderer } from './FormFieldRenderer';
import { createPageSchema } from '../utils/zodSchemaBuilder';
import { FormValidationState } from '../types/validation';
import { useFormInitialization, useFormValidation, useStoreSync, useFormSubmission } from '../hooks';
import { FormControls } from '../components';
import { DEFAULT_LAYOUT_STYLES, FORM_CONSTANTS } from '../constants/formStyles';
import { useFormResponseStore } from '../stores/useFormResponseStore';
import { FormResponseContext } from './FormRenderer';

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

  // Conditional visibility — read null-safely so SinglePageForm keeps working
  // outside a FormRenderer (stories, isolated previews): no context = nothing hidden
  const responseContext = useContext(FormResponseContext);
  const hiddenFieldIds = responseContext?.hiddenFieldIds;
  const getHiddenFieldIds = responseContext?.getHiddenFieldIds;

  // Visibility can change while typing on this page, so the schema is rebuilt
  // with the current hidden set at validation time instead of being memoized —
  // a hidden required field must never block validation (strategy doc §4.1)
  const resolver = useCallback<Resolver<FieldValues>>(
    (values, context, options) =>
      zodResolver(createPageSchema(page, getHiddenFieldIds?.()))(values, context, options),
    [page, getHiddenFieldIds]
  );

  // Initialize React Hook Form
  const methods = useForm({
    defaultValues: getInitialValues(),
    mode: enableRealtimeValidation ? 'onChange' : 'onSubmit',
    resolver,
    criteriaMode: 'all',
  });

  const { handleSubmit, reset, control } = methods;

  // Initialize validation hook
  const {
    isValid,
    isSubmitting,
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
    onSubmit,
    getHiddenFieldIds
  );

  // Initialize store synchronization
  useStoreSync(control, page.id, store, () => {
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

  // Hidden fields unmount but keep their store values (re-showing restores the
  // typed input); values are stripped only at submit — strategy doc §4/§5
  const visibleFields = useMemo(
    () =>
      hiddenFieldIds && hiddenFieldIds.size > 0
        ? page.fields.filter((field) => !hiddenFieldIds.has(field.id))
        : page.fields,
    [page.fields, hiddenFieldIds]
  );

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
        <div className="space-y-4">
          {visibleFields.map((field) => (
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