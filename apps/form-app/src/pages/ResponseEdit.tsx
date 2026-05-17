import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import { FormRenderer } from '@dculus/ui';
import { RendererMode } from '@dculus/utils';
import { deserializeFormSchema } from '@dculus/types';
import { FieldType } from '@dculus/types';
import {
  GET_FORM_BY_ID,
  GET_RESPONSE_BY_ID,
  UPDATE_RESPONSE,
  GET_FORM_RESPONSES,
} from '../graphql/queries';
import { DELETE_FILE } from '../graphql/templates';
import { MainLayout } from '../components/MainLayout';
import { Button, LoadingSpinner, toastSuccess, toastError, EmptyState } from '@dculus/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { getCdnEndpoint, getUploadUrl } from '../lib/config';

/**
 * Upload a single File to the backend REST endpoint and return its R2 storage key.
 * Sends auth cookies so the server can verify the user has form access even when the
 * form is not published.
 */
async function uploadEditResponseFile(
  file: File,
  formId: string,
  uploadUrl: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'FormResponse');
  formData.append('formId', formId);
  formData.append('editMode', 'true');

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    credentials: 'include', // send auth cookie so server can bypass isPublished check
  });

  if (!response.ok) {
    let body: { error?: string } = {};
    try {
      body = await response.json();
    } catch {
      /* non-JSON body */
    }
    throw new Error(body.error ?? `Upload failed (${response.status})`);
  }

  const data = (await response.json()) as { key: string };
  return data.key;
}

const ResponseEdit: React.FC = () => {
  const { t } = useTranslation('responseEdit');
  const { formId, responseId } = useParams<{
    formId: string;
    responseId: string;
  }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch form data
  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  // Fetch response data
  const {
    data: responseData,
    loading: responseLoading,
    error: responseError,
  } = useQuery(GET_RESPONSE_BY_ID, {
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
          sortBy: 'submittedAt',
          sortOrder: 'desc',
        },
      },
    ],
    // Update cache optimistically for better UX
    awaitRefetchQueries: true,
  });

  const [deleteFileMutation] = useMutation(DELETE_FILE);

  const handleResponseUpdate = async (
    responseId: string,
    data: Record<string, any>
  ) => {
    if (!responseId) return;

    setIsSubmitting(true);
    try {
      // ── File upload handling ────────────────────────────────────────────────
      // The form renderer stores file field values as (string | File)[]:
      //   strings  = existing R2 keys loaded from the original response
      //   File     = newly picked files that must be uploaded first
      // We also diff against the original response data to find removed keys.
      const originalData: Record<string, any> =
        responseData?.response?.data ?? {};
      const processedData: Record<string, any> = { ...data };
      const uploadUrl = getUploadUrl();

      // Collect all FILE_UPLOAD_FIELD ids from the form schema
      const fileFieldIds = new Set<string>();
      if (formData?.form?.formSchema) {
        const schema = deserializeFormSchema(formData.form.formSchema);
        for (const page of schema.pages) {
          for (const field of page.fields) {
            if (field.type === FieldType.FILE_UPLOAD_FIELD) {
              fileFieldIds.add(field.id);
            }
          }
        }
      }

      for (const fieldId of fileFieldIds) {
        const rawValue = processedData[fieldId];
        if (!Array.isArray(rawValue)) continue;

        const existingKeys = rawValue.filter(
          (v): v is string => typeof v === 'string'
        );
        const newFiles = rawValue.filter((v): v is File => v instanceof File);

        // Upload new files → get R2 keys
        const newKeys = await Promise.all(
          newFiles.map((file) =>
            uploadEditResponseFile(file, formId!, uploadUrl)
          )
        );

        // Delete R2 objects for keys removed by the user
        const originalKeys: string[] = Array.isArray(originalData[fieldId])
          ? (originalData[fieldId] as string[]).filter(
              (v) => typeof v === 'string'
            )
          : [];
        const removedKeys = originalKeys.filter(
          (k) => !existingKeys.includes(k)
        );
        await Promise.all(
          removedKeys.map((key) =>
            deleteFileMutation({ variables: { key } }).catch((err) =>
              // Non-fatal: log but don't block the save
              console.error('Failed to delete removed file:', key, err)
            )
          )
        );

        // Final value for this field: kept existing + newly uploaded
        processedData[fieldId] = [...existingKeys, ...newKeys];
      }
      // ── End file handling ───────────────────────────────────────────────────

      await updateResponseMutation({
        variables: {
          input: { responseId, data: processedData },
        },
      });

      toastSuccess(
        t('toasts.updateSuccess.title'),
        t('toasts.updateSuccess.description')
      );
      navigate(`/dashboard/form/${formId}/responses/${responseId}/history`);
    } catch (error: any) {
      console.error('Error updating response:', error);
      toastError(
        t('toasts.updateError.title'),
        error.message || t('toasts.updateError.description')
      );
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
          {
            label: t('layout.breadcrumbs.formDashboard'),
            href: `/dashboard/form/${formId}`,
          },
          {
            label: t('layout.breadcrumbs.responses'),
            href: `/dashboard/form/${formId}/responses`,
          },
          {
            label: t('layout.breadcrumbs.editResponse'),
            href: `/dashboard/form/${formId}/responses/${responseId}/edit`,
          },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  // Permission guard — editing responses requires at least EDITOR access.
  // The backend enforces this too, but redirect early for a clean UX.
  const userPermission = formData?.form?.userPermission as string | undefined;
  if (!formLoading && !responseLoading && formData?.form) {
    if (userPermission !== 'EDITOR' && userPermission !== 'OWNER') {
      navigate(`/dashboard/form/${formId}/responses`, { replace: true });
      toastError(
        t('errors.noPermission.title'),
        t('errors.noPermission.description')
      );
      return null;
    }
  }

  if (
    formError ||
    responseError ||
    !formData?.form ||
    !responseData?.response
  ) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          {
            label: t('layout.breadcrumbs.formDashboard'),
            href: `/dashboard/form/${formId}`,
          },
          {
            label: t('layout.breadcrumbs.responses'),
            href: `/dashboard/form/${formId}/responses`,
          },
          {
            label: t('layout.breadcrumbs.editResponse'),
            href: `/dashboard/form/${formId}/responses/${responseId}/edit`,
          },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6" style={{ color: '#ce5d55' }} />}
          title={!formData?.form ? t('errors.formNotFound.title') : t('errors.responseNotFound.title')}
          description={!formData?.form ? t('errors.formNotFound.description') : t('errors.responseNotFound.description')}
          action={
            <Button onClick={() => navigate(`/dashboard/form/${formId}/responses`)} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('navigation.backToResponses')}
            </Button>
          }
        />
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
          {
            label: t('layout.breadcrumbs.formDashboard'),
            href: `/dashboard/form/${formId}`,
          },
          {
            label: t('layout.breadcrumbs.responses'),
            href: `/dashboard/form/${formId}/responses`,
          },
          {
            label: t('layout.breadcrumbs.editResponse'),
            href: `/dashboard/form/${formId}/responses/${responseId}/edit`,
          },
        ]}
      >
        <EmptyState
          variant="warning"
          icon={<AlertCircle className="h-6 w-6" style={{ color: '#8b6a18' }} />}
          title={t('errors.formNotReady.title')}
          description={t('errors.formNotReady.description')}
          action={
            <Button onClick={() => navigate(`/dashboard/form/${formId}/responses`)} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('navigation.backToResponses')}
            </Button>
          }
        />
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
        {
          label: t('layout.breadcrumbs.responses'),
          href: `/dashboard/form/${formId}/responses`,
        },
        {
          label: t('layout.breadcrumbs.tableView'),
          href: `/dashboard/form/${formId}/responses`,
        },
        {
          label: t('layout.breadcrumbs.editResponse'),
          href: `/dashboard/form/${formId}/responses/${responseId}/edit`,
        },
      ]}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 pb-4 mb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(81,76,84,0.10)' }}
      >
        <button
          onClick={() => navigate(`/dashboard/form/${formId}/responses`)}
          disabled={isSubmitting}
          className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors shrink-0 disabled:opacity-40"
          style={{ color: '#655d67' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(87,84,91,0.06)'; (e.currentTarget as HTMLElement).style.color = '#3c323e'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#655d67'; }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'rgba(81,76,84,0.12)' }} />
        <h1 className="text-sm font-semibold truncate flex-1" style={{ color: '#3c323e' }}>
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
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(42,34,43,0.5)' }}>
            <div className="rounded-xl p-6 max-w-sm mx-4" style={{ backgroundColor: 'white', boxShadow: '0 20px 48px rgba(60,50,62,0.20)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: 'rgba(81,76,84,0.15)', borderTopColor: '#3c323e' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#3c323e' }}>{t('loading.updating')}</p>
                  <p className="text-xs" style={{ color: '#655d67' }}>{t('loading.pleaseWait')}</p>
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
