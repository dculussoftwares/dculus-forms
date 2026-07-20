import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { LoadingSpinner, EmptyState } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import ThankYouSettings from '../../form-settings/ThankYouSettings';
import { useFormSettings } from '../../../hooks/useFormSettings';
import { GET_FORM_BY_ID } from '../../../graphql/queries';
import { AlertCircle } from 'lucide-react';

interface FinishTabProps {
  formId?: string;
}

export const FinishTab: React.FC<FinishTabProps> = ({ formId }) => {
  const { t } = useTranslation('formSettings');
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

  const { settings, isSaving, updateSetting, saveThankYouSettings } = useFormSettings({
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
      <div className="max-w-2xl mx-auto space-y-5">
        <ThankYouSettings
          form={form}
          settings={settings.thankYou}
          isSaving={isSaving}
          onToggleEnabled={(enabled) => updateSetting('thankYou', 'enabled', enabled)}
          onMessageChange={(message) => updateSetting('thankYou', 'message', message)}
          onSave={saveThankYouSettings}
        />

        {errors.general && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs"
            style={{
              backgroundColor: 'var(--tf-error-bg)',
              color: 'var(--tf-error)',
              border: '1px solid var(--tf-error-bg-lg)',
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}
      </div>
    </div>
  );
};
