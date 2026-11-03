import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { LoadingSpinner, toastError, toastSuccess } from '@dculus/ui';
import { useAuth } from '../contexts/AuthContext';
import { CREATE_FORM } from '../graphql/mutations';
import { GET_PUBLIC_TEMPLATE } from '../graphql/templates';
import { clearPendingTemplate, getPendingTemplate } from '../lib/pendingTemplate';
import { useTranslation } from '../hooks/useTranslation';

// Sign-up/sign-in pages finish their own work (OTP, workspace creation) and
// then navigate away; acting before that would race them.
const AUTH_FLOW_PATHS = ['/signin', '/signup', '/verify-email', '/forgot-password', '/magic-link/', '/oauth/', '/invite/'];

/**
 * Once a visitor who picked a template on dculus.com is signed in and has a
 * workspace, copy that template into the workspace and open it in the builder.
 * Renders a full-screen spinner while it works so the dashboard doesn't flash.
 */
export const PendingTemplateHandler = () => {
  const { isAuthenticated, isLoading, activeOrganization } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const apolloClient = useApolloClient();
  const [createForm] = useMutation(CREATE_FORM);
  const { t } = useTranslation('publicTemplates');
  const startedRef = useRef(false);
  const [working, setWorking] = useState(false);

  const inAuthFlow = AUTH_FLOW_PATHS.some((p) => location.pathname.startsWith(p));
  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (startedRef.current || isLoading || !isAuthenticated || !organizationId || inAuthFlow) return;
    const slug = getPendingTemplate();
    if (!slug) return;

    startedRef.current = true;
    setWorking(true);

    const run = async () => {
      try {
        const { data } = await apolloClient.query({
          query: GET_PUBLIC_TEMPLATE,
          variables: { slug },
          fetchPolicy: 'network-only',
        });
        const template = data?.publicTemplate;
        if (!template) {
          toastError(t('handler.notFoundTitle'), t('handler.notFoundMessage'));
          return;
        }

        const result = await createForm({
          variables: {
            input: { templateId: template.id, title: template.name, organizationId },
          },
        });
        const formId = result.data?.createForm?.id;
        if (!formId) throw new Error('createForm returned no id');

        toastSuccess(t('handler.successTitle'), t('handler.successMessage', { values: { name: template.name } }));
        navigate(`/dashboard/form/${formId}/builder`, { replace: true });
      } catch (error) {
        console.error('[PendingTemplate] Could not create form from template:', error);
        toastError(t('handler.failedTitle'), t('handler.failedMessage'));
      } finally {
        // One attempt only — a failure must not loop on every navigation.
        clearPendingTemplate();
        setWorking(false);
      }
    };

    void run();
  }, [isLoading, isAuthenticated, organizationId, inAuthFlow, apolloClient, createForm, navigate, t]);

  if (!working) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background"
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground">{t('handler.preparing')}</p>
    </div>
  );
};
