import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button, LoadingSpinner } from '@dculus/ui';
import { authClient } from '../lib/auth-client';

// Defense in depth alongside the backend's own check on this query param —
// only a same-origin relative path is safe to hand to window.location.replace.
// "//evil.com" and "https://evil.com" are protocol-relative/absolute URLs a
// browser will follow just as readily as a real redirect, and "/\evil.com"
// can be browser-normalized into "//evil.com" — reject that leading pattern too.
function safeReturnPath(value: string | null): string {
  return value && /^\/[^/\\]/.test(value) ? value : '/';
}

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ott = searchParams.get('ott');
    const returnTo = safeReturnPath(searchParams.get('returnTo'));
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setError('Sign-in was cancelled or failed.');
      return;
    }

    if (!ott) {
      setError('Sign-in link is missing or invalid.');
      return;
    }

    authClient.oneTimeToken
      .verify({ token: ott })
      .then(({ error: verifyError }) => {
        if (verifyError) {
          setError('Sign-in link has expired. Please try again.');
          return;
        }
        window.location.replace(returnTo);
      })
      .catch(() => {
        setError('Something went wrong while signing you in.');
      });
  }, [searchParams]);

  if (error) {
    const returnTo = safeReturnPath(searchParams.get('returnTo'));
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.replace(returnTo)}>Back to form</Button>
      </div>
    );
  }

  return <LoadingSpinner fullScreen />;
}
