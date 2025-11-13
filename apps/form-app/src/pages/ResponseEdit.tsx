import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import { FormRenderer } from '@dculus/ui';
import { RendererMode } from '@dculus/utils';
import { deserializeFormSchema } from '@dculus/types';
import { GET_FORM_BY_ID, GET_RESPONSE_BY_ID, UPDATE_RESPONSE, GET_FORM_RESPONSES } from '../graphql/queries';
import { MainLayout } from '../components/MainLayout';
import { Button, LoadingSpinner, toastSuccess, toastError } from '@dculus/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { getCdnEndpoint } from '../lib/config';

const ResponseEdit: React.FC = () => {
  const { t } = useTranslation('responseEdit');
  const { formId, responseId } = useParams<{ formId: string; responseId: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch form data
  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  // Fetch response data
  const { data: responseData, loading: responseLoading, error: responseError } = useQuery(GET_RESPONSE_BY_ID, {
    variables: { id: responseId },
    skip: !responseId,
  });

  // Update response mutation
  const [updateResponseMutation] = useMutation(UPDATE_RESPONSE, {
    // Refetch queries to update the cache after successful update
    refetchQueries: [
      {
        query: GET_FORM_RESPONSES,
        variables: {
          formId: formId,
          page: 1,
          limit: 20,
          sortBy: "submittedAt",
          sortOrder: "desc"
        }
      }
    ],
    // Update cache optimistically for better UX
    awaitRefetchQueries: true
  });

  const handleResponseUpdate = async (responseId: string, data: Record<string, any>) => {
    if (!responseId) return;

    setIsSubmitting(true);
    try {
      await updateResponseMutation({
        variables: {
          input: { responseId, data }
        }
      });

      toastSuccess(t('toasts.updateSuccess.title'), t('toasts.updateSuccess.description'));
      navigate(`/dashboard/form/${formId}/responses/${responseId}/history`);
    } catch (error: any) {
      console.error('Error updating response:', error);
      toastError(t('toasts.updateError.title'), error.message || t('toasts.updateError.description'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (formLoading || responseLoading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${formId}/responses` },
          { label: t('layout.breadcrumbs.editResponse'), href: `/dashboard/form/${formId}/responses/${responseId}/edit` },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || responseError || !formData?.form || !responseData?.response) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${formId}/responses` },
          { label: t('layout.breadcrumbs.editResponse'), href: `/dashboard/form/${formId}/responses/${responseId}/edit` },
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-sm border border-slate-200/60">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">
              {!formData?.form ? t('errors.formNotFound.title') : t('errors.responseNotFound.title')}
            </h3>
            <p className="text-slate-600 mb-4">
              {!formData?.form
                ? t('errors.formNotFound.description')
                : t('errors.responseNotFound.description')}
            </p>
            <Button
              onClick={() => navigate(`/dashboard/form/${formId}/responses`)}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('navigation.backToResponses')}
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;
  const response = responseData.response;

  // Check if form schema exists
  if (!form.formSchema) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${formId}/responses` },
          { label: t('layout.breadcrumbs.editResponse'), href: `/dashboard/form/${formId}/responses/${responseId}/edit` },
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-sm border border-slate-200/60">
            <AlertCircle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">{t('errors.formNotReady.title')}</h3>
            <p className="text-slate-600 mb-4">
              {t('errors.formNotReady.description')}
            </p>
            <Button
              onClick={() => navigate(`/dashboard/form/${formId}/responses`)}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('navigation.backToResponses')}
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Deserialize the form schema from the backend
  const formSchema = deserializeFormSchema(form.formSchema);
  const cdnEndpoint = getCdnEndpoint();

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbs.responses'), href: `/dashboard/form/${formId}/responses` },
        { label: t('layout.breadcrumbs.tableView'), href: `/dashboard/form/${formId}/responses` },
        { label: t('layout.breadcrumbs.editResponse'), href: `/dashboard/form/${formId}/responses/${responseId}/edit` },
      ]}
    >
      {/* Header with back button */}
      <div className="flex items-center gap-4 p-4 border-b border-slate-200/40 bg-white flex-shrink-0 w-full overflow-hidden rounded-t-lg mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/dashboard/form/${formId}/responses`)}
          className="hover:bg-slate-100 flex-shrink-0"
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('navigation.backToResponses')}
        </Button>
        <div className="h-4 w-px bg-slate-300 flex-shrink-0" />
        <h1 className="text-lg font-semibold text-slate-900 truncate flex-1">
          {t('header.editingResponse', { values: { responseId: response.id.slice(-6) } })}
        </h1>
      </div>

      {/* Form renderer in edit mode */}
      <div className="h-full w-full">
        <FormRenderer
          cdnEndpoint={cdnEndpoint}
          formSchema={formSchema}
          mode={RendererMode.EDIT}
          existingResponseData={response.data}
          responseId={responseId}
          onResponseUpdate={handleResponseUpdate}
          className="h-full w-full"
          formId={formId}
        />

        {/* Loading overlay during submission */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <div>
                  <p className="text-lg font-medium text-gray-900">{t('loading.updating')}</p>
                  <p className="text-sm text-gray-500">{t('loading.pleaseWait')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ResponseEdit;