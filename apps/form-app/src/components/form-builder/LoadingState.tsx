import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  title: string;
  description: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ title, description }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-blue-950/30 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
};