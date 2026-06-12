import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertCircle } from 'lucide-react';
import { Button } from '@dculus/ui';
import { useMutation } from '@apollo/client/react';
import { slugify } from '@dculus/utils';
import { authClient, organization } from '../lib/auth-client';
import { INITIALIZE_ORGANIZATION_SUBSCRIPTION } from '../graphql/subscription';
import { useTranslation } from '../hooks/useTranslation';

export const OAuthCallback = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('oauthCallback');
  const [error, setError] = useState(false);
  const [initializeSubscription] = useMutation(INITIALIZE_ORGANIZATION_SUBSCRIPTION);

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error: sessionError } = await authClient.getSession();
        if (sessionError || !data?.session) {
          setError(true);
          return;
        }

        const user = data.user;
        const hasOrg = !!data.session.activeOrganizationId;

        if (!hasOrg) {
          const displayName = user.name?.trim() || user.email?.split('@')[0] || 'my';
          const orgName = `${displayName}'s Organization`;
          const orgSlug = slugify(orgName);

          const orgResult = await authClient.organization.create({
            name: orgName,
            slug: orgSlug,
          });

          if (!orgResult.data) {
            setError(true);
            return;
          }

          try {
            await initializeSubscription({
              variables: { organizationId: orgResult.data.id },
            });
          } catch {
            // Non-fatal — subscription can be initialised later
          }

          await organization.setActive({ organizationId: orgResult.data.id });
        }

        const redirect = sessionStorage.getItem('redirectAfterAuth') ?? '/';
        sessionStorage.removeItem('redirectAfterAuth');
        window.location.replace(redirect);
      } catch {
        setError(true);
      }
    };

    run();
  }, []);

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-6 bg-white">
        <div className="w-full max-w-sm text-center space-y-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: 'var(--tf-error-bg)' }}
          >
            <AlertCircle className="w-7 h-7" style={{ color: 'var(--tf-error)' }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold mb-1.5 text-primary">{t('error.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('error.message')}</p>
          </div>
          <Button onClick={() => navigate('/signin')} className="w-full h-10">
            {t('error.action')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm text-center space-y-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ backgroundColor: 'var(--tf-dark)' }}
        >
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
