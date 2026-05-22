import React from 'react';
import { Button, toastSuccess, toastError } from '@dculus/ui';
import { Mail, Clock, X, Crown, User } from 'lucide-react';
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
  onInvitationAction: () => void;
}

export const InvitationsList: React.FC<InvitationsListProps> = ({
  invitations,
  onInvitationAction,
}) => {
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const { t } = useTranslation('settings');

  const handleCancelInvitation = async (invitationId: string) => {
    setCancelLoading(true);
    
    try {
      await organization.cancelInvitation({
        invitationId,
      });
      
      toastSuccess(t('toasts.invitationCancelled.title'), t('toasts.invitationCancelled.description'));
      onInvitationAction();
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      toastError(
        t('toasts.invitationCancelError.title'),
        error?.message || t('toasts.invitationCancelError.description'),
      );
    } finally {
      setCancelLoading(false);
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
      case 'owner':
        return <Crown className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return t('members.roles.owner');
      case 'member':
        return t('members.roles.member');
      default:
        return t('members.roles.default', { values: { role } });
    }
  };

  const getRoleBadgeClass = (role: string) => {
    return role === 'owner'
      ? 'bg-[#ddd6fa] text-[#5c2e6b] border border-[#c6b8fe]'
      : 'bg-[#f7f7f8] text-[#655d67] border border-[#dedcde]';
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
        {invitationArray.map((invitation, index) => (
          <div
            key={invitation.id}
            className={`flex items-center justify-between px-3 py-3.5 rounded-lg hover:bg-[rgba(87,84,91,0.06)] transition-colors ${
              isDateExpired(invitation.expiresAt) ? 'opacity-60' : ''
            } ${
              index < invitationArray.length - 1 ? 'border-b border-[rgba(81,76,84,0.08)]' : ''
            }`}
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
                      values: {
                        name: invitation.inviter?.name || t('invitations.unknownInviter'),
                      },
                    })}
                  </span>
                  <span>·</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {isDateExpired(invitation.expiresAt) ? (
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

              {!isDateExpired(invitation.expiresAt) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelInvitation(invitation.id)}
                  disabled={cancelLoading}
                  className="h-7 w-7 p-0 text-[#655d67] hover:text-[#ce5d55] hover:bg-[rgba(206,93,85,0.08)]"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
