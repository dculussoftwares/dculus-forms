import React from 'react';

// Following Dculus design principles: import utilities only from @dculus/utils
import { cn } from "@dculus/utils"

/**
 * LoadingSpinner component props
 * Following Dculus functional programming principles with complete TypeScript safety
 */
export interface LoadingSpinnerProps {
  /** Additional CSS classes */
  className?: string;
  /** Size variant for the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to display as full screen or inline */
  fullScreen?: boolean;
}

/**
 * Functional LoadingSpinner component for loading states
 * Supports different sizes and full-screen or inline display
 * Following Dculus design principles: functional programming first, full type safety
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  className, 
  size = 'md', 
  fullScreen = true 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8 border-2',
    md: 'h-16 w-16 border-4',
    lg: 'h-24 w-24 border-6'
  };

  const containerClasses = fullScreen 
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center';

  return (
    <div className={cn(containerClasses, className)} data-testid="loading-spinner">
      <div className={cn(
        'animate-spin rounded-full border-primary border-t-transparent',
        sizeClasses[size]
      )}></div>
    </div>
  );
};

export { LoadingSpinner };
