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

  const buttonClassName = `${buttonStyles} ${
    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
  } ${!isValid ? 'bg-red-500 hover:bg-red-600' : ''}`;

  return (
    <div className={`space-y-2 ${className}`}>
      <ValidationErrorSummary
        errors={errors}
        isVisible={!isValid && errors.length > 0}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className={buttonClassName}
      >
        {isSubmitting ? 'Submitting...' : submitButtonText}
      </button>
    </div>
  );
};