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