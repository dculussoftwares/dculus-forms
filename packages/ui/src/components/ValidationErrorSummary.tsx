import React from 'react';

interface ValidationError {
  fieldId: string;
  message: string;
}

interface ValidationErrorSummaryProps {
  errors: ValidationError[];
  isVisible: boolean;
  className?: string;
}

/**
 * Component for displaying form validation errors in a consistent summary format
 * Extracted from SinglePageForm to improve reusability and separation of concerns
 */
export const ValidationErrorSummary: React.FC<ValidationErrorSummaryProps> = ({
  errors,
  isVisible,
  className = ''
}) => {
  if (!isVisible || errors.length === 0) {
    return null;
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-md p-3 ${className}`}>
      <p className="text-sm text-red-600 font-medium mb-2">
        Please fix the following {errors.length === 1 ? 'error' : 'errors'}:
      </p>
      <ul className="text-sm text-red-600 space-y-1">
        {errors.map(({ fieldId, message }) => (
          <li key={fieldId}>• {message}</li>
        ))}
      </ul>
    </div>
  );
};