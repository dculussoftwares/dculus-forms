import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useLocale } from '../../../hooks/useLocale';
import { flattenErrors } from '../../../utils/formErrors';

interface ValidationSummaryProps {
  errors: Record<string, any>;
}

/**
 * Helper function to translate messages that might be translation keys
 */
const useMessageTranslator = () => {
  const { messages } = useLocale();
  
  return (message: string): string => {
    // Check if the message is a translation key (format: namespace:path.to.key)
    if (message.includes(':')) {
      const [namespace, ...keyParts] = message.split(':');
      const key = keyParts.join(':');
      
      // Manually resolve the translation
      const segments = [namespace, ...key.split('.')].filter(Boolean);
      const result = segments.reduce<any>((current, segment) => {
        if (typeof current === 'object' && current !== null) {
          return current[segment];
        }
        return undefined;
      }, messages);
      
      return typeof result === 'string' ? result : message;
    }
    
    return message;
  };
};

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ errors }) => {
  const { t } = useTranslation('validationSummary');
  const translateMessage = useMessageTranslator();
  
  // Flatten nested errors from react-hook-form
  const flatErrors = flattenErrors(errors);
  
  const errorMessages = Object.entries(flatErrors)
    .filter(([_, error]) => {
      const message = error?.message || (typeof error === 'string' ? error : null);
      return Boolean(message);
    })
    .map(([field, error]) => {
      const translatedMessage = translateMessage(error?.message || (typeof error === 'string' ? error : ''));
      return {
        field,
        message: translatedMessage,
        // Check both the full path and the last part for global errors
        isGlobalError: ['minDate', 'maxDate', 'defaultValue', 'min', 'max', 'options', 'validation.minLength', 'validation.maxLength', 'validation.minSelections', 'validation.maxSelections'].includes(field)
      };
    });

  if (errorMessages.length === 0) return null;

  const globalErrors = errorMessages.filter(err => err.isGlobalError);
  const fieldErrors = errorMessages.filter(err => !err.isGlobalError);

  return (
    <div 
      data-testid="validation-error-summary"
      className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <div className="flex items-start space-x-2">
        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            {t('title')}
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