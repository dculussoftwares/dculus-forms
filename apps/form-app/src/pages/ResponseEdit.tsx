import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { FormRenderer } from '@dculus/ui';
import { RendererMode } from '@dculus/utils';
import { deserializeFormSchema } from '@dculus/types';
import { GET_FORM_BY_ID, GET_RESPONSE_BY_ID, UPDATE_RESPONSE } from '../graphql/queries';
import { MainLayout } from '../components/MainLayout';
import { Button, LoadingSpinner, toastSuccess, toastError } from '@dculus/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';

const ResponseEdit: React.FC = () => {
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
  const [updateResponseMutation] = useMutation(UPDATE_RESPONSE);

  const handleResponseUpdate = async (responseId: string, data: Record<string, any>) => {
    if (!responseId) return;

    setIsSubmitting(true);
    try {
      await updateResponseMutation({
        variables: {
          input: { responseId, data }
        }
      });

      toastSuccess('Response updated successfully', 'Your changes have been saved');
      navigate(`/dashboard/form/${formId}/responses/table`);
    } catch (error: any) {
      console.error('Failed to update response:', error);
      toastError('Failed to update response', error.message || 'An error occurred while updating the response');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (formLoading || responseLoading) {
    return (
      <MainLayout
        title="Edit Response"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Responses', href: `/dashboard/form/${formId}/responses` },
          { label: 'Table View', href: `/dashboard/form/${formId}/responses/table` },
          { label: 'Edit Response', href: `/dashboard/form/${formId}/responses/${responseId}/edit` },
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
        title="Edit Response"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Responses', href: `/dashboard/form/${formId}/responses` },
          { label: 'Table View', href: `/dashboard/form/${formId}/responses/table` },
          { label: 'Edit Response', href: `/dashboard/form/${formId}/responses/${responseId}/edit` },
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-sm border border-slate-200/60">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">
              {!formData?.form ? 'Form Not Found' : 'Response Not Found'}
            </h3>
            <p className="text-slate-600 mb-4">
              {!formData?.form
                ? "The form you're looking for doesn't exist or you don't have permission to view it."
                : "The response you're trying to edit doesn't exist or you don't have permission to edit it."}
            </p>
            <Button
              onClick={() => navigate(`/dashboard/form/${formId}/responses/table`)}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Responses
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
        title="Edit Response"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${formId}` },
          { label: 'Responses', href: `/dashboard/form/${formId}/responses` },
          { label: 'Table View', href: `/dashboard/form/${formId}/responses/table` },
          { label: 'Edit Response', href: `/dashboard/form/${formId}/responses/${responseId}/edit` },
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-sm border border-slate-200/60">
            <AlertCircle className="mx-auto h-12 w-12 text-orange-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">Form Not Ready</h3>
            <p className="text-slate-600 mb-4">
              This form is not yet configured. Please try again later.
            </p>
            <Button
              onClick={() => navigate(`/dashboard/form/${formId}/responses/table`)}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Responses
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Deserialize the form schema from the backend
  const formSchema = deserializeFormSchema(form.formSchema);
  const cdnEndpoint = (import.meta as any).env?.VITE_CDN_ENDPOINT;

  return (
    <MainLayout
      title={`Edit Response - ${form.title}`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: 'Responses', href: `/dashboard/form/${formId}/responses` },
        { label: 'Table View', href: `/dashboard/form/${formId}/responses/table` },
        { label: 'Edit Response', href: `/dashboard/form/${formId}/responses/${responseId}/edit` },
      ]}
    >
      {/* Header with back button */}
      <div className="flex items-center gap-4 p-4 border-b border-slate-200/40 bg-white flex-shrink-0 w-full overflow-hidden rounded-t-lg mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/dashboard/form/${formId}/responses/table`)}
          className="hover:bg-slate-100 flex-shrink-0"
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Table
        </Button>
        <div className="h-4 w-px bg-slate-300 flex-shrink-0" />
        <h1 className="text-lg font-semibold text-slate-900 truncate flex-1">
          Editing Response {response.id.slice(-6)}
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
                  <p className="text-lg font-medium text-gray-900">Updating...</p>
                  <p className="text-sm text-gray-500">Please wait while we save your changes.</p>
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