import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { ErrorMessageProps } from './types';

/**
 * Component for displaying a translated error message
 */
const TranslatedErrorMessage: React.FC<{ namespace: string; translationKey: string }> = ({ namespace, translationKey }) => {
  const { t } = useTranslation(namespace as any);
  const errorMessage = t(translationKey);
  
  return (
    <div className="flex items-center space-x-1 text-red-600 dark:text-red-400 text-xs mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md animate-in slide-in-from-top-2 duration-200">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span className="font-medium">{errorMessage}</span>
    </div>
  );
};

/**
 * Displays validation errors with consistent styling and animation
 * Automatically translates error messages if they are translation keys
 * 
 * @param error - Error object or string message to display
 * @returns JSX element or null if no error
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  const rawMessage = typeof error === 'string' 
    ? error 
    : error?.message || null;
  
  if (!rawMessage) return null;
  
  // Check if the message is a translation key (format: namespace:path.to.key)
  if (rawMessage.includes(':')) {
    const [namespace, translationKey] = rawMessage.split(':', 2);
    return <TranslatedErrorMessage namespace={namespace} translationKey={translationKey} key={`error-${namespace}-${translationKey}`} />;
  }
  
  // Non-translated error message
  return (
    <div className="flex items-center space-x-1 text-red-600 dark:text-red-400 text-xs mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md animate-in slide-in-from-top-2 duration-200">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span className="font-medium">{rawMessage}</span>
    </div>
  );
};