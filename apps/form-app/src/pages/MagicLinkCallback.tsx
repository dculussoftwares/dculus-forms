import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, AlertCircle } from 'lucide-react';
import { Button } from '@dculus/ui';
import { authClient } from '../lib/auth-client';
import { useTranslation } from '../hooks/useTranslation';

type CallbackError = { message: string; isNoAccount?: boolean };

export const MagicLinkCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation('magicLinkCallback');
  const [error, setError] = useState<CallbackError | null>(null);

  useEffect(() => {
    // better-auth appends ?error=<code> to the redirect URL when verification fails.
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const isNoAccount = errorParam === 'new_user_signup_disabled';
      setError({
        message: isNoAccount ? t('messages.noAccount') : t('messages.invalidOrExpired'),
        isNoAccount,
      });
      return;
    }

    const token = searchParams.get('token');

    if (!token) {
      // No token: arrived here after better-auth verified server-side and set cookie.
      // Re-fetch the session to sync the bearer token into sessionStorage, then do a
      // full-page navigation so useSession() reinitialises with the fresh token.
      authClient.getSession().then(({ data, error: sessionError }) => {
        if (sessionError || !data?.session) {
          setError({ message: t('messages.invalidOrExpired') });
          return;
        }
        window.location.replace('/');
      });
      return;
    }

    // Token present: call verify as a JSON fetch (no callbackURL = no server redirect).
    // The bearer plugin returns set-auth-token in the JSON response so onSuccess
    // in auth-client.ts stores it in sessionStorage before we navigate.
    authClient.magicLink
      .verify({ query: { token } })
      .then(({ error: verifyError }) => {
        if (verifyError) {
          setError({ message: verifyError.message || t('messages.invalidOrExpired') });
          return;
        }
        window.location.replace('/');
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-6 bg-white">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'var(--tf-error-bg)' }}>
            <AlertCircle className="w-7 h-7" style={{ color: 'var(--tf-error)' }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold mb-1.5 text-primary">
              {error.isNoAccount ? t('error.noAccountTitle') : t('error.title')}
            </h1>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
          {error.isNoAccount ? (
            <div className="flex flex-col gap-2">
              <Link to="/signup">
                <Button className="w-full h-10">{t('error.signUpAction')}</Button>
              </Link>
              <Button variant="outline" onClick={() => navigate('/signin')} className="w-full h-10">
                {t('error.action')}
              </Button>
            </div>
          ) : (
            <Button onClick={() => navigate('/signin')} className="w-full h-10">
              {t('error.action')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'var(--tf-dark)' }}>
          <FileText className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold mb-1.5 text-primary">{t('loading.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('loading.subtitle')}</p>
        </div>
        <div className="flex justify-center">
          <span className="w-6 h-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
        </div>
      </div>
    </div>
  );
};
