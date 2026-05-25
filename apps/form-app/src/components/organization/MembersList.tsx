import React, { useState } from 'react';
import {
  UserAvatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { Crown, Shield, User, MoreHorizontal, UserMinus, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseDate } from '@dculus/utils';
import { organization } from '../../lib/auth-client';
import { useTranslation } from '../../hooks/useTranslation';

interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface OrganizationWithMembers {
  id: string;
  name: string;
  members: Member[];
}

interface MembersListProps {
  organization: OrganizationWithMembers;
  currentUserId: string;
  currentUserRole: string;
  onMemberChange: () => void;
}

const ROLE_ORDER = ['owner', 'admin', 'member'];

export const MembersList: React.FC<MembersListProps> = ({
  organization: org,
  currentUserId,
  currentUserRole,
  onMemberChange,
}) => {
  const { t } = useTranslation('settings');
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);

  const members = [...(org.members || [])].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-3.5 w-3.5" />;
      case 'admin': return <Shield className="h-3.5 w-3.5" />;
      default: return <User className="h-3.5 w-3.5" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t('members.roles.owner');
      case 'admin': return t('members.roles.admin');
      case 'member': return t('members.roles.member');
      default: return t('members.roles.default', { values: { role } });
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-[#ddd6fa] text-[#5c2e6b] border border-[#c6b8fe]';
      case 'admin': return 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]';
      default: return 'bg-[#f7f7f8] text-[#655d67] border border-[#dedcde]';
    }
  };

  const handleRoleChange = async (member: Member, newRole: 'owner' | 'admin' | 'member') => {
    if (member.role === newRole) return;
    setLoadingMemberId(member.id);
    try {
      const { error } = await organization.updateMemberRole({
        memberId: member.id,
        role: newRole,
        organizationId: org.id,
      });
      if (error) throw error;
      toastSuccess(
        t('members.toasts.roleUpdated.title'),
        t('members.toasts.roleUpdated.description', {
          values: { name: member.user.name, role: getRoleLabel(newRole) },
        })
      );
      onMemberChange();
    } catch {
      toastError(t('members.toasts.roleUpdateError.title'), t('members.toasts.roleUpdateError.description'));
    } finally {
      setLoadingMemberId(null);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) return;
    setLoadingMemberId(memberToRemove.id);
    try {
      const { error } = await organization.removeMember({
        memberIdOrEmail: memberToRemove.id,
        organizationId: org.id,
      });
      if (error) throw error;
      toastSuccess(
        t('members.toasts.memberRemoved.title'),
        t('members.toasts.memberRemoved.description', { values: { name: memberToRemove.user.name } })
      );
      onMemberChange();
    } catch {
      toastError(t('members.toasts.removeError.title'), t('members.toasts.removeError.description'));
    } finally {
      setLoadingMemberId(null);
      setMemberToRemove(null);
    }
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">{t('members.emptyTitle')}</h3>
        <p className="text-muted-foreground">{t('members.emptyDescription')}</p>
      </div>
    );
  }

  return (
    <>
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
          {members.map((member, index) => {
            const isCurrentUser = member.user.id === currentUserId;
            const isLoading = loadingMemberId === member.id;
            const isOwner = member.role === 'owner';
            const canActOnMember = canManageMembers && !isCurrentUser && !isOwner;

            return (
              <div
                key={member.id}
                className={`flex items-center justify-between px-3 py-3.5 rounded-lg transition-colors
                  ${isLoading ? 'opacity-60 pointer-events-none' : 'hover:bg-[rgba(87,84,91,0.06)]'}
                  ${index < members.length - 1 ? 'border-b border-[rgba(81,76,84,0.08)]' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={member.user.name}
                    email={member.user.email}
                    image={member.user.image}
                    size="lg"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#3c323e]">{member.user.name}</span>
                      {isCurrentUser && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                          {t('members.you')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#655d67]">
                      <span>{member.user.email}</span>
                      {member.createdAt && (
                        <>
                          <span>·</span>
                          <span>
                            {t('members.joinedAgo', {
                              values: {
                                time: formatDistanceToNow(parseDate(member.createdAt), { addSuffix: true }),
                              },
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${getRoleBadgeClass(member.role)}`}>
                    {getRoleIcon(member.role)}
                    {getRoleLabel(member.role)}
                  </span>

                  {canActOnMember && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[#655d67] hover:text-[#3c323e] hover:bg-[rgba(87,84,91,0.08)]"
                          disabled={isLoading}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <div className="px-2 py-1.5 text-xs font-medium text-[#655d67]">
                          {t('members.actions.changeRole')}
                        </div>
                        {(['owner', 'admin', 'member'] as const)
                          .filter((r) => r !== member.role)
                          .map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => handleRoleChange(member, role)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              {getRoleIcon(role)}
                              <span>{getRoleLabel(role)}</span>
                              <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-0" />
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setMemberToRemove(member)}
                          className="flex items-center gap-2 cursor-pointer text-[#ce5d55] focus:text-[#ce5d55] focus:bg-[rgba(206,93,85,0.08)]"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          {t('members.actions.remove')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('members.removeDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('members.removeDialog.description', {
                values: { name: memberToRemove?.user.name ?? '' },
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('members.removeDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-[#ce5d55] hover:bg-[#b94f47] text-white"
            >
              {t('members.removeDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
