import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
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
  toast,
} from '@dculus/ui';
import { Mail, UserPlus } from 'lucide-react';
import { INVITE_USER } from '../../graphql/invitations';
import { InviteUserInput } from '../../graphql/invitations';

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
  const [role, setRole] = useState('companyMember');
  const [isLoading, setIsLoading] = useState(false);

  const [inviteUser] = useMutation(INVITE_USER, {
    onCompleted: () => {
      toast({
        title: 'Invitation sent successfully',
        description: `An invitation has been sent to ${email}.`,
      });
      setEmail('');
      setRole('companyMember');
      onInviteSent();
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error sending invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address.',
        variant: 'destructive',
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const input: InviteUserInput = {
        organizationId,
        email: email.trim(),
        role,
      };

      await inviteUser({
        variables: { input },
      });
    } catch (error) {
      console.error('Error inviting user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setEmail('');
      setRole('companyMember');
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
                <SelectItem value="companyMember">
                  <div className="flex flex-col">
                    <span>Member</span>
                    <span className="text-xs text-muted-foreground">
                      Can view and create forms within the organization
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="companyOwner">
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