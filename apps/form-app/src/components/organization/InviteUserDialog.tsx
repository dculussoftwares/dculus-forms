import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { Mail, UserPlus } from 'lucide-react';
import { organization } from '../../lib/auth-client';

interface InviteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onInviteSent: () => void;
}

export const InviteUserDialog: React.FC<InviteUserDialogProps> = ({
  isOpen,
  onClose,
  organizationId,
  onInviteSent,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [isLoading, setIsLoading] = useState(false);


  // Error message mapping for better user experience
  const getErrorMessage = (error: any) => {
    // Extract error message from different possible structures
    let errorMessage = '';
    let errorCode = '';

    // Handle better-auth error structure: { code: "ERROR_CODE", message: "Error message" }
    if (error?.code && error?.message) {
      errorCode = error.code;
      errorMessage = error.message;
    } else if (error?.error?.code && error?.error?.message) {
      errorCode = error.error.code;
      errorMessage = error.error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = 'Failed to send invitation';
    }

    // Map specific better-auth error codes and messages to user-friendly messages
    const errorMappings: Record<string, { title: string; message: string }> = {
      // Error codes
      'YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION': {
        title: 'Cannot invite user',
        message: 'You do not have permission to invite users to this organization.'
      },
      'USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION': {
        title: 'Already invited',
        message: 'This user has already been invited to your organization.'
      },
      'ORGANIZATION_MEMBERSHIP_LIMIT_REACHED': {
        title: 'Membership limit reached',
        message: 'Your organization has reached its maximum member capacity.'
      },
      'YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE': {
        title: 'Role permission denied',
        message: 'You do not have permission to invite users with this role.'
      },
      'INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION': {
        title: 'Permission expired',
        message: 'You are no longer a member of this organization and cannot send invitations.'
      },
      // Error messages (fallback)
      'You are not allowed to invite users to this organization': {
        title: 'Cannot invite user',
        message: 'This user already belongs to another organization. Users can only be members of one organization at a time.'
      },
      'User is already invited to this organization': {
        title: 'Already invited',
        message: 'This user has already been invited to your organization.'
      },
      'Organization membership limit reached': {
        title: 'Membership limit reached',
        message: 'Your organization has reached its maximum member capacity.'
      },
      'you are not allowed to invite user with this role': {
        title: 'Role permission denied',
        message: 'You do not have permission to invite users with this role.'
      },
      'Inviter is no longer a member of the organization': {
        title: 'Permission expired',
        message: 'You are no longer a member of this organization and cannot send invitations.'
      }
    };

    // Check error code first (more reliable)
    if (errorCode && errorMappings[errorCode]) {
      return errorMappings[errorCode];
    }

    // Check for message matches as fallback
    for (const [key, value] of Object.entries(errorMappings)) {
      if (errorMessage.includes(key)) {
        return value;
      }
    }

    // Default error handling
    return {
      title: 'Error sending invitation',
      message: errorMessage || 'Failed to send invitation'
    };
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {

    if (e) {
      e.preventDefault();
    }

    if (!email.trim()) {
      toastError('Email required', 'Please enter an email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toastError('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await organization.inviteMember({
        email: email.trim(),
        role: role as "member" | "admin" | "owner",
        organizationId, // Optional if using active organization
      });

      // Check if result contains an error (some better-auth methods return errors instead of throwing)
      if (result && result.error) {
        console.error('Error inviting user (from result):', result.error);
        const { title, message } = getErrorMessage(result.error);
        toastError(title, message);
        return;
      }

      // Only show success toast if we reach this point (no exception thrown and no error in result)
      toastSuccess('Invitation sent successfully', `An invitation has been sent to ${email}.`);
      setEmail('');
      setRole('member');
      onInviteSent();
      onClose();
    } catch (error: any) {
      console.error('Error inviting user (caught exception):', error);

      // Use enhanced error handling
      const { title, message } = getErrorMessage(error);
      toastError(title, message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setEmail('');
      setRole('member');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization. They'll receive an email with instructions to sign up and join.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={isLoading}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">
                  <div className="flex flex-col">
                    <span>Member</span>
                    <span className="text-xs text-muted-foreground">
                      Can view and create forms within the organization
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="owner">
                  <div className="flex flex-col">
                    <span>Owner</span>
                    <span className="text-xs text-muted-foreground">
                      Full access including member management
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !email.trim()}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};