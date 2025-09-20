import React from 'react';
import { Badge, Button, toastSuccess, toastError } from '@dculus/ui';
import { Mail, Clock, X, Crown, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseDate, isDateExpired } from '../../utils/dateHelpers';
import { organization } from '../../lib/auth-client';

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

  const handleCancelInvitation = async (invitationId: string) => {
    setCancelLoading(true);
    
    try {
      await organization.cancelInvitation({
        invitationId,
      });
      
      toastSuccess('Invitation cancelled', 'The invitation has been cancelled successfully.');
      onInvitationAction();
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      toastError('Error cancelling invitation', error.message || 'Failed to cancel invitation');
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
        <h3 className="text-lg font-medium">No pending invitations</h3>
        <p className="text-muted-foreground">
          All invitations have been responded to or there are no pending invitations.
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
        return 'Owner';
      case 'member':
        return 'Member';
      default:
        return role;
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
        <h3 className="text-lg font-medium">Pending Invitations</h3>
        <Badge variant="outline">
          {invitationArray.length} pending invitation{invitationArray.length !== 1 ? 's' : ''}
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
                  <span>Invited by {invitation.inviter?.name || 'Unknown'}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {isDateExpired(invitation.expiresAt) ? (
                      <span className="text-destructive">Expired</span>
                    ) : (
                      <span>
                        Expires {formatDistanceToNow(parseDate(invitation.expiresAt), { addSuffix: true })}
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
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};