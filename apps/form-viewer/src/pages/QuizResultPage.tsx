import { useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { Button, LoadingSpinner, QuizResultScreen } from '@dculus/ui';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { GET_FORM_BY_SHORT_URL, MY_QUIZ_RESULT } from '../graphql/queries';
import SignInGate from '../components/SignInGate';
import AccessDeniedScreen from '../components/AccessDeniedScreen';
import { quizResultLabels, quizResultPageLabels } from '../locales/quizResult';

/**
 * "Check your result" page (epic #289, Story 16/#320, D9) — lets a
 * respondent who submitted an identity-gated quiz under a deferred grade
 * release ('afterReview'/'scheduled') come back later, sign back in as the
 * same identity, and see their score once released. Reached from the
 * persistent link `ThankYouScreen` renders on the immediate post-submit
 * screen (see `FormViewer.tsx`), or by navigating here directly.
 *
 * Mirrors the existing `/f/:shortUrl` | `/:shortUrl` dual-route pattern —
 * see `App.tsx`.
 */
export default function QuizResultPage() {
  const { shortUrl } = useParams<{ shortUrl: string }>();

  const {
    loading: formLoading,
    error: formError,
    data: formData,
    refetch: refetchForm,
  } = useQuery(GET_FORM_BY_SHORT_URL, {
    variables: { shortUrl: shortUrl || '' },
    skip: !shortUrl,
  });

  const form = formData?.formByShortUrl;
  const allowedDomains = form?.settings?.accessControl?.allowedDomains;

  // Skipped while the gate above (SIGN_IN_REQUIRED/DOMAIN_REJECTED) would
  // block anyway, so signing in is always resolved before this ever fires.
  const {
    loading: resultLoading,
    error: resultError,
    data: resultData,
    refetch: refetchResult,
  } = useQuery(MY_QUIZ_RESULT, {
    variables: { formId: form?.id ?? '' },
    skip:
      !form?.id ||
      form.accessStatus === 'SIGN_IN_REQUIRED' ||
      form.accessStatus === 'DOMAIN_REJECTED',
  });

  if (formLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (formError || !form) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Form Not Found</h1>
        <p className="text-muted-foreground">
          The form you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  if (form.accessStatus === 'SIGN_IN_REQUIRED') {
    return (
      <SignInGate
        formTitle={form.title}
        allowedDomains={allowedDomains}
        onSignedIn={() => refetchForm()}
      />
    );
  }

  if (form.accessStatus === 'DOMAIN_REJECTED') {
    return (
      <AccessDeniedScreen
        allowedDomains={allowedDomains}
        onSwitchAccount={() => refetchForm()}
      />
    );
  }

  // Edge case: a quiz form without accessControl/collectRespondentEmail
  // (out of scope for this story — see epic #289 D9) still resolves
  // accessStatus to OPEN even when nobody is signed in, so myQuizResult can
  // come back AUTHENTICATION_REQUIRED here instead. Same recovery as above.
  const resultErrorCode = (
    CombinedGraphQLErrors.is(resultError) ? resultError.errors[0]?.extensions?.code : undefined
  ) as string | undefined;
  if (resultErrorCode === GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED) {
    return (
      <SignInGate
        formTitle={form.title}
        allowedDomains={allowedDomains}
        onSignedIn={() => refetchResult()}
      />
    );
  }

  if (resultLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-3">
        <LoadingSpinner fullScreen={false} size="md" />
        <p className="text-muted-foreground">{quizResultPageLabels.loading}</p>
      </div>
    );
  }

  // A network/server failure here is not the same thing as "you haven't
  // submitted this form" — falling through to the not-submitted state would
  // misreport a transient failure as a real (and wrong) result status.
  if (resultError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <p className="text-muted-foreground">{quizResultPageLabels.loadError}</p>
        <Button variant="outline" onClick={() => refetchResult()}>
          {quizResultPageLabels.retry}
        </Button>
      </div>
    );
  }

  const gradeResult = resultData?.myQuizResult;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {gradeResult ? (
          <QuizResultScreen gradeResult={gradeResult} labels={quizResultLabels} />
        ) : (
          <div className="text-center" data-testid="quiz-result-not-submitted">
            <p className="text-base text-foreground mb-2">
              {quizResultPageLabels.notSubmitted}
            </p>
            <p className="text-sm text-muted-foreground">
              {quizResultPageLabels.notSubmittedHint}
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => window.location.assign(`/f/${shortUrl}`)}>
            {quizResultPageLabels.backToForm}
          </Button>
        </div>
      </div>
    </div>
  );
}
