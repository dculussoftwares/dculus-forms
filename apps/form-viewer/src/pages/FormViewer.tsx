import React, { useState, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { Button, FormRenderer, useFormResponseStore, LoadingSpinner } from '@dculus/ui';
import {
  deserializeFormSchema,
  extractEmailFields,
  FieldType,
  isOneResponsePerRespondent,
  isRespondentEditEnabled,
  isSaveProgressEnabled,
} from '@dculus/types';
import type { RespondentGradeView } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { EDIT_MY_RESPONSE, GET_FORM_BY_SHORT_URL, SUBMIT_RESPONSE, type MyResponseData } from '../graphql/queries';
import { useFormAnalytics } from '../hooks/useFormAnalytics';
import { useFormSubmissionAnalytics } from '../hooks/useFormSubmissionAnalytics';
import { getCdnEndpoint, getUploadUrl } from '../lib/config';
import { buildCompletionTimeInput } from '../lib/completionTime';
import { getFormErrorMessage, isSubmissionLimitError, isAccessControlError } from '../lib/formError';
import {
  quizResultLabels,
  quizResultLinkLabel,
  quizResultLinkDescription,
  quizResultLinkCopyLabel,
  quizResultLinkCopiedLabel,
  quizResultLinkOpenLabel,
} from '../locales/quizResult';
import SignInGate from '../components/SignInGate';
import AccessDeniedScreen from '../components/AccessDeniedScreen';
import RespondentBadge from '../components/RespondentBadge';
import { signOut } from '../lib/auth-client';
import DraftNotice, { DraftSaveStatusText } from '../components/DraftNotice';
import { useResponseDraft, type ResponseDraft } from '../hooks/useResponseDraft';
import { buildPageResponses, resolveResumePageId } from '../lib/draftData';
import AlreadyRespondedScreen from '../components/AlreadyRespondedScreen';
import MyResponseNotice from '../components/MyResponseNotice';
import MyResponseSummary from '../components/MyResponseSummary';
import { myResponseLabels } from '../locales/myResponse';
import { formatDate } from '../lib/dateFormat';

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
    if (!Array.isArray(value)) continue;
    const limits = fieldLimits[fieldId];
    const maxBytes = limits ? limits.maxMb * 1024 * 1024 : MAX_FILE_SIZE_BYTES;
    for (const file of value.filter((item): item is File => item instanceof File)) {
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

/**
 * Uploads every new File in the answers and swaps it for its storage key.
 * A file field can mix new Files with keys already stored on a response
 * that is being edited; those keys pass through untouched.
 */
async function uploadPendingFiles(
  responses: Record<string, unknown>,
  formId: string
): Promise<Record<string, unknown>> {
  const uploadUrl = getUploadUrl();
  const processed: Record<string, unknown> = { ...responses };
  for (const [fieldId, value] of Object.entries(responses)) {
    if (!Array.isArray(value) || !value.some((item) => item instanceof File)) continue;
    processed[fieldId] = await Promise.all(
      value.map((item) => (item instanceof File ? uploadFormResponseFile(item, formId, uploadUrl) : item))
    );
  }
  return processed;
}

function withSubmissionTimeout<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Request timed out. Please check your connection and try again.')),
      SUBMISSION_TIMEOUT_MS
    );
  });
  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

/** What the signed-in respondent is looking at: the form, their response, or an edit of it. */
type RespondentView = 'form' | 'review' | 'edit';

export interface FormViewerProps {
  /**
   * Form Embed v1 — render for a host page's iframe instead of a full window:
   * the shell hugs its content (so the host can size the frame), overlays are
   * contained rather than viewport-fixed, and every state renders compact.
   * Set only by `EmbedFormViewer`; `/f/:shortUrl` leaves it undefined.
   */
  embedded?: boolean;
  /**
   * Called after a successful submission so an embedded host can be notified.
   * Deliberately given no arguments — no answer data may cross the frame.
   */
  onSubmitted?: () => void;
  /**
   * Set false to render the form without recording a view or a start time.
   * Only the owner's own embed preview does this — see EmbedPreview.
   */
  trackAnalytics?: boolean;
}

const FormViewer: React.FC<FormViewerProps> = ({
  embedded = false,
  onSubmitted,
  trackAnalytics = true,
}) => {
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
    grade?: RespondentGradeView;
    /** The respondent saved changes to an earlier response, not a new one. */
    edited?: boolean;
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
  const [editMyResponse] = useMutation(EDIT_MY_RESPONSE);

  const [view, setView] = useState<RespondentView>('form');
  // The respondent's own latest response: from the form query until this
  // page submits or edits one, then the mutation's copy.
  const [myResponseOverride, setMyResponseOverride] = useState<MyResponseData | null | undefined>(undefined);

  // Track form analytics when form is loaded
  const { trackFormStartTime } = useFormAnalytics({
    formId: data?.formByShortUrl?.id || '',
    enabled: trackAnalytics && !!data?.formByShortUrl?.id,
  });

  // Hook for gathering submission analytics data
  const { getSubmissionAnalyticsData } = useFormSubmissionAnalytics({
    formId: data?.formByShortUrl?.id || '',
    enabled: trackAnalytics && !!data?.formByShortUrl?.id,
  });

  // Memoized deserialization — placed here (before any early returns) to satisfy Rules of Hooks
  const rawSchema = data?.formByShortUrl?.formSchemaPublic;
  const formSchema = useMemo(
    () => (rawSchema ? deserializeFormSchema(rawSchema) : null),
    [rawSchema]
  );

  // Save-and-resume (signed-in respondents on identity-gated forms). The
  // draft is applied to the response store once per form + account, before
  // FormRenderer mounts, so every page initialises from the restored answers.
  const loadedForm = data?.formByShortUrl;
  const myResponse: MyResponseData | null =
    myResponseOverride !== undefined ? myResponseOverride : (loadedForm?.myResponse ?? null);
  const draftsEnabled =
    !!formSchema &&
    loadedForm?.accessStatus === 'OPEN' &&
    !!loadedForm?.respondentEmail &&
    !loadedForm?.closedReason &&
    isSaveProgressEnabled(loadedForm?.settings);
  const draftSessionKey = draftsEnabled ? `${loadedForm.id}:${loadedForm.respondentEmail}` : null;
  const [restoredSessionKey, setRestoredSessionKey] = useState<string | null>(null);
  const [resumePageId, setResumePageId] = useState<string | undefined>(undefined);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  // Bumped to remount FormRenderer when its answers are replaced wholesale
  // ("Start over", or taking another device's copy after a conflict).
  const [rendererKey, setRendererKey] = useState(0);
  const draftStartedAtRef = useRef<string | null>(null);
  const isDraftReady = !draftSessionKey || restoredSessionKey === draftSessionKey;

  const applyDraftToStore = useCallback(
    (draft: ResponseDraft | null) => {
      const store = useFormResponseStore.getState();
      store.clearAllResponses();
      if (draft && formSchema) {
        for (const [pageId, responses] of Object.entries(buildPageResponses(formSchema, draft.data))) {
          store.setPageResponses(pageId, responses);
        }
      }
      setResumePageId(formSchema ? resolveResumePageId(formSchema, draft?.currentPageId) : undefined);
      draftStartedAtRef.current = draft?.startedAt ?? null;
    },
    [formSchema]
  );

  const replaceAnswers = useCallback(
    (draft: ResponseDraft | null) => {
      applyDraftToStore(draft);
      setRendererKey((key) => key + 1);
    },
    [applyDraftToStore]
  );

  const responseDraft = useResponseDraft({
    formId: loadedForm?.id ?? '',
    enabled:
      isDraftReady &&
      !!draftSessionKey &&
      view === 'form' &&
      !needsReauth &&
      submissionState !== 'submitting' &&
      submissionState !== 'success',
    applyDraft: replaceAnswers,
  });
  const seedDraft = responseDraft.seed;

  useLayoutEffect(() => {
    if (!draftSessionKey || restoredSessionKey === draftSessionKey) return;
    const draft = (loadedForm?.myDraft as ResponseDraft | null) ?? null;
    applyDraftToStore(draft);
    seedDraft(draft);
    setRestoredAt(draft?.updatedAt ?? null);
    setRestoredSessionKey(draftSessionKey);
  }, [draftSessionKey, restoredSessionKey, loadedForm, applyDraftToStore, seedDraft]);

  const hasFileFields = useMemo(
    () =>
      !!formSchema?.pages.some((page) =>
        page.fields.some((field) => !field.deleted && field.type === FieldType.FILE_UPLOAD_FIELD)
      ),
    [formSchema]
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
    // An autosave still on the wire could otherwise land after the submit
    // deletes the draft and recreate it.
    await responseDraft.settle();

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

      const processedResponses = await uploadPendingFiles(responses, formId);

      if (view === 'edit') {
        const result = await withSubmissionTimeout(
          editMyResponse({ variables: { input: { formId, data: processedResponses } } })
        );
        if (result.error) throw result.error;
        const edited = result.data?.editMyResponse;
        if (!edited) throw new Error('Your changes could not be saved. Please try again.');
        setMyResponseOverride(edited);
        setView('form');
        setSubmissionState('success');
        setThankYouData({ message: `<p>${myResponseLabels.changesSaved}</p>`, edited: true });
        return;
      }

      // Get analytics data for submission tracking
      const analyticsData = getSubmissionAnalyticsData();

      // Calculate completion time if we have form start time
      let completionTimeSeconds: number | null = null;
      if (analyticsData && draftStartedAtRef.current) {
        // Resumed from a draft: time from the first save, across sessions and devices.
        completionTimeSeconds = Math.round((Date.now() - Date.parse(draftStartedAtRef.current)) / 1000);
      } else if (analyticsData) {
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

      const result = await withSubmissionTimeout(
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
                embedContext: analyticsData.embedContext,
                embedHost: analyticsData.embedHost,
                ...buildCompletionTimeInput(completionTimeSeconds),
              }),
            },
          },
        })
      );

      if (result.error) throw result.error;
      const submitted = result.data?.submitResponse;
      if (!submitted) throw new Error('An error occurred while submitting the form. Please try again.');
      const { thankYouMessage, grade } = submitted;
      // Identity-gated forms: the respondent can view (or edit) what they sent.
      if (loadedForm?.respondentEmail) {
        setMyResponseOverride({
          id: submitted.id,
          data: submitted.data,
          submittedAt: submitted.submittedAt,
          canEdit: isRespondentEditEnabled(loadedForm.settings),
        });
      }

      setSubmissionState('success');
      // The server deleted the draft along with storing the response.
      seedDraft(null);
      draftStartedAtRef.current = null;
      setRestoredAt(null);
      setThankYouData({
        message: thankYouMessage,
        // Optimistic client-side note only — the actual email send is async/
        // fire-and-forget server-side, so there's no real delivery confirmation here.
        copyEmail:
          effectiveSendResponseCopy || responseCopySettings?.mode === 'always'
            ? copyRecipientEmail
            : undefined,
        // Absent for every non-quiz form — `grade` is only populated when the
        // server graded this submission synchronously (epic #289, D3).
        grade: grade ?? undefined,
      });
      // Ids only — the host page learns *that* a submission happened, never
      // what was submitted. Guarded separately: the response is already
      // stored, so a throwing notification must not fall into the catch below
      // and re-enable submit on a form that has already been submitted.
      try {
        onSubmitted?.();
      } catch (notifyError) {
        console.warn('onSubmitted callback failed:', notifyError);
      }
      // Leave isSubmittingRef true on success — form is done, no re-submit needed
    } catch (err: unknown) {
      console.error('Form submission error:', err);

      const errorCode = (CombinedGraphQLErrors.is(err) ? err.errors[0]?.extensions?.code : undefined) as string | undefined;
      if (isAccessControlError(errorCode)) {
        // A real sign-out (not just clearing the local token) — better-auth
        // also sets a session cookie independent of the bearer plugin, and
        // that cookie alone would otherwise keep re-authenticating the
        // rejected identity on the next attempt. Fire-and-forget: the gate is
        // shown regardless, and a failed sign-out just means the respondent
        // re-authenticates over a still-live session.
        void signOut().catch(() => {});
        setSubmissionState('idle');
        setNeedsReauth(true);
        isSubmittingRef.current = false;
        return;
      }

      if (errorCode === GRAPHQL_ERROR_CODES.ALREADY_RESPONDED) {
        // Submitted from another tab or device: re-fetch so the
        // already-responded screen (with that response) takes over.
        isSubmittingRef.current = false;
        setSubmissionState('idle');
        setMyResponseOverride(undefined);
        await refetch();
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
        className={embedded ? 'w-full min-h-[240px] flex items-center justify-center' : 'h-screen w-full'}
        data-testid="form-viewer-loading"
      >
        <LoadingSpinner fullScreen={!embedded} size="md" />
      </div>
    );
  }

  if (error) {
    const errorCode = (CombinedGraphQLErrors.is(error) ? error.errors[0]?.extensions?.code : undefined) as string | undefined;
    const limitError = isSubmissionLimitError(errorCode);

    return (
      <div
        className={`w-full flex items-center justify-center ${embedded ? 'min-h-[240px]' : 'h-screen'}`}
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
      <div className={`w-full flex items-center justify-center ${embedded ? 'min-h-[240px]' : 'h-screen'}`} data-testid="form-viewer-error">
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

  // Native Quiz (epic #289, Story 16/#320, D9): a persistent "check back
  // later" link only makes sense when the grade is deferred (not shown
  // instantly here) AND there's a respondent identity to key a later lookup
  // off (`myQuizResult` matches on `respondentUserId`, which is only ever
  // set for identity-gated forms — see accessControlEnforcement.ts).
  const quizSettings = form.settings?.quiz;
  const requiresIdentity =
    !!form.settings?.accessControl?.enabled || !!form.settings?.collectRespondentEmail;
  const resultLink =
    quizSettings?.enabled && quizSettings.gradeRelease !== 'immediate' && requiresIdentity
      ? {
          // Absolute URL — ThankYouScreen shows it verbatim in a copyable
          // field so the respondent can save it before leaving.
          href: `${window.location.origin}/f/${shortUrl}/result`,
          label: quizResultLinkLabel,
          description: quizResultLinkDescription,
          copyLabel: quizResultLinkCopyLabel,
          copiedLabel: quizResultLinkCopiedLabel,
          openLabel: quizResultLinkOpenLabel,
        }
      : undefined;

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
        signedInEmail={form.respondentEmail}
        allowedDomains={allowedDomains}
        onSwitchAccount={() => refetch()}
      />
    );
  }

  // Check if form schema exists
  if (!form.formSchemaPublic) {
    return (
      <div className={`w-full flex items-center justify-center ${embedded ? 'min-h-[240px]' : 'h-screen'}`} data-testid="form-viewer-error">
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
    setResumePageId(undefined);
    isSubmittingRef.current = false;
    setSubmissionState('idle');
    setThankYouData(null);
    setHasStartedForm(false);
    // Require a fresh opt-in on the next response rather than carrying over
    // the previous one silently.
    setSendResponseCopy(false);
  };

  // "Not you?" on the RespondentBadge. Awaits a real server-side sign-out
  // (throws on failure — the badge then keeps the current identity visible
  // and offers a retry, never a false "signed out" state), wipes the previous
  // respondent's in-progress answers, then re-fetches: the form now reports
  // SIGN_IN_REQUIRED and the SignInGate takes over.
  const handleSwitchAccount = async () => {
    await signOut();
    useFormResponseStore.getState().clearAllResponses();
    // The next account restores its own draft (if any) after the re-fetch.
    seedDraft(null);
    setRestoredSessionKey(null);
    setRestoredAt(null);
    isSubmittingRef.current = false;
    setSubmissionState('idle');
    setThankYouData(null);
    setHasStartedForm(false);
    setSendResponseCopy(false);
    setNeedsReauth(false);
    setView('form');
    setMyResponseOverride(undefined);
    await refetch();
  };

  // "Start over" on a restored draft: delete the server copy, then reopen
  // the form empty from its first screen.
  const handleStartOver = async () => {
    await responseDraft.discard(() => replaceAnswers(null));
    setRestoredAt(null);
  };

  // Respondent self-service (identity-gated forms): load the submitted
  // answers into the form and reopen it from its first page. A new response
  // in progress is saved as a draft first, and comes back on cancel.
  const handleStartEditing = async () => {
    if (!myResponse || !formSchema) return;
    // Never replace a new response in progress unless it is safely saved.
    if (draftSessionKey && !(await responseDraft.flush())) {
      setSubmissionState('error');
      setSubmissionMessage(myResponseLabels.saveBeforeEditFailed);
      return;
    }
    const store = useFormResponseStore.getState();
    store.clearAllResponses();
    for (const [pageId, responses] of Object.entries(
      buildPageResponses(formSchema, myResponse.data, { keepFiles: true })
    )) {
      store.setPageResponses(pageId, responses);
    }
    setResumePageId(undefined);
    setRendererKey((key) => key + 1);
    isSubmittingRef.current = false;
    setSubmissionState('idle');
    setThankYouData(null);
    setView('edit');
  };

  const handleCancelEditing = async () => {
    if (draftSessionKey) {
      // Re-apply the freshly fetched draft (the restore layout effect runs again).
      await refetch();
      setRestoredSessionKey(null);
    } else {
      useFormResponseStore.getState().clearAllResponses();
    }
    setResumePageId(undefined);
    setRendererKey((key) => key + 1);
    setSubmissionState('idle');
    setView('form');
  };

  const onePerRespondent = isOneResponsePerRespondent(form.settings);
  const onEditResponse = myResponse?.canEdit ? handleStartEditing : undefined;
  const isClosed = !!form.closedReason;
  const isAlreadyResponded =
    (onePerRespondent || isClosed) && !!myResponse && view === 'form' && submissionState !== 'success';
  const showDraftUi = !!draftSessionKey && view === 'form' && submissionState !== 'success';

  const renderResponseNotice = () => {
    if (!myResponse || view === 'review' || isAlreadyResponded) return null;
    if (view === 'edit') {
      return (
        <MyResponseNotice
          message={myResponseLabels.editingTitle}
          description={myResponseLabels.editingDescription}
          embedded={embedded}
          onCancel={handleCancelEditing}
        />
      );
    }
    const message =
      submissionState === 'success'
        ? thankYouData?.edited
          ? myResponseLabels.changesSaved
          : myResponseLabels.responseSaved
        : myResponseLabels.respondedOn(formatDate(myResponse.submittedAt));
    return (
      <MyResponseNotice
        message={message}
        embedded={embedded}
        onView={() => setView('review')}
        onEdit={onEditResponse}
      />
    );
  };

  // Re-auth after a token expired mid-fill. Re-fetch before resuming: the
  // same account keeps its answers, while a different one changes the draft
  // session key, which restores that account's own draft instead of letting
  // autosave file the previous account's answers under it.
  const handleReauthenticated = async () => {
    const { data: fresh } = await refetch();
    if (fresh?.formByShortUrl?.respondentEmail !== form.respondentEmail) {
      setMyResponseOverride(undefined);
      setView('form');
    }
    setNeedsReauth(false);
  };

  if (!isDraftReady) {
    return (
      <div
        className={embedded ? 'w-full min-h-[240px] flex items-center justify-center' : 'h-screen w-full'}
        data-testid="form-viewer-loading"
      >
        <LoadingSpinner fullScreen={!embedded} size="md" />
      </div>
    );
  }

  // Render the form in fullscreen mode. After a successful submission, the
  // layout's thank-you screen is shown by forcing `screenOverride` — FormRenderer
  // stays mounted rather than being swapped for a separate component, so the
  // thank-you screen inherits the same layout's theme/spacing/background.
  return (
    <div
      className={embedded ? 'w-full relative' : 'h-screen w-full flex flex-col'}
      data-testid="form-viewer-renderer"
    >
      {/* Identity-gated forms: a full-width banner (its own row above the form,
          not a floating chip) naming the signed-in account and offering a
          switch — so a shared or returning browser can't submit silently under
          a previous respondent. `respondentEmail` is null (banner hidden) for
          forms that don't capture respondent identity. */}
      {form.respondentEmail && (
        <RespondentBadge
          email={form.respondentEmail}
          imageUrl={form.respondentImage}
          embedded={embedded}
          onSwitchAccount={handleSwitchAccount}
          trailing={
            showDraftUi ? (
              <DraftSaveStatusText status={responseDraft.status} lastSavedAt={responseDraft.lastSavedAt} />
            ) : undefined
          }
        />
      )}

      {renderResponseNotice()}

      {showDraftUi && (
        <DraftNotice
          restoredAt={restoredAt}
          hasFileFields={hasFileFields}
          conflict={responseDraft.conflict}
          embedded={embedded}
          onStartOver={handleStartOver}
          onKeepMine={responseDraft.keepMine}
          onUseOther={responseDraft.acceptOther}
          onDismiss={() => setRestoredAt(null)}
        />
      )}

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

      {view === 'review' && myResponse ? (
        <MyResponseSummary
          formTitle={form.title}
          formSchema={formSchema!}
          response={myResponse}
          embedded={embedded}
          onBack={() => setView('form')}
          onEdit={onEditResponse}
        />
      ) : isAlreadyResponded && myResponse ? (
        <AlreadyRespondedScreen
          submittedAt={myResponse.submittedAt}
          closed={isClosed}
          embedded={embedded}
          onView={() => setView('review')}
          onEdit={onEditResponse}
        />
      ) : (
        <FormRenderer
          key={rendererKey}
          cdnEndpoint={cdnEndpoint}
          formSchema={formSchema!}
          mode={RendererMode.SUBMISSION}
          // `flex-1 min-h-0` (not `h-full`) so the layout fills the space left
          // under the RespondentBadge banner instead of overflowing past it.
          className={embedded ? 'w-full' : 'flex-1 min-h-0 w-full'}
          embedded={embedded}
          formId={form.id}
          onFormSubmit={handleFormSubmit}
          onResponseChange={view === 'edit' ? undefined : handleFirstFormInteraction}
          initialPageId={resumePageId}
          onPageChange={showDraftUi ? responseDraft.setCurrentPage : undefined}
          responseCopySettings={view === 'edit' ? undefined : responseCopySettings}
          onResponseCopyConsentChange={setSendResponseCopy}
          screenOverride={submissionState === 'success' ? 'thankYou' : undefined}
          thankYouMessage={thankYouData?.message}
          onSubmitAnother={
            submissionState === 'success' && !onePerRespondent && !thankYouData?.edited
              ? handleSubmitAnother
              : undefined
          }
          responseCopyNotice={
            thankYouData?.copyEmail
              ? `We've sent a copy of your responses to ${thankYouData.copyEmail}.`
              : undefined
          }
          gradeResult={thankYouData?.grade}
          quizResultLabels={quizResultLabels}
          resultLink={resultLink}
        />
      )}

      {/* Re-auth overlay — token expired/revoked mid-fill. Rendered on top of
          the still-mounted FormRenderer (not an early return) so in-progress
          answers in useFormResponseStore survive. */}
      {needsReauth && (
        <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 bg-background z-50`}>
          <SignInGate
            formTitle={form.title}
            allowedDomains={allowedDomains}
            onSignedIn={handleReauthenticated}
          />
        </div>
      )}

      {/* Loading overlay during submission */}
      {submissionState === 'submitting' && (
        <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 bg-black/50 flex items-center justify-center z-50`}>
          <div className="bg-card rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3">
              <LoadingSpinner fullScreen={false} size="sm" />
              <div>
                <p className="text-lg font-medium text-foreground">
                  {view === 'edit' ? myResponseLabels.submitting : 'Submitting...'}
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
