import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { GET_FORM_ANALYTICS, GET_FORM_SUBMISSION_ANALYTICS } from '../graphql/queries';
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

export interface SubmissionsOverTimeData {
  date: string;
  submissions: number;
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

export interface FormSubmissionAnalyticsData {
  totalSubmissions: number;
  uniqueSessions: number;
  topCountries: CountryStats[];
  topOperatingSystems: OSStats[];
  topBrowsers: BrowserStats[];
  submissionsOverTime: SubmissionsOverTimeData[];
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
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true
  });

  const { 
    data: submissionData, 
    loading: submissionLoading, 
    error: submissionError, 
    refetch: refetchSubmissions 
  } = useQuery(GET_FORM_SUBMISSION_ANALYTICS, {
    variables: {
      formId,
      timeRange
    },
    skip: !formId || !timeRange || !isAuthenticated || authLoading,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true
  });

  const analyticsData: FormAnalyticsData | null = data?.formAnalytics || null;
  const submissionAnalyticsData: FormSubmissionAnalyticsData | null = submissionData?.formSubmissionAnalytics || null;

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
  const refreshData = async () => {
    console.log('Refreshing analytics data...', { formId, timeRange });
    try {
      const [analyticsResult, submissionResult] = await Promise.all([
        refetch({
          formId,
          timeRange
        }),
        refetchSubmissions({
          formId,
          timeRange
        })
      ]);
      console.log('Analytics data refreshed successfully', { 
        analytics: analyticsResult.data, 
        submissions: submissionResult.data 
      });
    } catch (error) {
      console.error('Error refreshing analytics data:', error);
    }
  };

  // Calculate additional metrics
  const conversionRate = analyticsData 
    ? (analyticsData.uniqueSessions / analyticsData.totalViews * 100) 
    : 0;

  // Calculate submission conversion rate (submissions / views)
  const submissionConversionRate = (analyticsData && submissionAnalyticsData)
    ? (submissionAnalyticsData.totalSubmissions / analyticsData.totalViews * 100)
    : 0;

  const topCountry = analyticsData?.topCountries?.[0];
  const topBrowser = analyticsData?.topBrowsers?.[0];
  const topOS = analyticsData?.topOperatingSystems?.[0];

  // Submission analytics top stats
  const topSubmissionCountry = submissionAnalyticsData?.topCountries?.[0];
  const topSubmissionBrowser = submissionAnalyticsData?.topBrowsers?.[0];
  const topSubmissionOS = submissionAnalyticsData?.topOperatingSystems?.[0];

  return {
    // Core data
    analyticsData,
    submissionAnalyticsData,
    loading: loading || authLoading || submissionLoading,
    error: error || submissionError,
    
    // Time range management
    timeRangePreset,
    customTimeRange,
    updateTimeRange,
    
    // Helper functions
    refreshData,
    
    // Computed metrics
    conversionRate: Number(conversionRate.toFixed(1)),
    submissionConversionRate: Number(submissionConversionRate.toFixed(1)),
    topCountry,
    topBrowser,
    topOS,
    topSubmissionCountry,
    topSubmissionBrowser,
    topSubmissionOS,
    
    // Status flags
    hasData: isAuthenticated && !!analyticsData && analyticsData.totalViews > 0,
    hasSubmissionData: isAuthenticated && !!submissionAnalyticsData && submissionAnalyticsData.totalSubmissions > 0,
    isEmpty: isAuthenticated && !!analyticsData && analyticsData.totalViews === 0,
    isAuthenticated
  };
};