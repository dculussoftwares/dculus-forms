import { useEffect, useCallback } from 'react';
import { useMutation, gql } from '@apollo/client';

const TRACK_FORM_VIEW = gql`
  mutation TrackFormView($input: TrackFormViewInput!) {
    trackFormView(input: $input) {
      success
    }
  }
`;

interface UseFormAnalyticsOptions {
  formId: string;
  enabled?: boolean;
}

export const useFormAnalytics = ({ formId, enabled = true }: UseFormAnalyticsOptions) => {
  const [trackFormView] = useMutation(TRACK_FORM_VIEW, {
    errorPolicy: 'ignore' // Don't fail form viewing if analytics fails
  });

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

  const trackView = useCallback(async () => {
    if (!enabled || !formId) {
      return;
    }

    try {
      const sessionId = generateSessionId();
      
      // Gather analytics data
      const analyticsData = {
        formId,
        sessionId,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language
      };

      // Track the form view
      await trackFormView({
        variables: {
          input: analyticsData
        }
      });

      console.log('Form view tracked successfully', { formId, sessionId });
    } catch (error) {
      // Silently handle analytics errors to not disrupt form viewing
      console.warn('Analytics tracking failed:', error);
    }
  }, [formId, enabled, generateSessionId, trackFormView]);

  useEffect(() => {
    if (enabled && formId) {
      // Track the view when the hook is first used
      trackView();
    }
  }, [trackView, enabled, formId]);

  return {
    trackView
  };
};