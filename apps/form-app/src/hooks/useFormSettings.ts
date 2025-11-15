import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_FORM } from '../graphql/mutations';
import type { SubmissionLimitsSettings } from '@dculus/types';
import { toastSuccess, toastError } from '@dculus/ui';

interface FormSettingsData {
  thankYou: {
    enabled: boolean;
    message: string;
  };
  submissionLimits: SubmissionLimitsSettings;
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
    thankYou: {
      enabled: false,
      message: 'Thank you! Your response has been submitted.',
    },
    submissionLimits: {},
  });
  
  const [isSaving, setIsSaving] = useState(false);

  const [updateForm] = useMutation(UPDATE_FORM, {
    onCompleted: () => {
      setIsSaving(false);
      onSuccess?.();
    },
    onError: (error) => {
      setIsSaving(false);
      toastError('Failed to save settings', error.message);
      onError?.(error.message);
    },
  });

  // Initialize settings from GraphQL data
  useEffect(() => {
    if (initialSettings) {
      setSettings(prev => ({
        ...prev,
        thankYou: {
          enabled: initialSettings.thankYou?.enabled ?? false,
          message: initialSettings.thankYou?.message ?? 'Thank you! Your response has been submitted.',
        },
        submissionLimits: initialSettings.submissionLimits ?? {},
      }));
    }
  }, [initialSettings]);

  // Update nested settings helper
  const updateSetting = <T extends keyof FormSettingsData>(
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

  // Save specific settings section
  const saveSettings = async (settingsToSave: Partial<FormSettingsData>) => {
    if (!formId) return;
    
    setIsSaving(true);

    try {
      // Strip __typename fields from the settings object
      const cleanedSettings = stripTypename(settingsToSave);
      
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

  // Save thank you settings
  const saveThankYouSettings = async () => {
    try {
      await saveSettings({
        thankYou: {
          enabled: settings.thankYou.enabled,
          message: settings.thankYou.message,
        }
      });
      toastSuccess('Thank You settings saved successfully');
    } catch {
      // Error already handled in the mutation onError callback
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

  return {
    settings,
    isSaving,
    updateSetting,
    saveSettings,
    saveThankYouSettings,
    updateSubmissionLimits,
    saveSubmissionLimits,
  };
};
