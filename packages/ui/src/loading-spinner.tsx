import React from 'react';

/**
 * LoadingSpinner - A reusable loading spinner for full-page or inline loading states.
 * @param className Optional additional class names
 */
const LoadingSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center justify-center min-h-screen ${className}`} data-testid="loading-spinner">
    <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent"></div>
  </div>
);

export { LoadingSpinner };
