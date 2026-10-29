import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button, LoadingSpinner } from '@dculus/ui';
import { authClient } from '../lib/auth-client';
import { consumeOAuthNonce } from '../lib/oauthNonce';

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
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
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

    // Keep the one-time token out of the address bar/history while it is redeemed.
    window.history.replaceState(null, '', window.location.pathname);

    if (!consumeOAuthNonce(searchParams.get('nonce'))) {
      setError('This sign-in link was not started from this browser. Please sign in again.');
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
