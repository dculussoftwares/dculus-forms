import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  Button,
  LoadingSpinner,
  toastSuccess,
  toastError,
  EmptyState,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { useTranslation } from '../hooks/useTranslation';
import { FormSettingsContainer } from '../components/form-settings';
import { useFormSettings } from '../hooks/useFormSettings';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { REGENERATE_SHORT_URL, UPDATE_FORM } from '../graphql/mutations';
import { getErrorDetails } from '../utils/graphqlErrors';
import {
  AlertCircle,
  ArrowLeft,
  Settings,
} from 'lucide-react';

const FormSettings: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
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

  // Use the custom hook for settings management
  const {
    settings,
    isSaving: settingsIsSaving,
    updateSetting,
    saveThankYouSettings,
    updateSubmissionLimits,
    saveSubmissionLimits,
  } = useFormSettings({
    formId,
    initialSettings: formData?.form?.settings,
    onSuccess: () => {
      setErrors({});
      refetch();
    },
    onError: (error) => {
      setErrors({ general: error });
      // Error toast is now handled in the hook
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

    // Get form values
    const titleInput = document.getElementById('form-title') as HTMLInputElement;
    const descriptionInput = document.getElementById('form-description') as HTMLTextAreaElement;

    const title = titleInput?.value.trim();
    const description = descriptionInput?.value.trim();

    // Basic validation
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

  if (formLoading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbFormDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbSettings'), href: `/dashboard/form/${formId}/settings` },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || !formData?.form) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
          { label: t('layout.title'), href: `/dashboard/form/${formId}/settings` },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound')}
          description={t('errors.formNotFoundMessage')}
        />
      </MainLayout>
    );
  }

  const form = formData.form;

  if (form.userPermission === 'VIEWER' || form.userPermission === 'NO_ACCESS') {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
          { label: form.title, href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbSettings'), href: `/dashboard/form/${formId}/settings` },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.accessDenied')}
          description={t('errors.accessDeniedMessage')}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={t('layout.titleWithForm', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbSettings'), href: `/dashboard/form/${formId}/settings` },
      ]}
    >
      <div className="space-y-5">
        {/* ── Typeform-style page header ── */}
        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid var(--tf-border-medium)' }}>
          <Button
            onClick={() => navigate(`/dashboard/form/${formId}`)}
            variant="ghost"
            className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'var(--tf-border)' }} />

          {/* Typeform field-icon style — lavender for settings */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
            <Settings className="h-4 w-4 text-[#5c2e6b]" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-primary">{t('header.title')}</h1>
            <p className="text-xs mt-0.5 text-muted-foreground">
              {t('header.description', { values: { formTitle: form.title } })}
            </p>
          </div>
        </div>

        {/* Settings container */}
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
        />

        {/* Error display */}
        {errors.general && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-lg)' }}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default FormSettings;
