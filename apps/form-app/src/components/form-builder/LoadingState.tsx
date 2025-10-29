import React from 'react';
import { TypographyH1, TypographyP } from '@dculus/ui';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  title?: string;
  description?: string;
  variant?: 'fullscreen' | 'inline' | 'skeleton';
}

/**
 * LoadingState Component
 *
 * A versatile loading indicator that supports multiple display variants:
 * - `fullscreen`: Full-screen centered loading spinner with title and description
 * - `inline`: Inline loading indicator for content areas
 * - `skeleton`: Loading skeleton with card placeholders (for form builder)
 *
 * @example
 * // Fullscreen loading
 * <LoadingState
 *   variant="fullscreen"
 *   title="Loading form"
 *   description="Please wait..."
 * />
 *
 * @example
 * // Skeleton loading
 * <LoadingState variant="skeleton" />
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading',
  description = 'Please wait...',
  variant = 'fullscreen',
}) => {
  // Skeleton variant - shows loading skeleton with cards
  if (variant === 'skeleton') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <TypographyH1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </TypographyH1>
          <TypographyP className="text-gray-600 dark:text-gray-400">
            {description}
          </TypographyP>
        </div>

        {/* Loading skeleton */}
        <div className="space-y-6 mt-8">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="animate-pulse flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  <div className="space-y-1 flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Inline variant - simple centered loading without fullscreen
  if (variant === 'inline') {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    );
  }

  // Fullscreen variant (default) - full-screen centered loading
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-blue-950/30 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
};
