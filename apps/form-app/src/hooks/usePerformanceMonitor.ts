import { useCallback } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  dataFetchTime: number;
  componentMountTime: number;
}

interface PerformanceMonitorOptions {
  componentName: string;
  enableLogging?: boolean;
  trackDataFetching?: boolean;
}

/**
 * Hook to monitor component performance metrics (DISABLED to prevent infinite re-renders)
 */
export const usePerformanceMonitor = (_options: PerformanceMonitorOptions) => {
  // All functions are no-ops to prevent re-render issues
  const startDataFetch = useCallback(() => {
    // No-op
  }, []);

  const endDataFetch = useCallback(() => {
    // No-op
  }, []);

  const markLoadComplete = useCallback(() => {
    // No-op
  }, []);

  const getPerformanceSummary = useCallback((): string => {
    return 'Performance monitoring disabled';
  }, []);

  const getPerformanceStatus = useCallback((): 'excellent' | 'good' | 'poor' => {
    return 'good';
  }, []);

  return {
    metrics: {} as Partial<PerformanceMetrics>,
    startDataFetch,
    endDataFetch,
    markLoadComplete,
    getPerformanceSummary,
    getPerformanceStatus,
  };
};

/**
 * Hook to measure async operation performance (DISABLED)
 */
export const useAsyncPerformanceTracker = () => {
  const measureAsync = async <T>(
    operation: () => Promise<T>,
    _operationName: string,
    _enableLogging = false
  ): Promise<{ result: T; duration: number }> => {
    const result = await operation();
    return { result, duration: 0 };
  };

  return { measureAsync };
};

/**
 * Hook to track memory usage (DISABLED)
 */
export const useMemoryTracker = (_componentName: string) => {
  const getMemoryPressure = useCallback(() => 'low' as const, []);

  return {
    memoryInfo: {
      usedFormatted: '0 B',
      totalFormatted: '0 B',
      limitFormatted: '0 B',
    },
    getMemoryPressure,
  };
};