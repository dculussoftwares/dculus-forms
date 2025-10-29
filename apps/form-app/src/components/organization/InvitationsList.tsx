import React from 'react';
import { Badge, Button, toastSuccess, toastError } from '@dculus/ui';
import { Mail, Clock, X, Crown, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseDate, isDateExpired } from '../../utils/dateHelpers';
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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default' as const;
      case 'member':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('invitations.title')}</h3>
        <Badge variant="outline">
          {invitationArray.length === 1
            ? t('invitations.count.one')
            : t('invitations.count.other', { values: { count: invitationArray.length } })}
        </Badge>
      </div>
      
      <div className="space-y-3">
        {invitationArray.map((invitation) => (
          <div
            key={invitation.id}
            className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
              isDateExpired(invitation.expiresAt) ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-muted rounded-full">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium">{invitation.email}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {t('invitations.invitedBy', {
                      values: {
                        name: invitation.inviter?.name || t('invitations.unknownInviter'),
                      },
                    })}
                  </span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {isDateExpired(invitation.expiresAt) ? (
                      <span className="text-destructive">{t('invitations.expired')}</span>
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
            
            <div className="flex items-center space-x-2">
              <Badge variant={getRoleBadgeVariant(invitation.role)} className="flex items-center gap-1">
                {getRoleIcon(invitation.role)}
                {getRoleLabel(invitation.role)}
              </Badge>
              
              {!isDateExpired(invitation.expiresAt) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelInvitation(invitation.id)}
                  disabled={cancelLoading}
                  className="flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  {t('invitations.cancel')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
