import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingSpinner,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@dculus/ui';
import { organization } from '../lib/auth-client';
import { InviteUserModal } from './InviteUserModal';
import { MoreHorizontal, UserPlus, Mail, Trash2, Crown, User } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviter: {
    id: string;
    name: string;
  };
}

interface MembersTableProps {
  organizationId: string;
  organizationName: string;
  currentUserId: string;
}

export const MembersTable: React.FC<MembersTableProps> = ({
  organizationId,
  organizationName,
  currentUserId,
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [cancelInviteId, setCancelInviteId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load members
      const membersResult = await organization.listMembers({
        query: { organizationId }
      });

      if (membersResult.error) {
        throw new Error(membersResult.error.message);
      }

      setMembers((membersResult.data?.members || []).map((member: any) => ({
        ...member,
        updatedAt: member.updatedAt || member.createdAt
      })));

      // Load invitations  
      const invitationsResult = await organization.listInvitations({
        query: { organizationId }
      });

      if (invitationsResult.error) {
        throw new Error(invitationsResult.error.message);
      }

      setInvitations((invitationsResult.data || []).map((invitation: any) => ({
        ...invitation,
        createdAt: invitation.createdAt || new Date().toISOString(),
        inviter: invitation.inviter || { id: '', name: 'Unknown' }
      })));
    } catch (err) {
      console.error('Failed to load members and invitations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await organization.cancelInvitation({
        invitationId,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Refresh data
      await loadData();
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
    setCancelInviteId(null);
  };

  const handleInviteSent = () => {
    loadData(); // Refresh the data to show new invitation
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Crown className="w-3 h-3 mr-1" />
          Owner
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <Crown className="w-3 h-3 mr-1" />
          Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <User className="w-3 h-3 mr-1" />
        Member
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Mail className="w-3 h-3 mr-1" />
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-2">Loading members...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadData} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Organization Members</CardTitle>
            <Button onClick={() => setInviteModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Members Table */}
            <div>
              <h4 className="font-medium mb-3">Active Members ({members.length})</h4>
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Role</th>
                      <th className="text-left p-3 font-medium">Joined</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b last:border-b-0">
                        <td className="p-3">
                          <div className="font-medium">{member.user.name}</div>
                          {member.userId === currentUserId && (
                            <span className="text-xs text-blue-600">(You)</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{member.user.email}</td>
                        <td className="p-3">{getRoleBadge(member.role)}</td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          {member.userId !== currentUserId && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove Member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    ))}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No members found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Pending Invitations ({invitations.length})</h4>
                <div className="border rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Role</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Invited By</th>
                        <th className="text-left p-3 font-medium">Expires</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.map((invitation) => (
                        <tr key={invitation.id} className="border-b last:border-b-0">
                          <td className="p-3 font-medium">{invitation.email}</td>
                          <td className="p-3">{getRoleBadge(invitation.role)}</td>
                          <td className="p-3">{getStatusBadge(invitation.status)}</td>
                          <td className="p-3 text-muted-foreground">{invitation.inviter.name}</td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(invitation.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelInviteId(invitation.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        organizationId={organizationId}
        organizationName={organizationName}
        onInviteSent={handleInviteSent}
      />

      <AlertDialog open={!!cancelInviteId} onOpenChange={() => setCancelInviteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this invitation? The user will no longer be able to accept it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelInviteId && handleCancelInvitation(cancelInviteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};