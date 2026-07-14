import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  LoadingSpinner,
  toastSuccess,
  toastError,
  EmptyState,
} from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { FormSettingsContainer } from '../../form-settings';
import { useFormSettings } from '../../../hooks/useFormSettings';
import { GET_FORM_BY_ID } from '../../../graphql/queries';
import { REGENERATE_SHORT_URL, UPDATE_FORM } from '../../../graphql/mutations';
import { getErrorDetails } from '../../../utils/graphqlErrors';
import { AlertCircle } from 'lucide-react';

interface SettingsTabProps {
  formId?: string;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ formId }) => {
  const { t } = useTranslation('formSettings');
  const { t: tErr } = useTranslation('graphqlErrors');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const {
    data: formData,
    loading: formLoading,
    error: formError,
    refetch,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const {
    settings,
    isSaving: settingsIsSaving,
    updateSetting,
    saveThankYouSettings,
    updateSubmissionLimits,
    saveSubmissionLimits,
    saveResponseCopySettings,
    updateAccessControl,
    saveAccessControlSettings,
    updateCollectRespondentEmail,
  } = useFormSettings({
    formId,
    initialSettings: formData?.form?.settings,
    onSuccess: () => {
      setErrors({});
      refetch();
    },
    onError: (error) => {
      setErrors({ general: error });
    },
  });

  const [updateForm] = useMutation(UPDATE_FORM, {
    onCompleted: () => {
      setIsSaving(false);
      setErrors({});
      refetch();
      toastSuccess(t('toasts.settingsSaved'));
    },
    onError: (error) => {
      setIsSaving(false);
      const { messageKey } = getErrorDetails(error);
      setErrors({ general: error.message });
      toastError(t('toasts.settingsSaveError'), tErr(messageKey));
    },
  });

  const [regenerateShortUrl] = useMutation(REGENERATE_SHORT_URL, {
    onCompleted: () => {
      setIsSaving(false);
      setErrors({});
      refetch();
      toastSuccess(t('toasts.shortUrlRegenerated'));
    },
    onError: (error) => {
      setIsSaving(false);
      const { messageKey } = getErrorDetails(error);
      setErrors({ general: error.message });
      toastError(t('toasts.shortUrlRegenerateError'), tErr(messageKey));
    },
  });

  const handleSaveGeneralSettings = async () => {
    if (!formId) return;

    setIsSaving(true);
    setErrors({});

    const titleInput = document.getElementById('form-title') as HTMLInputElement;
    const descriptionInput = document.getElementById('form-description') as HTMLTextAreaElement;

    const title = titleInput?.value.trim();
    const description = descriptionInput?.value.trim();

    if (!titleInput.value.trim()) {
      setErrors({ title: t('errors.formTitleRequired') });
      setIsSaving(false);
      toastError(t('errors.validationError'), t('errors.formTitleRequired'));
      return;
    }

    try {
      await updateForm({
        variables: {
          id: formId,
          input: {
            title,
            description,
          },
        },
      });
    } catch {
      // Error handled by onError callback
    }
  };

  const handleRegenerateShortUrl = async () => {
    if (!formId) return;

    setIsSaving(true);
    setErrors({});

    try {
      await regenerateShortUrl({
        variables: {
          id: formId,
        },
      });
    } catch {
      // Error handled by onError callback
    }
  };

  const handleUpdateThankYouSetting = (key: string, value: any) => {
    updateSetting('thankYou', key as keyof typeof settings.thankYou, value);
  };

  const handleUpdateResponseCopySetting = (key: string, value: any) => {
    updateSetting('responseCopy', key as keyof typeof settings.responseCopy, value);
  };

  if (formLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (formError || !formData?.form) {
    return (
      <div className="flex justify-center items-center h-full p-6">
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound')}
          description={t('errors.formNotFoundMessage')}
        />
      </div>
    );
  }

  const form = formData.form;

  if (form.userPermission === 'VIEWER' || form.userPermission === 'NO_ACCESS') {
    return (
      <div className="flex justify-center items-center h-full p-6">
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.accessDenied')}
          description={t('errors.accessDeniedMessage')}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: 'var(--tf-faint)' }}>
      <div className="space-y-5">
        <FormSettingsContainer
          form={form}
          settings={settings}
          isSaving={isSaving || settingsIsSaving}
          errors={errors}
          currentResponseCount={form?.responseCount || 0}
          onSaveGeneralSettings={handleSaveGeneralSettings}
          onRegenerateShortUrl={handleRegenerateShortUrl}
          onUpdateThankYouSetting={handleUpdateThankYouSetting}
          onSaveThankYouSettings={saveThankYouSettings}
          onUpdateSubmissionLimits={updateSubmissionLimits}
          onSaveSubmissionLimits={saveSubmissionLimits}
          onUpdateResponseCopySetting={handleUpdateResponseCopySetting}
          onSaveResponseCopySettings={saveResponseCopySettings}
          onUpdateAccessControl={updateAccessControl}
          onSaveAccessControlSettings={saveAccessControlSettings}
          onUpdateCollectRespondentEmail={updateCollectRespondentEmail}
        />

        {errors.general && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-lg)' }}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}
      </div>
    </div>
  );
};
