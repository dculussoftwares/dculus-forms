import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Pencil, UserPlus, X } from 'lucide-react';
import { Button, Card, Input, toastSuccess, toastError } from '@dculus/ui';
import { useAuthContext } from '../../contexts/AuthContext';
import { MembersList } from '../organization/MembersList';
import { InvitationsList } from '../organization/InvitationsList';
import { InviteUserDialog } from '../organization/InviteUserDialog';
import { organization } from '../../lib/auth-client';
import { useTranslation } from '../../hooks/useTranslation';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql';
import { extractGraphQLErrorCode } from '../../utils/graphqlErrors';

export function MembersSettings() {
  const { t } = useTranslation('settings');
  const { activeOrganization, user, refetchOrganization, isLoading } = useAuthContext();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const currentUserRole =
    activeOrganization?.members?.find((m: any) => m.user.id === user?.id)?.role ?? 'member';
  const isOwner = currentUserRole === 'owner';

  const fetchInvitations = useCallback(async () => {
    if (!activeOrganization?.id) return;
    try {
      const invitations = await organization.listInvitations({
        query: { organizationId: activeOrganization.id },
      });
      let all: any[] = [];
      if (Array.isArray(invitations)) {
        all = invitations;
      } else if (invitations && Array.isArray((invitations as any).data)) {
        all = (invitations as any).data;
      } else if (invitations && typeof invitations === 'object') {
        const found = Object.values(invitations).find((v) => Array.isArray(v));
        all = (found as any[]) || [];
      }
      setPendingInvitations(all.filter((inv) => inv.status === 'pending'));
    } catch (error: any) {
      setPendingInvitations([]);
      const code = extractGraphQLErrorCode(error);
      if (code === GRAPHQL_ERROR_CODES.NO_ACCESS) {
        toastError(t('toasts.accessDenied.title'), t('toasts.accessDenied.description'));
      } else if (code === GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED) {
        toastError(t('toasts.authRequired.title'), t('toasts.authRequired.description'));
      }
    }
  }, [activeOrganization?.id, t]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  useEffect(() => {
    if (isEditingName) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [isEditingName]);

  const startEditName = () => {
    setEditName(activeOrganization?.name ?? '');
    setIsEditingName(true);
  };

  const cancelEditName = () => {
    setIsEditingName(false);
    setEditName('');
  };

  const saveOrgName = async () => {
    if (!activeOrganization || !editName.trim() || editName.trim() === activeOrganization.name) {
      cancelEditName();
      return;
    }
    setIsSavingName(true);
    try {
      const { error } = await organization.update({
        data: { name: editName.trim() },
        organizationId: activeOrganization.id,
      });
      if (error) throw error;
      toastSuccess(t('orgEdit.toasts.updated.title'), t('orgEdit.toasts.updated.description'));
      refetchOrganization();
      setIsEditingName(false);
    } catch {
      toastError(t('orgEdit.toasts.updateError.title'), t('orgEdit.toasts.updateError.description'));
    } finally {
      setIsSavingName(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl animate-pulse space-y-4 pt-2">
        <div className="h-7 w-56 rounded bg-[#e5e7eb]" />
        <div className="h-4 w-80 rounded bg-[#e5e7eb]" />
        <div className="h-32 rounded-xl bg-[#e5e7eb]" />
      </div>
    );
  }
  if (!activeOrganization) return null;

  return (
    <div className="space-y-4">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#262627]">{t('membersPage.title')}</h1>
          <p className="mt-1 text-sm text-[#655d67]">{t('membersPage.subtitle')}</p>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)}
          className="bg-[#3c323e] hover:bg-[#2e2530] text-white">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('membersPage.inviteButton')}
        </Button>
      </div>

      {/* Org name card — owners only */}
      {isOwner && (
        <Card className="p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#655d67]">
            {t('membersPage.orgNameLabel')}
          </p>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                ref={nameInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveOrgName();
                  if (e.key === 'Escape') cancelEditName();
                }}
                className="h-8 max-w-xs text-sm"
                disabled={isSavingName}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={saveOrgName}
                disabled={isSavingName || !editName.trim()}
                className="h-7 w-7 p-0 text-[#166534] hover:bg-[#f0fdf4]"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelEditName}
                disabled={isSavingName}
                className="h-7 w-7 p-0 text-[#655d67]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group/name">
              <span className="text-sm font-medium text-[#3c323e]">{activeOrganization.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={startEditName}
                className="h-6 w-6 p-0 text-[#655d67] opacity-0 group-hover/name:opacity-100 transition-opacity"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Members list — MembersList renders its own title/count */}
      <Card className="p-5">
        <MembersList
          organization={activeOrganization as any}
          currentUserId={user?.id ?? ''}
          currentUserRole={currentUserRole}
          onMemberChange={refetchOrganization}
        />
      </Card>

      {/* Pending invitations */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[rgba(81,76,84,0.08)] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[#3c323e]">
            {t('invitations.title')}
            <span className="ml-2 font-normal text-[#655d67]">{pendingInvitations.length}</span>
          </h2>
        </div>
        <div className="p-5">
          {pendingInvitations.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#b0a8b2]">{t('invitations.emptyTitle')}</p>
          ) : (
            <InvitationsList
              invitations={pendingInvitations}
              organizationId={activeOrganization.id}
              onInvitationAction={fetchInvitations}
            />
          )}
        </div>
      </Card>

      <InviteUserDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        organizationId={activeOrganization.id}
        onInviteSent={() => { fetchInvitations(); setIsInviteDialogOpen(false); }}
      />
    </div>
  );
}
