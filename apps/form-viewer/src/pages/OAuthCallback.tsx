import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button, LoadingSpinner } from '@dculus/ui';
import { authClient } from '../lib/auth-client';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ott = searchParams.get('ott');
    const returnTo = searchParams.get('returnTo') || '/';
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
    const returnTo = searchParams.get('returnTo') || '/';
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.replace(returnTo)}>Back to form</Button>
      </div>
    );
  }

  return <LoadingSpinner fullScreen />;
}
