import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  error?: any;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  const errorMessage = error?.message || (typeof error === 'string' ? error : null);
  if (!errorMessage) return null;
  
  return (
    <div className="flex items-center space-x-1 text-red-600 dark:text-red-400 text-xs mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md animate-in slide-in-from-top-2 duration-200">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span className="font-medium">{errorMessage}</span>
    </div>
  );
};