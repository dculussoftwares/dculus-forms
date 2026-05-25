import React from 'react';
import { Button, toastSuccess, toastError } from '@dculus/ui';
import { Mail, Clock, X, Crown, Shield, User, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseDate, isDateExpired } from '@dculus/utils';
import { organization } from '../../lib/auth-client';
import { useTranslation } from '../../hooks/useTranslation';

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  status: string;
  createdAt: string;
  inviter: {
    id: string;
    name: string;
    email: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}

interface InvitationsListProps {
  invitations: Invitation[];
  organizationId: string;
  onInvitationAction: () => void;
}

export const InvitationsList: React.FC<InvitationsListProps> = ({
  invitations,
  organizationId,
  onInvitationAction,
}) => {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const { t } = useTranslation('settings');

  const handleCancelInvitation = async (invitationId: string) => {
    setLoadingId(invitationId);
    try {
      await organization.cancelInvitation({ invitationId });
      toastSuccess(t('toasts.invitationCancelled.title'), t('toasts.invitationCancelled.description'));
      onInvitationAction();
    } catch (error: any) {
      toastError(t('toasts.invitationCancelError.title'), error?.message || t('toasts.invitationCancelError.description'));
    } finally {
      setLoadingId(null);
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    setLoadingId(invitation.id);
    try {
      const { error } = await organization.inviteMember({
        email: invitation.email,
        role: invitation.role as 'member' | 'admin' | 'owner',
        organizationId,
        resend: true,
      });
      if (error) throw error;
      toastSuccess(
        t('invitations.toasts.resent.title'),
        t('invitations.toasts.resent.description', { values: { email: invitation.email } })
      );
      onInvitationAction();
    } catch (error: any) {
      toastError(t('invitations.toasts.resendError.title'), t('invitations.toasts.resendError.description'));
    } finally {
      setLoadingId(null);
    }
  };


  // Ensure invitations is an array
  const invitationArray = Array.isArray(invitations) ? invitations : [];

  if (invitationArray.length === 0) {
    return (
      <div className="text-center py-8">
        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">{t('invitations.emptyTitle')}</h3>
        <p className="text-muted-foreground">
          {t('invitations.emptyDescription')}
        </p>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-3.5 w-3.5" />;
      case 'admin': return <Shield className="h-3.5 w-3.5" />;
      default: return <User className="h-3.5 w-3.5" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t('members.roles.owner');
      case 'admin': return t('members.roles.admin');
      case 'member': return t('members.roles.member');
      default: return t('members.roles.default', { values: { role } });
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-[#ddd6fa] text-[#5c2e6b] border border-[#c6b8fe]';
      case 'admin': return 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]';
      default: return 'bg-[#f7f7f8] text-[#655d67] border border-[#dedcde]';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#3c323e]">{t('invitations.title')}</h3>
        <span className="inline-flex items-center text-xs font-medium bg-[#f6fafd] text-[#01487f] px-2.5 py-1 rounded-full">
          {invitationArray.length === 1
            ? t('invitations.count.one')
            : t('invitations.count.other', { values: { count: invitationArray.length } })}
        </span>
      </div>

      <div>
        {invitationArray.map((invitation, index) => {
          const isExpired = isDateExpired(invitation.expiresAt);
          const isLoading = loadingId === invitation.id;

          return (
            <div
              key={invitation.id}
              className={`flex items-center justify-between px-3 py-3.5 rounded-lg transition-colors
                ${isExpired ? 'opacity-60' : ''}
                ${isLoading ? 'pointer-events-none' : 'hover:bg-[rgba(87,84,91,0.06)]'}
                ${index < invitationArray.length - 1 ? 'border-b border-[rgba(81,76,84,0.08)]' : ''}
              `}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ddd6fa] shrink-0">
                  <Mail className="h-4 w-4 text-[#5c2e6b]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#3c323e]">{invitation.email}</div>
                  <div className="flex items-center gap-2 text-xs text-[#655d67]">
                    <span>
                      {t('invitations.invitedBy', {
                        values: { name: invitation.inviter?.name || t('invitations.unknownInviter') },
                      })}
                    </span>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {isExpired ? (
                        <span className="text-[#ce5d55] font-medium">{t('invitations.expired')}</span>
                      ) : (
                        <span>
                          {t('invitations.expires', {
                            values: {
                              time: formatDistanceToNow(parseDate(invitation.expiresAt), { addSuffix: true }),
                            },
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${getRoleBadgeClass(invitation.role)}`}>
                  {getRoleIcon(invitation.role)}
                  {getRoleLabel(invitation.role)}
                </span>

                {/* Resend — shown for expired invitations */}
                {isExpired && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResendInvitation(invitation)}
                    disabled={isLoading}
                    className="h-7 px-2 text-xs text-[#655d67] hover:text-[#3c323e] hover:bg-[rgba(87,84,91,0.08)] gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t('invitations.resend')}
                  </Button>
                )}

                {/* Cancel — shown for pending (non-expired) invitations */}
                {!isExpired && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvitation(invitation.id)}
                    disabled={isLoading}
                    className="h-7 w-7 p-0 text-[#655d67] hover:text-[#ce5d55] hover:bg-[rgba(206,93,85,0.08)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
