import { useEffect, useCallback } from 'react';
import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { getOrCreateSessionId } from '../lib/sessionId';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRACK_FORM_VIEW: TypedDocumentNode<any, any> = gql`
  mutation TrackFormView($input: TrackFormViewInput!) {
    trackFormView(input: $input) {
      success
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const UPDATE_FORM_START_TIME: TypedDocumentNode<any, any> = gql`
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

  // Stable reference — getOrCreateSessionId reads/writes localStorage, not React state
  const generateSessionId = useCallback(() => getOrCreateSessionId(), []);

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

      if (import.meta.env.DEV) console.log('Form view tracked', { formId, sessionId });
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

      if (import.meta.env.DEV) console.log('Form start time tracked', { formId, sessionId, startedAt });
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