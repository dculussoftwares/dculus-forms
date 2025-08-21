import React from 'react';

interface ErrorStateProps {
  title: string;
  description: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title, description }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-blue-950/30 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
};