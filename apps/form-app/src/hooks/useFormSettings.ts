import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react';
import { UPDATE_FORM } from '../graphql/mutations';
import type { SubmissionLimitsSettings, ResponseCopySettings, AccessControlSettings, QuizSettings } from '@dculus/types';
import { toastSuccess, toastError, toastInfo } from '@dculus/ui';
import { getErrorDetails } from '../utils/graphqlErrors';
import { useTranslation } from './useTranslation';

interface FormSettingsData {
  submissionLimits: SubmissionLimitsSettings;
  responseCopy: ResponseCopySettings;
  accessControl: AccessControlSettings;
  collectRespondentEmail: boolean;
  // Absent (not `{}`) for a form that has never opened the Quiz panel — see
  // the additive guarantee in epic #289: an unrelated settings save must not
  // introduce a `quiz` key for a form that was never a quiz.
  quiz?: QuizSettings;
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
  const { t: tQuiz } = useTranslation('quizSettings');

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
        // Preserve absence: `initialSettings.quiz` is `null` (not present in
        // the DB), not `undefined` (GraphQL always resolves the field key) —
        // normalize both to `undefined` so a non-quiz form's state never
        // carries a `quiz` key into the next unrelated settings save.
        quiz: initialSettings.quiz ?? undefined,
      }));
    }
  }, [initialSettings]);

  // Update nested settings helper — restricted to the always-present
  // object-valued sections, since `collectRespondentEmail` is a plain
  // boolean and can't be spread as `{ ...prev[section] }`. `quiz` is
  // deliberately not listed here — it's optional (`QuizSettings |
  // undefined`, absent for non-quiz forms) and has its own dedicated
  // updateQuizSettings below instead.
  type ObjectSettingKey = 'submissionLimits' | 'responseCopy' | 'accessControl';

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

    // Strip __typename fields from the settings object
    const cleanedSettings = stripTypename({ ...settings, ...settingsToSave });

    const result = await updateForm({
      variables: {
        id: formId,
        input: {
          settings: cleanedSettings,
        },
      },
    });

    // The Apollo client is configured with `mutate: { errorPolicy: 'all' }`
    // (see services/apolloClient.ts), so a GraphQL error (e.g. the backend
    // rejecting invalid quiz settings) resolves this promise instead of
    // rejecting it — the mutation's own `onError` callback still surfaces a
    // toastError, but without this throw every saveXxxSettings caller below
    // would fall through to its own toastSuccess on top of that.
    if (result.error) {
      throw result.error;
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

  // Epic #289 D9 (Story 17, #321): a deferred grade release ('afterReview' /
  // 'scheduled') can only ever be delivered to a respondent this form can
  // identify later. If an identity-capture edit here would leave the form
  // with neither accessControl.enabled nor collectRespondentEmail while
  // quiz mode still has one of those release modes selected, auto-downgrade
  // to 'immediate' (with a toast) rather than leaving a combination the
  // server would reject on save.
  const downgradeDeferredGradeReleaseIfUnreachable = (
    prev: FormSettingsData,
    nextAccessControl: AccessControlSettings,
    nextCollectRespondentEmail: boolean
  ): FormSettingsData => {
    const requiresIdentity = !!nextAccessControl?.enabled || !!nextCollectRespondentEmail;
    const hasDeferredRelease =
      prev.quiz?.enabled &&
      (prev.quiz.gradeRelease === 'afterReview' || prev.quiz.gradeRelease === 'scheduled');

    if (requiresIdentity || !hasDeferredRelease) {
      return { ...prev, accessControl: nextAccessControl, collectRespondentEmail: nextCollectRespondentEmail };
    }

    toastInfo(tQuiz('toasts.gradeReleaseDowngraded.title'), tQuiz('toasts.gradeReleaseDowngraded.description'));
    return {
      ...prev,
      accessControl: nextAccessControl,
      collectRespondentEmail: nextCollectRespondentEmail,
      quiz: { ...prev.quiz!, gradeRelease: 'immediate', releaseAt: undefined },
    };
  };

  // Update access control
  const updateAccessControl = (accessControl: AccessControlSettings) => {
    setSettings(prev =>
      downgradeDeferredGradeReleaseIfUnreachable(prev, accessControl, prev.collectRespondentEmail)
    );
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
    setSettings(prev =>
      downgradeDeferredGradeReleaseIfUnreachable(prev, prev.accessControl, collectRespondentEmail)
    );
  };

  // Update quiz settings
  const updateQuizSettings = (quiz: QuizSettings) => {
    setSettings(prev => ({
      ...prev,
      quiz,
    }));
  };

  // Save quiz settings. This panel only ever writes settings.quiz — it never
  // touches formSchema (answer keys live on the fields, not here).
  const saveQuizSettings = async () => {
    try {
      await saveSettings({
        quiz: settings.quiz,
      });
      toastSuccess(tQuiz('toasts.saved'));
    } catch {
      // Error already handled in the mutation onError callback
    }
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
    updateQuizSettings,
    saveQuizSettings,
  };
};
