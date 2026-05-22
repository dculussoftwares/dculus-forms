import React from 'react';
import { UserAvatar } from '@dculus/ui';
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

  const getRoleBadgeClass = (role: string) => {
    return role === 'owner'
      ? 'bg-[#ddd6fa] text-[#5c2e6b] border border-[#c6b8fe]'
      : 'bg-[#f7f7f8] text-[#655d67] border border-[#dedcde]';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#3c323e]">{t('members.title')}</h3>
        <span className="inline-flex items-center text-xs font-medium bg-[#f6fafd] text-[#01487f] px-2.5 py-1 rounded-full">
          {members.length === 1
            ? t('members.count.one')
            : t('members.count.other', { values: { count: members.length } })}
        </span>
      </div>

      <div>
        {members.map((member, index) => (
          <div
            key={member.id}
            className={`flex items-center justify-between px-3 py-3.5 rounded-lg hover:bg-[rgba(87,84,91,0.06)] transition-colors ${
              index < members.length - 1 ? 'border-b border-[rgba(81,76,84,0.08)]' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                name={member.user.name}
                email={member.user.email}
                image={member.user.image}
                size="lg"
              />
              <div>
                <div className="text-sm font-medium text-[#3c323e]">{member.user.name}</div>
                <div className="text-xs text-[#655d67]">{member.user.email}</div>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${getRoleBadgeClass(member.role)}`}>
              {getRoleIcon(member.role)}
              {getRoleLabel(member.role)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
