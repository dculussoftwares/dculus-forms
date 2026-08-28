import { useCallback } from 'react';
import { getOrCreateSessionId } from '../lib/sessionId';
import { embedAttribution, type EmbedAttribution } from '../lib/embedBridge';

interface UseFormSubmissionAnalyticsOptions {
  formId: string;
  enabled?: boolean;
}

/** Form Embed v1 — extends `EmbedAttribution` so `embedContext` keeps its
 *  narrow `EmbedMode | 'direct'` type rather than widening to `string`. */
interface SubmissionAnalyticsData extends EmbedAttribution {
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