import { useEffect, useCallback } from 'react';
import { useMutation, gql } from '@apollo/client';

const TRACK_FORM_VIEW = gql`
  mutation TrackFormView($input: TrackFormViewInput!) {
    trackFormView(input: $input) {
      success
    }
  }
`;

const UPDATE_FORM_START_TIME = gql`
  mutation UpdateFormStartTime($input: UpdateFormStartTimeInput!) {
    updateFormStartTime(input: $input) {
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

  const [updateFormStartTime] = useMutation(UPDATE_FORM_START_TIME, {
    errorPolicy: 'ignore' // Don't fail form interaction if analytics fails
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

  const trackFormStartTime = useCallback(async () => {
    if (!enabled || !formId) {
      return;
    }

    try {
      const sessionId = generateSessionId();
      const startedAt = new Date().toISOString();

      // Store start time locally for completion time calculation
      localStorage.setItem(`form_start_time_${sessionId}_${formId}`, startedAt);

      // Update form start time on server
      await updateFormStartTime({
        variables: {
          input: {
            formId,
            sessionId,
            startedAt
          }
        }
      });

      console.log('Form start time tracked successfully', { formId, sessionId, startedAt });
    } catch (error) {
      // Silently handle analytics errors to not disrupt form interaction
      console.warn('Form start time tracking failed:', error);
    }
  }, [formId, enabled, generateSessionId, updateFormStartTime]);

  useEffect(() => {
    if (enabled && formId) {
      // Track the view when the hook is first used
      trackView();
    }
  }, [trackView, enabled, formId]);

  return {
    trackView,
    trackFormStartTime
  };
};