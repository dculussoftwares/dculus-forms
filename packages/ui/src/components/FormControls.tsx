import React from 'react';
import { ValidationErrorSummary } from './ValidationErrorSummary';

interface ValidationError {
  fieldId: string;
  message: string;
}

interface FormControlsProps {
  showSubmitButton: boolean;
  submitButtonText: string;
  isSubmitting: boolean;
  isValid: boolean;
  errors: ValidationError[];
  buttonStyles: string;
  className?: string;
}

/**
 * Component for rendering form controls (submit button, error summary)
 * Extracted from SinglePageForm to improve modularity and reusability
 */
export const FormControls: React.FC<FormControlsProps> = ({
  showSubmitButton,
  submitButtonText,
  isSubmitting,
  isValid,
  errors,
  buttonStyles,
  className = ''
}) => {
  if (!showSubmitButton) {
    return null;
  }

  const buttonClassName = `${buttonStyles} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''} ${
    !isValid ? '!bg-red-500 hover:!bg-red-600' : ''
  }`;

  return (
    <div className={`space-y-3 ${className}`}>
      <ValidationErrorSummary errors={errors} isVisible={!isValid && errors.length > 0} />

      <div className="flex flex-col items-start gap-1">
        <button type="submit" disabled={isSubmitting} className={buttonClassName}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting...
            </span>
          ) : (
            <span className="flex items-center gap-2.5">
              {submitButtonText}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </button>
        <span className="text-xs text-gray-400 ml-1">press Enter ↵</span>
      </div>
    </div>
  );
};