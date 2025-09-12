import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_FORM } from '../graphql/mutations';
import type { SubmissionLimitsSettings } from '@dculus/types';

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

  // Save specific settings section
  const saveSettings = async (settingsToSave: Partial<FormSettingsData>) => {
    if (!formId) return;
    
    setIsSaving(true);

    try {
      await updateForm({
        variables: {
          id: formId,
          input: {
            settings: settingsToSave,
          },
        },
      });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  // Save thank you settings
  const saveThankYouSettings = () => {
    return saveSettings({
      thankYou: {
        enabled: settings.thankYou.enabled,
        message: settings.thankYou.message,
      }
    });
  };

  // Update submission limits
  const updateSubmissionLimits = (limits: SubmissionLimitsSettings) => {
    setSettings(prev => ({
      ...prev,
      submissionLimits: limits,
    }));
  };

  // Save submission limits settings
  const saveSubmissionLimits = () => {
    return saveSettings({
      submissionLimits: settings.submissionLimits,
    });
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