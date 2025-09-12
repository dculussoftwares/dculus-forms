import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@dculus/ui';
import { Users, UserPlus, Settings as SettingsIcon } from 'lucide-react';
import { GET_ORGANIZATION_INVITATIONS } from '../../graphql/invitations';
import { useAuthContext } from '../../contexts/AuthContext';
import { MembersList } from './MembersList';
import { InvitationsList } from './InvitationsList';
import { InviteUserDialog } from './InviteUserDialog';

export const OrganizationSettings: React.FC = () => {
  const { activeOrganization } = useAuthContext();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('members');

  const { data: invitationsData, refetch: refetchInvitations } = useQuery(
    GET_ORGANIZATION_INVITATIONS,
    {
      variables: { organizationId: activeOrganization?.id },
      skip: !activeOrganization?.id,
    }
  );

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

  const pendingInvitations = invitationsData?.organizationInvitations || [];

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
                Pending Invitations ({pendingInvitations.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="members" className="mt-6">
              <MembersList organization={activeOrganization as any} />
            </TabsContent>
            
            <TabsContent value="invitations" className="mt-6">
              <InvitationsList
                invitations={pendingInvitations}
                onInvitationAction={() => {
                  refetchInvitations();
                }}
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
          refetchInvitations();
          setActiveTab('invitations');
        }}
      />
    </div>
  );
};