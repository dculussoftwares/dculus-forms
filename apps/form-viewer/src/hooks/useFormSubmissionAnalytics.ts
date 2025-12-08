import { useCallback } from 'react';

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
  const generateSessionId = useCallback(() => {
    // Check if we already have a session ID for this browser
    let sessionId = localStorage.getItem('dculus_form_session_id');

    if (!sessionId) {
      // Generate cryptographically secure UUID-like session ID
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);

      // Set version (4) and variant (8, 9, a, or b) bits for UUID v4 format
      randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
      randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;

      // Convert to hex string with UUID format
      const hexBytes = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0'));
      sessionId = [
        hexBytes.slice(0, 4).join(''),
        hexBytes.slice(4, 6).join(''),
        hexBytes.slice(6, 8).join(''),
        hexBytes.slice(8, 10).join(''),
        hexBytes.slice(10, 16).join('')
      ].join('-');

      // Store it for future use
      localStorage.setItem('dculus_form_session_id', sessionId);
    }

    return sessionId;
  }, []);

  const getSubmissionAnalyticsData = useCallback((): SubmissionAnalyticsData | null => {
    if (!enabled || !formId) {
      return null;
    }

    try {
      const sessionId = generateSessionId();

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
  }, [formId, enabled, generateSessionId]);

  return {
    getSubmissionAnalyticsData
  };
};