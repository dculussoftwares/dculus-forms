import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ValidationSummaryProps {
  errors: Record<string, any>;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ errors }) => {
  const errorMessages = Object.entries(errors)
    .filter(([_, error]) => {
      const message = error?.message || (typeof error === 'string' ? error : null);
      return Boolean(message);
    })
    .map(([field, error]) => ({
      field,
      message: error?.message || (typeof error === 'string' ? error : ''),
      isGlobalError: ['minDate', 'maxDate', 'defaultValue', 'min', 'max', 'options'].includes(field)
    }));

  if (errorMessages.length === 0) return null;

  const globalErrors = errorMessages.filter(err => err.isGlobalError);
  const fieldErrors = errorMessages.filter(err => !err.isGlobalError);

  return (
    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-start space-x-2">
        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            Please fix the following issues to save:
          </h4>
          <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
            {globalErrors.map((err, index) => (
              <li key={index} className="flex items-start space-x-1">
                <span className="text-red-500 mt-1">•</span>
                <span>{String(err.message)}</span>
              </li>
            ))}
            {fieldErrors.map((err, index) => (
              <li key={index} className="flex items-start space-x-1">
                <span className="text-red-500 mt-1">•</span>
                <span>
                  <strong className="capitalize">{err.field}:</strong> {String(err.message)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};