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
      // Generate new UUID-like session ID
      sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      
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