import { useCallback } from 'react';
import { getOrCreateSessionId } from '../lib/sessionId';
import { embedAttribution } from '../lib/embedBridge';

interface UseFormSubmissionAnalyticsOptions {
  formId: string;
  enabled?: boolean;
}

interface SubmissionAnalyticsData {
  sessionId: string;
  userAgent: string;
  timezone: string;
  language: string;
  /** Form Embed v1 — 'direct' for the hosted page, otherwise the embed mode. */
  embedContext: string;
  /** Host page hostname, or null when unknown / not embedded. */
  embedHost: string | null;
}

export const useFormSubmissionAnalytics = ({ formId, enabled = true }: UseFormSubmissionAnalyticsOptions) => {
  const getSubmissionAnalyticsData = useCallback((): SubmissionAnalyticsData | null => {
    if (!enabled || !formId) {
      return null;
    }

    try {
      const sessionId = getOrCreateSessionId();

      // Gather analytics data
      const { embedContext, embedHost } = embedAttribution.get();
      return {
        sessionId,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        embedContext,
        embedHost
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