import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ErrorMessageProps } from './types';

/**
 * Displays validation errors with consistent styling and animation
 * 
 * @param error - Error object or string message to display
 * @returns JSX element or null if no error
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error?.message || null;
  
  if (!errorMessage) return null;
  
  return (
    <div className="flex items-center space-x-1 text-red-600 dark:text-red-400 text-xs mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md animate-in slide-in-from-top-2 duration-200">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span className="font-medium">{errorMessage}</span>
    </div>
  );
};