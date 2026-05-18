import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, FileText, Mail, Users } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { parseDate, isDateExpired } from '@dculus/utils';
import { authClient, organization } from '../lib/auth-client';
import { useQuery } from '@apollo/client';
import { GET_INVITATION_PUBLIC } from '../graphql/queries';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from '@dculus/ui';

/* Reusable card wrapper */
const InviteCard: React.FC<{ children: React.ReactNode; maxW?: string }> = ({
  children,
  maxW = 'max-w-md',
}) => (
  <div
    className={`w-full ${maxW} rounded-xl bg-white p-8`}
    style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 4px 24px rgba(60,50,62,0.10)' }}
  >
    {children}
  </div>
);

/* Ghost button */
const GhostBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <Button
    variant="outline"
    className="w-full h-9"
    disabled={props.disabled}
    onClick={props.onClick}
    type={props.type as 'button' | 'submit' | 'reset' | undefined}
  >
    {children}
  </Button>
);

/* Primary button */
const PrimaryBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <Button
    className="w-full h-10"
    disabled={props.disabled}
    onClick={props.onClick}
    type={props.type as 'button' | 'submit' | 'reset' | undefined}
  >
    {children}
  </Button>
);

const InviteAcceptance: React.FC = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const { t } = useTranslation('inviteAcceptance');

  const { data: invitationData, loading: invitationLoading, error: invitationError } = useQuery(
    GET_INVITATION_PUBLIC,
    { variables: { id: invitationId || '' }, skip: !invitationId, errorPolicy: 'all' }
  );

  const invitation = invitationData?.getInvitationPublic;
  const isExpired = invitation && isDateExpired(invitation.expiresAt);

  const handleAcceptInvitation = async () => {
    if (!invitationId) return;
    setAcceptLoading(true);
    setError(null);
    try {
      await organization.acceptInvitation({ invitationId });
      navigate('/dashboard', { replace: true, state: { message: t('messages.joinSuccess', { values: { organization: invitation?.organization?.name ?? t('fallbacks.organization') } }) } });
    } catch (err: any) {
      setError(err.message || t('messages.acceptFailed'));
    } finally {
      setAcceptLoading(false);
    }
  };

  const handleSignUp = () => {
    if (invitationId) sessionStorage.setItem('pendingInvitationId', invitationId);
    navigate('/signup', { state: { email: invitation?.email, redirectUrl: `/invite/${invitationId}` } });
  };

  const handleSignOut = async () => {
    try { await authClient.signOut(); } catch { /* ignore */ }
    handleSignUp();
  };

  const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#f7f7f8' }}>
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3c323e' }}>
          <FileText className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold text-[#3c323e]">Dculus Forms</span>
      </div>
      {children}
    </div>
  );

  /* ── Loading ── */
  if (authLoading || invitationLoading) {
    return (
      <Page>
        <InviteCard>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(81,76,84,0.15)', borderTopColor: '#3c323e' }} />
          </div>
        </InviteCard>
      </Page>
    );
  }

  /* ── Invalid invitation ── */
  if (invitationError || (!invitationLoading && !invitation)) {
    return (
      <Page>
        <InviteCard>
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(206,93,85,0.08)' }}>
              <AlertCircle className="h-6 w-6 text-[#ce5d55]" />
            </div>
            <h1 className="text-base font-semibold mb-1 text-[#3c323e]">{t('errors.invalid.title')}</h1>
            <p className="text-xs text-[#655d67]">{invitationError?.message || t('errors.invalid.description')}</p>
          </div>
          <PrimaryBtn onClick={() => navigate('/signin')}>{t('buttons.goToSignIn')}</PrimaryBtn>
        </InviteCard>
      </Page>
    );
  }

  /* ── Expired invitation ── */
  if (isExpired) {
    const timeAgo = formatDistanceToNow(parseDate(invitation.expiresAt), { addSuffix: true });
    return (
      <Page>
        <InviteCard>
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(206,93,85,0.08)' }}>
              <AlertCircle className="h-6 w-6 text-[#ce5d55]" />
            </div>
            <h1 className="text-base font-semibold mb-1 text-[#3c323e]">{t('errors.expired.title')}</h1>
            <p className="text-xs text-[#655d67]">
              {t('errors.expired.description', { values: { timeAgo, inviter: invitation.inviter?.name ?? t('fallbacks.inviter') } })}
            </p>
          </div>
          <PrimaryBtn onClick={() => navigate('/signin')}>{t('buttons.goToSignIn')}</PrimaryBtn>
        </InviteCard>
      </Page>
    );
  }

  /* ── Not authenticated ── */
  if (!user) {
    const orgName = invitation.organization?.name;
    const inviterName = invitation.inviter?.name;
    const roleLabel = invitation.role === 'owner' ? t('guestView.details.roleOwner') : t('guestView.details.roleMember');
    return (
      <Page>
        <InviteCard maxW="max-w-lg">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#ddd6fa' }}>
              <Users className="h-7 w-7 text-[#5c2e6b]" />
            </div>
            <h1 className="text-base font-semibold mb-1 text-[#3c323e]">
              {orgName ? t('guestView.title', { values: { organization: orgName } }) : t('guestView.titleFallback')}
            </h1>
            <p className="text-xs text-[#655d67]">
              {inviterName ? t('guestView.description', { values: { inviter: inviterName } }) : t('guestView.descriptionFallback')}
            </p>
          </div>

          {/* Invitation detail pill */}
          <div className="flex items-center gap-3 rounded-xl p-4 mb-5" style={{ backgroundColor: '#f7f7f8', border: '1px solid rgba(81,76,84,0.08)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f8cdd8' }}>
              <Mail className="h-4 w-4 text-[#3c323e]" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#3c323e]">{t('guestView.details.title')}</p>
              <p className="text-[11px] mt-0.5 text-[#655d67]">{invitation.email} · {roleLabel}</p>
            </div>
          </div>

          {error && <p className="text-xs mb-3 py-2 px-3 rounded-lg text-center" style={{ backgroundColor: 'rgba(206,93,85,0.06)', color: '#ce5d55', border: '1px solid rgba(206,93,85,0.14)' }}>{error}</p>}

          <div className="space-y-2">
            <PrimaryBtn onClick={handleSignUp}>{t('buttons.createAccountAndJoin')}</PrimaryBtn>
            <GhostBtn onClick={() => navigate('/signin', { state: { redirectUrl: `/invite/${invitationId}` } })}>
              {t('buttons.alreadyHaveAccount')}
            </GhostBtn>
          </div>
          <p className="text-[10px] text-center mt-4 text-[#655d67]">{t('guestView.footer')}</p>
        </InviteCard>
      </Page>
    );
  }

  /* ── Email mismatch ── */
  if (user.email !== invitation.email) {
    return (
      <Page>
        <InviteCard>
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(206,93,85,0.08)' }}>
              <AlertCircle className="h-6 w-6 text-[#ce5d55]" />
            </div>
            <h1 className="text-base font-semibold mb-1 text-[#3c323e]">{t('errors.mismatch.title')}</h1>
            <p className="text-xs text-[#655d67]">
              {t('errors.mismatch.description', { values: { invitedEmail: invitation.email, currentEmail: user.email ?? '' } })}
            </p>
          </div>
          <div className="space-y-2">
            <PrimaryBtn onClick={handleSignOut}>{t('buttons.signOutAndCreate')}</PrimaryBtn>
            <GhostBtn onClick={() => navigate('/dashboard')}>{t('buttons.goToDashboard')}</GhostBtn>
          </div>
        </InviteCard>
      </Page>
    );
  }

  /* ── Authenticated + matching email ── */
  const orgName = invitation.organization?.name;
  const inviterName = invitation.inviter?.name;
  const roleLabel = invitation.role === 'owner' ? t('authenticatedView.summary.roleOwner') : t('authenticatedView.summary.roleMember');
  return (
    <Page>
      <InviteCard maxW="max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f4faf8' }}>
            <CheckCircle className="h-7 w-7 text-[#177767]" />
          </div>
          <h1 className="text-base font-semibold mb-1 text-[#3c323e]">
            {orgName ? t('authenticatedView.title', { values: { organization: orgName } }) : t('authenticatedView.titleFallback')}
          </h1>
          <p className="text-xs text-[#655d67]">
            {inviterName ? t('authenticatedView.description', { values: { inviter: inviterName } }) : t('authenticatedView.descriptionFallback')}
          </p>
        </div>

        {/* Summary table */}
        <div className="rounded-xl p-4 mb-5 space-y-2.5" style={{ backgroundColor: '#f7f7f8', border: '1px solid rgba(81,76,84,0.08)' }}>
          {[
            [t('authenticatedView.summary.organization'), orgName ?? t('fallbacks.organization')],
            [t('authenticatedView.summary.role'), roleLabel],
            [t('authenticatedView.summary.invitedBy'), inviterName ?? t('fallbacks.inviterShort')],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-[#655d67]">{label}</span>
              <span className="font-medium text-[#3c323e]">{value}</span>
            </div>
          ))}
        </div>

        {error && <p className="text-xs mb-3 py-2 px-3 rounded-lg text-center" style={{ backgroundColor: 'rgba(206,93,85,0.06)', color: '#ce5d55', border: '1px solid rgba(206,93,85,0.14)' }}>{error}</p>}

        <div className="space-y-2">
          <PrimaryBtn onClick={handleAcceptInvitation} disabled={acceptLoading}>
            {acceptLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {t('buttons.acceptInvitationLoading')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                {t('buttons.acceptInvitation')}
              </span>
            )}
          </PrimaryBtn>
          <GhostBtn onClick={() => navigate('/dashboard')}>{t('buttons.maybeLater')}</GhostBtn>
        </div>

        <p className="text-[10px] text-center mt-4 text-[#655d67]">{t('authenticatedView.footer')}</p>
      </InviteCard>
    </Page>
  );
};

export default InviteAcceptance;
