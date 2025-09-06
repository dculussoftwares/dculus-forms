import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { GET_FORM_ANALYTICS } from '../graphql/queries';
import { useAuth } from '../contexts/AuthContext';

export interface TimeRange {
  start: string;
  end: string;
}

export interface CountryStats {
  code?: string;
  name: string;
  count: number;
  percentage: number;
}

export interface OSStats {
  name: string;
  count: number;
  percentage: number;
}

export interface BrowserStats {
  name: string;
  count: number;
  percentage: number;
}

export interface ViewsOverTimeData {
  date: string;
  views: number;
  sessions: number;
}

export interface FormAnalyticsData {
  totalViews: number;
  uniqueSessions: number;
  topCountries: CountryStats[];
  topOperatingSystems: OSStats[];
  topBrowsers: BrowserStats[];
  viewsOverTime: ViewsOverTimeData[];
}

export type TimeRangePreset = '7d' | '30d' | '90d' | 'custom';

const getTimeRangeFromPreset = (preset: TimeRangePreset): TimeRange | null => {
  const now = new Date();
  const start = new Date();
  
  switch (preset) {
    case '7d':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start.setDate(now.getDate() - 30);
      break;
    case '90d':
      start.setDate(now.getDate() - 90);
      break;
    case 'custom':
      return null; // Custom range should be handled separately
    default:
      return null;
  }
  
  return {
    start: start.toISOString(),
    end: now.toISOString()
  };
};

interface UseFormAnalyticsOptions {
  formId: string;
  initialTimeRange?: TimeRangePreset;
}

export const useFormAnalytics = ({ formId, initialTimeRange = '30d' }: UseFormAnalyticsOptions) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>(initialTimeRange);
  const [customTimeRange, setCustomTimeRange] = useState<TimeRange | null>(null);
  
  // Memoize the time range to prevent infinite re-renders
  const timeRange = useMemo(() => {
    return timeRangePreset === 'custom' ? customTimeRange : getTimeRangeFromPreset(timeRangePreset);
  }, [timeRangePreset, customTimeRange]);
  
  const { data, loading, error, refetch } = useQuery(GET_FORM_ANALYTICS, {
    variables: {
      formId,
      timeRange
    },
    skip: !formId || !timeRange || !isAuthenticated || authLoading,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: false // Prevent unnecessary re-renders
  });

  const analyticsData: FormAnalyticsData | null = data?.formAnalytics || null;

  // Helper function to update time range
  const updateTimeRange = (preset: TimeRangePreset, custom?: TimeRange) => {
    setTimeRangePreset(preset);
    if (preset === 'custom' && custom) {
      setCustomTimeRange(custom);
    } else {
      setCustomTimeRange(null);
    }
  };

  // Helper function to refresh data
  const refreshData = () => {
    refetch();
  };

  // Calculate additional metrics
  const conversionRate = analyticsData 
    ? (analyticsData.uniqueSessions / analyticsData.totalViews * 100) 
    : 0;

  const topCountry = analyticsData?.topCountries?.[0];
  const topBrowser = analyticsData?.topBrowsers?.[0];
  const topOS = analyticsData?.topOperatingSystems?.[0];

  return {
    // Core data
    analyticsData,
    loading: loading || authLoading,
    error,
    
    // Time range management
    timeRangePreset,
    customTimeRange,
    updateTimeRange,
    
    // Helper functions
    refreshData,
    
    // Computed metrics
    conversionRate: Number(conversionRate.toFixed(1)),
    topCountry,
    topBrowser,
    topOS,
    
    // Status flags
    hasData: isAuthenticated && !!analyticsData && analyticsData.totalViews > 0,
    isEmpty: isAuthenticated && !!analyticsData && analyticsData.totalViews === 0,
    isAuthenticated
  };
};