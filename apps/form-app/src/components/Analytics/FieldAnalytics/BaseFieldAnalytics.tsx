/**
 * Base Field Analytics Component
 *
 * Reusable base component for field-specific analytics.
 * Provides consistent loading states, empty states, and error handling
 * across all field analytics components.
 *
 * Usage:
 * ```typescript
 * export const TextFieldAnalytics: React.FC<TextFieldAnalyticsProps> = (props) => {
 *   return (
 *     <BaseFieldAnalytics<TextFieldAnalyticsData>
 *       {...props}
 *       namespace="textFieldAnalytics"
 *     >
 *       <SimpleWordCloud words={props.data.wordCloud} />
 *       <LengthDistribution data={props.data.lengthDistribution} />
 *     </BaseFieldAnalytics>
 *   );
 * };
 * ```
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { FileText, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Base props for field analytics components
 */
export interface BaseFieldAnalyticsProps<T> {
  /** Analytics data for the field */
  data: T;
  /** Label of the field being analyzed */
  fieldLabel: string;
  /** Total number of responses for context */
  totalResponses: number;
  /** Loading state indicator */
  loading?: boolean;
  /** Translation namespace for field-specific strings */
  namespace: string;
  /** Optional custom error message */
  error?: string;
  /** Optional class name for customization */
  className?: string;
  /** Children components (charts, stats, etc.) */
  children?: React.ReactNode;
}

/**
 * Loading skeleton for analytics
 */
const AnalyticsLoadingSkeleton: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-8 w-48 bg-gray-200 rounded"></div>
        <div className="h-6 w-32 bg-gray-200 rounded"></div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-40 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading message */}
      {message && (
        <div className="flex items-center justify-center gap-2 text-gray-500 mt-4">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Empty state for analytics (no data)
 */
const AnalyticsEmptyState: React.FC<{
  message: string;
  description?: string;
}> = ({ message, description }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-gray-100 p-6 mb-4">
        <FileText className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{message}</h3>
      {description && (
        <p className="text-sm text-gray-500 text-center max-w-md">
          {description}
        </p>
      )}
    </div>
  );
};

/**
 * Error state for analytics
 */
const AnalyticsErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-red-100 p-6 mb-4">
        <FileText className="h-12 w-12 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h3>
      <p className="text-sm text-gray-500 text-center max-w-md mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
};

/**
 * Base Field Analytics Component
 *
 * Handles common analytics patterns:
 * - Loading states with skeleton
 * - Empty states when no data
 * - Error states with retry
 * - Consistent layout and spacing
 * - Translation integration
 */
export const BaseFieldAnalytics = <T,>({
  data,
  fieldLabel,
  totalResponses,
  loading = false,
  namespace,
  error,
  className = '',
  children,
}: BaseFieldAnalyticsProps<T>): React.ReactElement => {
  const { t } = useTranslation(namespace as any);

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        <AnalyticsLoadingSkeleton message={t('loading.message', { defaultValue: 'Loading analytics...' })} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <AnalyticsErrorState message={error} />
      </div>
    );
  }

  // Empty data state
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className={className}>
        <Card>
          <CardContent>
            <AnalyticsEmptyState
              message={t('empty.message', { defaultValue: 'No data available' })}
              description={t('empty.description', { defaultValue: 'There are no responses for this field yet.' })}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main content with children
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Field header with context */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{fieldLabel}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('header.totalResponses', {
              defaultValue: `${totalResponses} total responses`,
              values: { count: totalResponses }
            })}
          </p>
        </div>
      </div>

      {/* Analytics content (charts, stats, etc.) */}
      {children}
    </div>
  );
};

/**
 * Wrapper for analytics cards with consistent styling
 */
export const AnalyticsCard: React.FC<{
  title: string;
  helper?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, helper, children, className = '' }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {helper}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};

/**
 * Utility function to check if data is empty
 * Handles various data structures
 */
export const isAnalyticsDataEmpty = (data: any): boolean => {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data) && data.length === 0) return true;
  if (typeof data === 'object' && Object.keys(data).length === 0) return true;
  return false;
};

/**
 * Utility function to format response count
 */
export const formatResponseCount = (count: number): string => {
  if (count === 0) return 'No responses';
  if (count === 1) return '1 response';
  return `${count.toLocaleString()} responses`;
};
