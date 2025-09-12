import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@dculus/ui';
import { Users, UserPlus, Settings as SettingsIcon } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { MembersList } from './MembersList';
import { InvitationsList } from './InvitationsList';
import { InviteUserDialog } from './InviteUserDialog';
import { organization } from '../../lib/auth-client';

export const OrganizationSettings: React.FC = () => {
  const { activeOrganization } = useAuthContext();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);

  const fetchInvitations = async () => {
    if (!activeOrganization?.id) return;
    
    try {
      const invitations = await organization.listInvitations({
        query: {
          organizationId: activeOrganization.id,
        },
      });
      
      
      // Handle different possible response structures
      if (Array.isArray(invitations)) {
        setPendingInvitations(invitations);
      } else if (invitations && Array.isArray(invitations.data)) {
        setPendingInvitations(invitations.data);
      } else if (invitations && typeof invitations === 'object' && !Array.isArray(invitations)) {
        // If it's an object, it might contain the invitations as a property
        const invitationArray = Object.values(invitations).find(val => Array.isArray(val));
        setPendingInvitations(invitationArray || []);
      } else {
        console.warn('Unexpected invitations response format:', invitations);
        setPendingInvitations([]);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
      setPendingInvitations([]);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [activeOrganization?.id]);

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