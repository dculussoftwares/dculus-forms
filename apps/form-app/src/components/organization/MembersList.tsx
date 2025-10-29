import React from 'react';
import { Badge, Avatar, AvatarFallback, AvatarImage } from '@dculus/ui';
import { Crown, User } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

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
  const { t } = useTranslation('settings');

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">{t('members.emptyTitle')}</h3>
        <p className="text-muted-foreground">{t('members.emptyDescription')}</p>
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
        return t('members.roles.owner');
      case 'member':
        return t('members.roles.member');
      default:
        return t('members.roles.default', { values: { role } });
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
        <h3 className="text-lg font-medium">{t('members.title')}</h3>
        <Badge variant="outline">
          {members.length === 1
            ? t('members.count.one')
            : t('members.count.other', { values: { count: members.length } })}
        </Badge>
      </div>
      
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage
                  src={member.user.image || "https://github.com/shadcn.png"}
                  alt={member.user.name}
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {member.user.email.charAt(0).toUpperCase()}
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
