import React, { useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { Button, FormRenderer, useFormResponseStore, LoadingSpinner } from '@dculus/ui';
import { deserializeFormSchema, extractEmailFields, FieldType } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { GET_FORM_BY_SHORT_URL, SUBMIT_RESPONSE } from '../graphql/queries';
import { useFormAnalytics } from '../hooks/useFormAnalytics';
import { useFormSubmissionAnalytics } from '../hooks/useFormSubmissionAnalytics';
import { getCdnEndpoint, getUploadUrl } from '../lib/config';
import { buildCompletionTimeInput } from '../lib/completionTime';
import { getFormErrorMessage, isSubmissionLimitError, isAccessControlError } from '../lib/formError';
import SignInGate from '../components/SignInGate';
import AccessDeniedScreen from '../components/AccessDeniedScreen';
import { signOut } from '../lib/auth-client';

const SUBMISSION_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB — matches backend multer limit

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
    copyEmail?: string;
  } | null>(null);
  const [hasStartedForm, setHasStartedForm] = useState<boolean>(false);
  const [sendResponseCopy, setSendResponseCopy] = useState<boolean>(false);
  // Set when a submit fails with SIGN_IN_REQUIRED/EMAIL_DOMAIN_NOT_ALLOWED
  // (token expired/revoked mid-fill) — renders the gate as an overlay ON TOP
  // of the still-mounted FormRenderer so in-progress answers survive.
  const [needsReauth, setNeedsReauth] = useState<boolean>(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { loading, error, data, refetch } = useQuery(GET_FORM_BY_SHORT_URL, {
    variables: { shortUrl: shortUrl || '' },
    skip: !shortUrl,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [submitResponse] = useMutation(SUBMIT_RESPONSE);

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
  const rawSchema = data?.formByShortUrl?.formSchemaPublic;
  const formSchema = useMemo(
    () => (rawSchema ? deserializeFormSchema(rawSchema) : null),
    [rawSchema]
  );

  // "Send me a copy of my responses" — only offered when the form owner enabled
  // it AND the configured recipient field still exists on the form (it could
  // have been deleted/renamed since the setting was saved).
  const responseCopyRawSettings = data?.formByShortUrl?.settings?.responseCopy;
  const responseCopyEmailFieldId: string | undefined = responseCopyRawSettings?.emailFieldId;
  const responseCopySettings = useMemo(() => {
    if (!responseCopyRawSettings?.enabled || !responseCopyEmailFieldId || !formSchema) return undefined;
    const hasConfiguredEmailField = extractEmailFields(formSchema).some(
      (f) => f.id === responseCopyEmailFieldId
    );
    if (!hasConfiguredEmailField) return undefined;
    return { enabled: true as const, mode: responseCopyRawSettings.mode };
  }, [responseCopyRawSettings, responseCopyEmailFieldId, formSchema]);

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

      // If the checkbox was checked but the recipient field ended up blank
      // (e.g. it's optional and the respondent skipped it), don't tell the
      // backend to send — it would silently skip anyway, but this keeps the
      // "we sent you a copy" thank-you message from showing when nothing was sent.
      const copyRecipientEmail = responseCopyEmailFieldId
        ? (processedResponses[responseCopyEmailFieldId] as string | undefined)?.trim()
        : undefined;
      const effectiveSendResponseCopy =
        sendResponseCopy && (!responseCopyEmailFieldId || Boolean(copyRecipientEmail));

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
              sendResponseCopy: effectiveSendResponseCopy,
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

      const { thankYouMessage } = result.data.submitResponse;

      setSubmissionState('success');
      setThankYouData({
        message: thankYouMessage,
        // Optimistic client-side note only — the actual email send is async/
        // fire-and-forget server-side, so there's no real delivery confirmation here.
        copyEmail:
          effectiveSendResponseCopy || responseCopySettings?.mode === 'always'
            ? copyRecipientEmail
            : undefined,
      });
      // Leave isSubmittingRef true on success — form is done, no re-submit needed
    } catch (err: unknown) {
      console.error('Form submission error:', err);

      const errorCode = (CombinedGraphQLErrors.is(err) ? err.errors[0]?.extensions?.code : undefined) as string | undefined;
      if (isAccessControlError(errorCode)) {
        // A real sign-out (not just clearing the local token) — better-auth
        // also sets a session cookie independent of the bearer plugin, and
        // that cookie alone would otherwise keep re-authenticating the
        // rejected identity on the next attempt.
        void signOut();
        setSubmissionState('idle');
        setNeedsReauth(true);
        isSubmittingRef.current = false;
        return;
      }

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
        <div className="text-center p-4 sm:p-8">
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
      <div className="h-screen w-full flex items-center justify-center" data-testid="form-viewer-error">
        <div className="text-center p-4 sm:p-8">
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
  const allowedDomains = form.settings?.accessControl?.allowedDomains;

  // Access control is checked before the "form not ready" guard below —
  // `formSchemaPublic` is deliberately null while gated (see the backend
  // field resolver), so that guard must not fire for a legitimately-gated form.
  if (form.accessStatus === 'SIGN_IN_REQUIRED') {
    return (
      <SignInGate
        formTitle={form.title}
        allowedDomains={allowedDomains}
        onSignedIn={() => refetch()}
      />
    );
  }

  if (form.accessStatus === 'DOMAIN_REJECTED') {
    return (
      <AccessDeniedScreen
        allowedDomains={allowedDomains}
        onSwitchAccount={() => refetch()}
      />
    );
  }

  // Check if form schema exists
  if (!form.formSchemaPublic) {
    return (
      <div className="h-screen w-full flex items-center justify-center" data-testid="form-viewer-error">
        <div className="text-center p-4 sm:p-8">
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

  // Time-window gating is enforced server-side by formByShortUrl (see
  // apps/backend/src/lib/timeWindowEnforcement.ts) and surfaces here via the
  // `error` branch above (FORM_NOT_YET_OPEN / FORM_CLOSED) — a form outside
  // its window never reaches this point with data. No client-side
  // re-validation here, since duplicating that check drifted out of sync
  // with the server's dual-format (legacy date vs. precise datetime) parsing.

  const handleSubmitAnother = () => {
    useFormResponseStore.getState().clearAllResponses();
    isSubmittingRef.current = false;
    setSubmissionState('idle');
    setThankYouData(null);
    setHasStartedForm(false);
    // Require a fresh opt-in on the next response rather than carrying over
    // the previous one silently.
    setSendResponseCopy(false);
  };

  // Render the form in fullscreen mode. After a successful submission, the
  // layout's thank-you screen is shown by forcing `screenOverride` — FormRenderer
  // stays mounted rather than being swapped for a separate component, so the
  // thank-you screen inherits the same layout's theme/spacing/background.
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
        responseCopySettings={responseCopySettings}
        onResponseCopyConsentChange={setSendResponseCopy}
        screenOverride={submissionState === 'success' ? 'thankYou' : undefined}
        thankYouMessage={thankYouData?.message}
        onSubmitAnother={submissionState === 'success' ? handleSubmitAnother : undefined}
        responseCopyNotice={
          thankYouData?.copyEmail
            ? `We've sent a copy of your responses to ${thankYouData.copyEmail}.`
            : undefined
        }
      />

      {/* Re-auth overlay — token expired/revoked mid-fill. Rendered on top of
          the still-mounted FormRenderer (not an early return) so in-progress
          answers in useFormResponseStore survive. */}
      {needsReauth && (
        <div className="fixed inset-0 bg-background z-50">
          <SignInGate
            formTitle={form.title}
            allowedDomains={allowedDomains}
            onSignedIn={() => setNeedsReauth(false)}
          />
        </div>
      )}

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
