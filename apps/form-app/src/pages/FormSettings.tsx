import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import {
  Button,
  Card,
  CardContent,
  LoadingSpinner,
  Separator,
  TypographyH1,
  TypographyH3,
  TypographyP,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { useTranslation } from '../hooks/useTranslation';
import { FormSettingsContainer } from '../components/form-settings';
import { useFormSettings } from '../hooks/useFormSettings';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { REGENERATE_SHORT_URL, UPDATE_FORM } from '../graphql/mutations';
import {
  AlertCircle,
  ArrowLeft,
  Settings,
} from 'lucide-react';

const FormSettings: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('formSettings');
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
      setErrors({ general: error.message });
      toastError(t('toasts.settingsSaveError'), error.message);
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
      setErrors({ general: error.message });
      toastError(t('toasts.shortUrlRegenerateError'), error.message);
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
          {
            label: t('layout.title'),
            href: `/dashboard/form/${formId}/settings`,
          },
        ]}
      >
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <TypographyH3 className="mb-2">{t('errors.formNotFound')}</TypographyH3>
            <TypographyP className="text-slate-600">
              {t('errors.formNotFoundMessage')}
            </TypographyP>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;

  return (
    <MainLayout
      title={t('layout.titleWithForm', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbSettings'), href: `/dashboard/form/${formId}/settings` },
      ]}
    >
      <div className="px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col space-y-6">
          {/* Back Navigation */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/dashboard/form/${formId}`)}
            className="w-fit -ml-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('header.backButton')}
          </Button>
          
          {/* Main Header */}
          <div className="flex items-start gap-5">
            {/* Icon Container */}
            <div className="bg-blue-50 p-3 rounded-xl">
              <Settings className="h-5 w-5 text-blue-600" />
            </div>
            
            {/* Title and Description */}
            <div className="flex-1 min-w-0">
              <TypographyH1 className="text-2xl font-semibold tracking-tight mb-1">
                {t('header.title')}
              </TypographyH1>
              <TypographyP className="text-muted-foreground text-sm">
                {t('header.description', { values: { formTitle: form.title } })}
              </TypographyP>
            </div>
          </div>
        </div>

        <Separator />

        {/* Settings Container */}
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

        {/* Error Display */}
        {errors.general && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700">{errors.general}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default FormSettings;
