import React, { useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { Button, FormRenderer, useFormResponseStore, LoadingSpinner } from '@dculus/ui';
import { deserializeFormSchema, FieldType } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { GET_FORM_BY_SHORT_URL, SUBMIT_RESPONSE } from '../graphql/queries';
import ThankYouDisplay from '../components/ThankYouDisplay';
import { useFormAnalytics } from '../hooks/useFormAnalytics';
import { useFormSubmissionAnalytics } from '../hooks/useFormSubmissionAnalytics';
import { getCdnEndpoint, getUploadUrl } from '../lib/config';
import { buildCompletionTimeInput } from '../lib/completionTime';
import { getFormErrorMessage, isSubmissionLimitError } from '../lib/formError';

const SUBMISSION_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB — matches backend multer limit
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateFiles(
  responses: Record<string, unknown>,
  formSchema: ReturnType<typeof deserializeFormSchema>
): string | null {
  // Build field-level limits from the schema
  const fieldLimits: Record<string, { maxMb: number; mimeTypes: string[] }> = {};
  for (const page of formSchema.pages) {
    for (const field of page.fields) {
      if (field.type === FieldType.FILE_UPLOAD_FIELD) {
        const f = field as { maxFileSizeMb?: number; allowedMimeTypes?: string[] } & typeof field;
        fieldLimits[field.id] = {
          maxMb: f.maxFileSizeMb ?? 50,
          mimeTypes: f.allowedMimeTypes ?? [],
        };
      }
    }
  }

  for (const [fieldId, value] of Object.entries(responses)) {
    if (!Array.isArray(value) || value[0] instanceof File === false) continue;
    const limits = fieldLimits[fieldId];
    const maxBytes = limits ? limits.maxMb * 1024 * 1024 : MAX_FILE_SIZE_BYTES;
    for (const file of value as File[]) {
      if (file.size > maxBytes) {
        return `File "${file.name}" exceeds the maximum allowed size of ${limits?.maxMb ?? 50} MB.`;
      }
      if (limits?.mimeTypes.length && !limits.mimeTypes.includes(file.type)) {
        return `File "${file.name}" has an unsupported type. Allowed: ${limits.mimeTypes.join(', ')}.`;
      }
    }
  }
  return null;
}

/**
 * Upload a single File to the backend REST endpoint and return its R2 storage key.
 */
async function uploadFormResponseFile(
  file: File,
  formId: string,
  uploadUrl: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'FormResponse');
  formData.append('formId', formId);

  const response = await fetch(uploadUrl, { method: 'POST', body: formData });

  if (!response.ok) {
    let body: { error?: string; code?: string } = {};
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

const FormViewer: React.FC = () => {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const cdnEndpoint = getCdnEndpoint();
  // Ref-based guard prevents double-submit even if React batches state updates slowly
  const isSubmittingRef = useRef(false);
  const [submissionState, setSubmissionState] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [submissionMessage, setSubmissionMessage] = useState<string>('');
  const [thankYouData, setThankYouData] = useState<{
    message: string;
    isCustom: boolean;
  } | null>(null);
  const [hasStartedForm, setHasStartedForm] = useState<boolean>(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { loading, error, data } = useQuery<any, any>(GET_FORM_BY_SHORT_URL, {
    variables: { shortUrl: shortUrl || '' },
    skip: !shortUrl,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [submitResponse] = useMutation<any, any>(SUBMIT_RESPONSE);

  // Track form analytics when form is loaded
  const { trackFormStartTime } = useFormAnalytics({
    formId: data?.formByShortUrl?.id || '',
    enabled: !!data?.formByShortUrl?.id,
  });

  // Hook for gathering submission analytics data
  const { getSubmissionAnalyticsData } = useFormSubmissionAnalytics({
    formId: data?.formByShortUrl?.id || '',
    enabled: !!data?.formByShortUrl?.id,
  });

  // Memoized deserialization — placed here (before any early returns) to satisfy Rules of Hooks
  const rawSchema = data?.formByShortUrl?.formSchema;
  const formSchema = useMemo(
    () => (rawSchema ? deserializeFormSchema(rawSchema) : null),
    [rawSchema]
  );

  // Handle first form interaction to track start time
  const handleFirstFormInteraction = () => {
    if (!hasStartedForm) {
      setHasStartedForm(true);
      trackFormStartTime();
    }
  };

  const handleFormSubmit = async (
    formId: string,
    responses: Record<string, unknown>
  ) => {
    // Synchronous guard — prevents double-submit even before React re-renders
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmissionState('submitting');
    setSubmissionMessage('');

    try {
      // Validate files client-side before uploading to give immediate feedback
      if (formSchema != null) {
        const fileError = validateFiles(responses, formSchema);
        if (fileError) {
          setSubmissionState('error');
          setSubmissionMessage(fileError);
          isSubmittingRef.current = false;
          return;
        }
      }

      // Upload any File[] values (from FILE_UPLOAD_FIELD) before submitting the response
      const processedResponses: Record<string, unknown> = { ...responses };
      const uploadUrl = getUploadUrl();

      const fileFieldEntries = Object.entries(processedResponses).filter(
        ([, value]) =>
          Array.isArray(value) && value.length > 0 && value[0] instanceof File
      );

      for (const [fieldId, files] of fileFieldEntries) {
        const keys = await Promise.all(
          (files as File[]).map((file) =>
            uploadFormResponseFile(file, formId, uploadUrl)
          )
        );
        processedResponses[fieldId] = keys;
      }
      // Get analytics data for submission tracking
      const analyticsData = getSubmissionAnalyticsData();

      // Calculate completion time if we have form start time
      let completionTimeSeconds = null;
      if (analyticsData) {
        const startTimeKey = `form_start_time_${analyticsData.sessionId}_${formId}`;
        const startTimeStr = localStorage.getItem(startTimeKey);
        if (startTimeStr) {
          const startTime = new Date(startTimeStr);
          const endTime = new Date();
          completionTimeSeconds = Math.round(
            (endTime.getTime() - startTime.getTime()) / 1000
          );

          // Clean up the stored start time
          localStorage.removeItem(startTimeKey);
        }
      }

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timed out. Please check your connection and try again.')),
          SUBMISSION_TIMEOUT_MS
        )
      );

      const result = await Promise.race([
        submitResponse({
          variables: {
            input: {
              formId,
              data: processedResponses,
              ...(analyticsData && {
                sessionId: analyticsData.sessionId,
                userAgent: analyticsData.userAgent,
                timezone: analyticsData.timezone,
                language: analyticsData.language,
                ...buildCompletionTimeInput(completionTimeSeconds),
              }),
            },
          },
        }),
        timeoutPromise,
      ]);

      const { thankYouMessage, showCustomThankYou } =
        result.data.submitResponse;

      setSubmissionState('success');
      setThankYouData({
        message: thankYouMessage,
        isCustom: showCustomThankYou,
      });
      // Leave isSubmittingRef true on success — form is done, no re-submit needed
    } catch (err: unknown) {
      console.error('Form submission error:', err);
      setSubmissionState('error');
      setSubmissionMessage(
        (err instanceof Error ? err.message : null) ||
          'An error occurred while submitting the form. Please try again.'
      );
      isSubmittingRef.current = false; // allow retry on error
    }
  };

  if (loading) {
    return (
      <div
        className="h-screen w-full"
        data-testid="form-viewer-loading"
      >
        <LoadingSpinner fullScreen size="md" />
      </div>
    );
  }

  if (error) {
    const errorCode = (CombinedGraphQLErrors.is(error) ? error.errors[0]?.extensions?.code : undefined) as string | undefined;
    const limitError = isSubmissionLimitError(errorCode);

    return (
      <div
        className="h-screen w-full flex items-center justify-center"
        data-testid="form-viewer-error"
      >
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-destructive mb-2">
            {limitError ? 'Form Unavailable' : 'Form Not Found'}
          </h1>
          <p
            className="text-muted-foreground mb-4"
            data-testid="form-viewer-error-message"
          >
            {getFormErrorMessage(errorCode)}
          </p>
        </div>
      </div>
    );
  }

  if (!data?.formByShortUrl) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Form Not Found
          </h1>
          <p className="text-muted-foreground">
            The form you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const form = data.formByShortUrl;

  // Check if form schema exists
  if (!form.formSchema) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Form Not Ready
          </h1>
          <p className="text-muted-foreground">
            This form is not yet configured. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  // Client-side time-window pre-validation — gives immediate feedback instead of
  // waiting for the server to reject the submission after filling out the form.
  const timeWindow = form.settings?.submissionLimits?.timeWindow as
    | { enabled?: boolean; startDate?: string; endDate?: string }
    | undefined;
  if (timeWindow?.enabled) {
    const now = new Date();
    if (timeWindow.startDate && ISO_DATE_RE.test(timeWindow.startDate)) {
      const start = new Date(timeWindow.startDate + 'T00:00:00');
      if (!isNaN(start.getTime()) && now < start) {
        return (
          <div className="h-screen w-full flex items-center justify-center">
            <div className="text-center p-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Not Yet Open</h1>
              <p className="text-muted-foreground">This form is not yet open for submissions. Please check back later.</p>
            </div>
          </div>
        );
      }
    }
    if (timeWindow.endDate && ISO_DATE_RE.test(timeWindow.endDate)) {
      const end = new Date(timeWindow.endDate + 'T23:59:59');
      if (!isNaN(end.getTime()) && now > end) {
        return (
          <div className="h-screen w-full flex items-center justify-center">
            <div className="text-center p-8">
              <h1 className="text-2xl font-bold text-destructive mb-2">Submissions Closed</h1>
              <p className="text-muted-foreground">The submission period for this form has ended.</p>
            </div>
          </div>
        );
      }
    }
  }

  const handleSubmitAnother = () => {
    useFormResponseStore.getState().clearAllResponses();
    isSubmittingRef.current = false;
    setSubmissionState('idle');
    setThankYouData(null);
    setHasStartedForm(false);
  };

  // Show success message after submission
  if (submissionState === 'success' && thankYouData) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="w-full">
          <ThankYouDisplay
            message={thankYouData.message}
            isCustom={thankYouData.isCustom}
          />
          <div className="text-center mt-6">
            <Button
              onClick={handleSubmitAnother}
              className="px-4 py-2"
            >
              Submit Another Response
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render the form in fullscreen mode
  return (
    <div className="h-screen w-full" data-testid="form-viewer-renderer">
      {/* Submission error message */}
      {submissionState === 'error' && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 m-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-destructive"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-destructive">{submissionMessage}</p>
            </div>
            <div className="ml-auto">
              <Button
                onClick={() => setSubmissionState('idle')}
                variant="ghost"
                className="text-destructive hover:text-destructive/80 h-auto p-0"
                aria-label="Dismiss"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      )}

      <FormRenderer
        cdnEndpoint={cdnEndpoint}
        formSchema={formSchema!}
        mode={RendererMode.SUBMISSION}
        className="h-full w-full"
        formId={form.id}
        onFormSubmit={handleFormSubmit}
        onResponseChange={handleFirstFormInteraction}
      />

      {/* Loading overlay during submission */}
      {submissionState === 'submitting' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3">
              <LoadingSpinner fullScreen={false} size="sm" />
              <div>
                <p className="text-lg font-medium text-foreground">
                  Submitting...
                </p>
                <p className="text-sm text-muted-foreground">
                  Please wait while we save your response.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormViewer;
