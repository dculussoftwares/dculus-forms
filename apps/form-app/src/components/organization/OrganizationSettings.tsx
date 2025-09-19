import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Tabs, TabsContent, TabsList, TabsTrigger, Alert, AlertDescription, toastError } from '@dculus/ui';
import { Users, UserPlus, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { MembersList } from './MembersList';
import { InvitationsList } from './InvitationsList';
import { InviteUserDialog } from './InviteUserDialog';
import { organization } from '../../lib/auth-client';

export const OrganizationSettings: React.FC = () => {
  const { activeOrganization, organizationError } = useAuthContext();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [pendingInvitations, setPendingInvitations] = useState<Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
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
  }>>([]);

  const fetchInvitations = async () => {
    if (!activeOrganization?.id) return;
    
    try {
      const invitations = await organization.listInvitations({
        query: {
          organizationId: activeOrganization.id,
        },
      });
      
      
      // Handle different possible response structures and filter for pending only
      let allInvitations = [];
      if (Array.isArray(invitations)) {
        allInvitations = invitations;
      } else if (invitations && Array.isArray(invitations.data)) {
        allInvitations = invitations.data;
      } else if (invitations && typeof invitations === 'object' && !Array.isArray(invitations)) {
        // If it's an object, it might contain the invitations as a property
        const invitationArray = Object.values(invitations).find(val => Array.isArray(val));
        allInvitations = invitationArray || [];
      } else {
        console.warn('Unexpected invitations response format:', invitations);
        allInvitations = [];
      }
      
      // Filter to only show pending invitations (exclude canceled/cancelled and accepted)
      const pendingOnly = allInvitations.filter(invitation => 
        invitation.status === 'pending'
      );
      
      setPendingInvitations(pendingOnly);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
      setPendingInvitations([]);

      // Show user-friendly error for authorization failures
      if (error?.message?.includes('Access denied') || error?.message?.includes('not a member')) {
        toastError('Access Denied', 'You do not have permission to view organization invitations');
      } else if (error?.message?.includes('Authentication required')) {
        toastError('Authentication Required', 'Please sign in to view invitations');
      }
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [activeOrganization?.id]);

  // Show error state if there's an organization error
  if (organizationError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>Error accessing organization</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {organizationError.includes('Access denied') || organizationError.includes('not a member')
                ? 'You do not have access to this organization. Please contact an organization owner for access.'
                : organizationError}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!activeOrganization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>No active organization selected</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please select an organization to manage settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                {activeOrganization.name}
              </CardTitle>
              <CardDescription>
                Manage your organization members and invitations
              </CardDescription>
            </div>
            <Button onClick={() => setIsInviteDialogOpen(true)} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members ({activeOrganization.members?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Pending Invitations ({Array.isArray(pendingInvitations) ? pendingInvitations.length : 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="members" className="mt-6">
              <MembersList organization={activeOrganization as any} />
            </TabsContent>
            
            <TabsContent value="invitations" className="mt-6">
              <InvitationsList
                invitations={pendingInvitations}
                onInvitationAction={fetchInvitations}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <InviteUserDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        organizationId={activeOrganization.id}
        onInviteSent={() => {
          fetchInvitations();
          setActiveTab('invitations');
        }}
      />
    </div>
  );
};