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
      await organization.inviteMember({
        email: email.trim(),
        role: role as "member" | "admin" | "owner",
        organizationId, // Optional if using active organization
      });
      
      toastSuccess('Invitation sent successfully', `An invitation has been sent to ${email}.`);
      setEmail('');
      setRole('member');
      onInviteSent();
      onClose();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toastError('Error sending invitation', error.message || 'Failed to send invitation');
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