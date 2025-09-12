import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import { organization } from '../lib/auth-client';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onInviteSent?: () => void;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onInviteSent,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: inviteError } = await organization.inviteMember({
        email: email.trim(),
        role: role as 'member' | 'admin' | 'owner',
        organizationId,
      });

      if (inviteError) {
        throw new Error(inviteError.message || 'Failed to send invitation');
      }

      // Reset form
      setEmail('');
      setRole('member');
      onOpenChange(false);
      
      // Notify parent component
      onInviteSent?.();
    } catch (err) {
      console.error('Failed to send invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEmail('');
    setRole('member');
    setError(null);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Invite User to {organizationName}</AlertDialogTitle>
          <AlertDialogDescription>
            Send an invitation to join your organization. They'll receive an email with instructions to accept the invitation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={error ? 'border-red-500' : ''}
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              {error}
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            <strong>Member:</strong> Can view and respond to forms<br />
            <strong>Owner:</strong> Full access including inviting users and managing the organization
          </div>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};