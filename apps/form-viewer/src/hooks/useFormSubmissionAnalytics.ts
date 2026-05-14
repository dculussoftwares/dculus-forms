import { useCallback } from 'react';
import { getOrCreateSessionId } from '../lib/sessionId';

interface UseFormSubmissionAnalyticsOptions {
  formId: string;
  enabled?: boolean;
}

interface SubmissionAnalyticsData {
  sessionId: string;
  userAgent: string;
  timezone: string;
  language: string;
}

export const useFormSubmissionAnalytics = ({ formId, enabled = true }: UseFormSubmissionAnalyticsOptions) => {
  const getSubmissionAnalyticsData = useCallback((): SubmissionAnalyticsData | null => {
    if (!enabled || !formId) {
      return null;
    }

    try {
      const sessionId = getOrCreateSessionId();

      // Gather analytics data
      return {
        sessionId,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language
      };
    } catch (error) {
      console.warn('Failed to gather submission analytics data:', error);
      return null;
    }
  }, [formId, enabled]);

  return {
    getSubmissionAnalyticsData
  };
};