import { FieldError, FieldErrors } from 'react-hook-form';

export interface FormValidationState {
  isValid: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  submitCount: number;
  errors: FieldErrors;
  touchedFields: Record<string, boolean>;
  allowNavigationOnFirstAttempt: boolean;
}

export interface PageValidationHook {
  isPageValid: boolean;
  validatePage: () => Promise<boolean>;
  getFieldError: (fieldId: string) => string | undefined;
  clearFieldError: (fieldId: string) => void;
  markFieldAsTouched: (fieldId: string) => void;
  isFieldTouched: (fieldId: string) => boolean;
}

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export interface FormNavigationState {
  canGoNext: boolean;
  canGoPrevious: boolean;
  isLastPage: boolean;
  isFirstPage: boolean;
  currentPageValid: boolean;
  isFirstAttempt: boolean;
  showLenientValidation: boolean;
}

export type ValidationTrigger = 'onChange' | 'onBlur' | 'onSubmit' | 'all';