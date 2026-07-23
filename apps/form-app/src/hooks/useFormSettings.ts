import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react';
import { UPDATE_FORM } from '../graphql/mutations';
import type { SubmissionLimitsSettings, ResponseCopySettings, AccessControlSettings } from '@dculus/types';
import { toastSuccess, toastError } from '@dculus/ui';
import { getErrorDetails } from '../utils/graphqlErrors';
import { useTranslation } from './useTranslation';

interface FormSettingsData {
  submissionLimits: SubmissionLimitsSettings;
  responseCopy: ResponseCopySettings;
  accessControl: AccessControlSettings;
  collectRespondentEmail: boolean;
}

interface UseFormSettingsProps {
  formId: string | undefined;
  initialSettings?: any;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const useFormSettings = ({
  formId,
  initialSettings,
  onSuccess,
  onError,
}: UseFormSettingsProps) => {
  const [settings, setSettings] = useState<FormSettingsData>({
    submissionLimits: {},
    responseCopy: {
      enabled: false,
      mode: 'respondentChoice',
    },
    accessControl: {
      enabled: false,
      requireSignIn: false,
      allowedDomains: [],
    },
    collectRespondentEmail: false,
  });
  
  const [isSaving, setIsSaving] = useState(false);

  const { t: tErr } = useTranslation('graphqlErrors');

  const [updateForm] = useMutation(UPDATE_FORM, {
    onCompleted: () => {
      setIsSaving(false);
      onSuccess?.();
    },
    onError: (error) => {
      setIsSaving(false);
      const { messageKey } = getErrorDetails(error);
      toastError('Failed to save settings', tErr(messageKey));
      onError?.(error.message);
    },
  });

  // Initialize settings from GraphQL data
  useEffect(() => {
    if (initialSettings) {
      setSettings(prev => ({
        ...prev,
        submissionLimits: initialSettings.submissionLimits ?? {},
        responseCopy: {
          enabled: initialSettings.responseCopy?.enabled ?? false,
          mode: initialSettings.responseCopy?.mode ?? 'respondentChoice',
          emailFieldId: initialSettings.responseCopy?.emailFieldId,
          pdfTemplateId: initialSettings.responseCopy?.pdfTemplateId,
          subject: initialSettings.responseCopy?.subject,
        },
        // Without this, local accessControl state sits at its default
        // forever and the next unrelated save (Thank You, submission
        // limits) silently resets any configured access control back to
        // disabled — saves always resend the whole JSON column.
        accessControl: {
          enabled: initialSettings.accessControl?.enabled ?? false,
          requireSignIn: initialSettings.accessControl?.requireSignIn ?? false,
          allowedDomains: initialSettings.accessControl?.allowedDomains ?? [],
        },
        collectRespondentEmail: initialSettings.collectRespondentEmail ?? false,
      }));
    }
  }, [initialSettings]);

  // Update nested settings helper — restricted to object-valued sections
  // (e.g. responseCopy), since `collectRespondentEmail` is a plain
  // boolean and can't be spread as `{ ...prev[section] }`.
  type ObjectSettingKey = {
    [K in keyof FormSettingsData]: FormSettingsData[K] extends object ? K : never;
  }[keyof FormSettingsData];

  const updateSetting = <T extends ObjectSettingKey>(
    section: T,
    key: keyof FormSettingsData[T],
    value: any
  ) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  // Helper function to strip __typename from objects
  const stripTypename = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(stripTypename);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key !== '__typename') {
          cleaned[key] = stripTypename(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  };

  // Save specific settings section. The backend replaces the whole `settings`
  // JSON column rather than merging it, so we always send the full current
  // settings state (not just the changed section) to avoid clobbering the
  // other sections (e.g. saving Thank You settings wiping out submissionLimits).
  const saveSettings = async (settingsToSave: Partial<FormSettingsData>) => {
    if (!formId) return;

    setIsSaving(true);

    try {
      // Strip __typename fields from the settings object
      const cleanedSettings = stripTypename({ ...settings, ...settingsToSave });

      await updateForm({
        variables: {
          id: formId,
          input: {
            settings: cleanedSettings,
          },
        },
      });
    } catch {
      // Error handled by onError callback
    }
  };

  // Update submission limits
  const updateSubmissionLimits = (limits: SubmissionLimitsSettings) => {
    setSettings(prev => ({
      ...prev,
      submissionLimits: limits,
    }));
  };

  // Save submission limits settings
  const saveSubmissionLimits = async () => {
    try {
      await saveSettings({
        submissionLimits: settings.submissionLimits,
      });
      toastSuccess('Submission limits saved successfully');
    } catch {
      // Error already handled in the mutation onError callback
    }
  };

  // Save response copy settings
  const saveResponseCopySettings = async () => {
    try {
      await saveSettings({
        responseCopy: settings.responseCopy,
      });
      toastSuccess('Response copy settings saved successfully');
    } catch {
      // Error already handled in the mutation onError callback
    }
  };

  // Update access control
  const updateAccessControl = (accessControl: AccessControlSettings) => {
    setSettings(prev => ({
      ...prev,
      accessControl,
    }));
  };

  // Save access control settings
  const saveAccessControlSettings = async () => {
    try {
      // `saveSettings` always merges in the full current `settings` state (see
      // its comment above), so `collectRespondentEmail` rides along even
      // though it isn't listed in this partial payload.
      await saveSettings({
        accessControl: settings.accessControl,
      });
      toastSuccess('Access control settings saved successfully');
    } catch {
      // Error already handled in the mutation onError callback
    }
  };

  // Update whether respondent email is collected (independent of accessControl)
  const updateCollectRespondentEmail = (collectRespondentEmail: boolean) => {
    setSettings(prev => ({
      ...prev,
      collectRespondentEmail,
    }));
  };

  return {
    settings,
    isSaving,
    updateSetting,
    saveSettings,
    updateSubmissionLimits,
    saveSubmissionLimits,
    saveResponseCopySettings,
    updateAccessControl,
    saveAccessControlSettings,
    updateCollectRespondentEmail,
  };
};
