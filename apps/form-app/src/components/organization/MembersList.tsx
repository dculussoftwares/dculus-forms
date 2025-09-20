import React from 'react';
import { Badge, Avatar, AvatarFallback, AvatarImage } from '@dculus/ui';
import { Crown, User } from 'lucide-react';

interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface OrganizationWithMembers {
  id: string;
  name: string;
  members: Member[];
}

interface MembersListProps {
  organization: OrganizationWithMembers;
}

export const MembersList: React.FC<MembersListProps> = ({ organization }) => {
  const members = organization.members || [];

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">No members found</h3>
        <p className="text-muted-foreground">This organization doesn't have any members yet.</p>
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
        <h3 className="text-lg font-medium">Organization Members</h3>
        <Badge variant="outline">{members.length} member{members.length !== 1 ? 's' : ''}</Badge>
      </div>
      
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={member.user.image} alt={member.user.name} />
                <AvatarFallback>
                  {member.user.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{member.user.name}</div>
                <div className="text-sm text-muted-foreground">{member.user.email}</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1">
                {getRoleIcon(member.role)}
                {getRoleLabel(member.role)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};