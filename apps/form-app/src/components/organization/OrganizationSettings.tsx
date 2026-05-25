import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Tabs, TabsContent, TabsList, TabsTrigger,
  Alert, AlertDescription,
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Input,
  toastSuccess, toastError,
} from '@dculus/ui';
import {
  Users, UserPlus, Settings as SettingsIcon, AlertTriangle,
  CreditCard, Pencil, Check, X, LogOut,
} from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { MembersList } from './MembersList';
import { InvitationsList } from './InvitationsList';
import { InviteUserDialog } from './InviteUserDialog';
import { SubscriptionDashboard } from '../subscription/SubscriptionDashboard';
import { organization } from '../../lib/auth-client';
import { useTranslation } from '../../hooks/useTranslation';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql';
import { extractGraphQLErrorCode } from '../../utils/graphqlErrors';

interface OrganizationSettingsProps {
  initialTab?: string;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({ initialTab }) => {
  const { activeOrganization, organizationError, organizationErrorCode, user, refetchOrganization } = useAuthContext();
  const navigate = useNavigate();
  const { t } = useTranslation('settings');

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(
    initialTab && ['team', 'subscription'].includes(initialTab) ? initialTab : 'team'
  );
  const [pendingInvitations, setPendingInvitations] = useState<Array<{
    id: string; email: string; role: string; status: string;
    expiresAt: string; createdAt: string;
    inviter: { id: string; name: string; email: string };
    organization?: { id: string; name: string };
  }>>([]);

  // Org name inline edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Leave org state
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const fetchInvitations = useCallback(async () => {
    if (!activeOrganization?.id) return;
    try {
      const invitations = await organization.listInvitations({
        query: { organizationId: activeOrganization.id },
      });
      let allInvitations: any[] = [];
      if (Array.isArray(invitations)) {
        allInvitations = invitations;
      } else if (invitations && Array.isArray((invitations as any).data)) {
        allInvitations = (invitations as any).data;
      } else if (invitations && typeof invitations === 'object') {
        const found = Object.values(invitations).find((v) => Array.isArray(v));
        allInvitations = (found as any[]) || [];
      }
      setPendingInvitations(allInvitations.filter((inv) => inv.status === 'pending'));
    } catch (error: any) {
      setPendingInvitations([]);
      const errorCode = extractGraphQLErrorCode(error);
      if (errorCode === GRAPHQL_ERROR_CODES.NO_ACCESS) {
        toastError(t('toasts.accessDenied.title'), t('toasts.accessDenied.description'));
      } else if (errorCode === GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED) {
        toastError(t('toasts.authRequired.title'), t('toasts.authRequired.description'));
      }
    }
  }, [activeOrganization?.id, t]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  // Focus the name input when edit mode opens
  useEffect(() => {
    if (isEditingName) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isEditingName]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(`/settings/${value}`);
  };

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

  const handleLeaveOrg = async () => {
    if (!activeOrganization) return;
    setIsLeaving(true);
    try {
      const { error } = await organization.leave({
        organizationId: activeOrganization.id,
      });
      if (error) throw error;
      toastSuccess(t('dangerZone.leaveOrg.toasts.left.title'), t('dangerZone.leaveOrg.toasts.left.description'));
      navigate('/');
    } catch {
      toastError(t('dangerZone.leaveOrg.toasts.error.title'), t('dangerZone.leaveOrg.toasts.error.description'));
      setIsLeaving(false);
    }
  };

  if (organizationError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('organization.heading')}</CardTitle>
          <CardDescription>{t('organization.errorDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {organizationErrorCode === GRAPHQL_ERROR_CODES.NO_ACCESS
                ? t('organization.alerts.accessDenied')
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
          <CardTitle>{t('organization.heading')}</CardTitle>
          <CardDescription>{t('organization.noOrganizationDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('organization.noOrganizationHint')}</p>
        </CardContent>
      </Card>
    );
  }

  const currentUserRole =
    activeOrganization.members?.find((m) => m.user.id === user?.id)?.role ?? 'member';
  const isOwner = currentUserRole === 'owner';

  const totalTeamMembers =
    (activeOrganization.members?.length || 0) +
    (Array.isArray(pendingInvitations) ? pendingInvitations.length : 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-[rgba(81,76,84,0.12)] pb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ddd6fa] shrink-0">
                <SettingsIcon className="h-6 w-6 text-[#5c2e6b]" />
              </div>
              <div className="space-y-1">
                {/* Inline org name edit — owners only */}
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
                      className="h-8 text-lg font-semibold w-56"
                      placeholder={t('orgEdit.namePlaceholder')}
                      disabled={isSavingName}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={saveOrgName}
                      disabled={isSavingName || !editName.trim()}
                      className="h-7 w-7 p-0 text-[#166534] hover:text-[#166534] hover:bg-[#f0fdf4]"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEditName}
                      disabled={isSavingName}
                      className="h-7 w-7 p-0 text-[#655d67] hover:text-[#3c323e]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/name">
                    <CardTitle className="text-xl font-semibold tracking-tight">
                      {activeOrganization.name}
                    </CardTitle>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={startEditName}
                        className="h-6 w-6 p-0 text-[#655d67] opacity-0 group-hover/name:opacity-100 transition-opacity hover:text-[#3c323e] hover:bg-[rgba(87,84,91,0.08)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                <CardDescription className="text-sm text-muted-foreground">
                  {t('organization.cardDescription')}
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsInviteDialogOpen(true)} variant="default">
              <UserPlus className="mr-2 h-4 w-4" />
              {t('organization.inviteButton')}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6 w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="team" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t('organization.tabs.teamWithCount', { values: { count: totalTeamMembers } })}
              </TabsTrigger>
              <TabsTrigger value="subscription" className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                {t('organization.tabs.subscription')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="mt-6 space-y-8">
              <MembersList
                organization={activeOrganization as any}
                currentUserId={user?.id ?? ''}
                currentUserRole={currentUserRole}
                onMemberChange={refetchOrganization}
              />

              <div className="border-t border-[rgba(81,76,84,0.08)] pt-8">
                <InvitationsList
                  invitations={pendingInvitations}
                  organizationId={activeOrganization.id}
                  onInvitationAction={fetchInvitations}
                />
              </div>

              {/* Danger zone — leave org (non-owners only) */}
              {!isOwner && (
                <div className="border-t border-[rgba(81,76,84,0.08)] pt-8">
                  <div className="rounded-xl border border-[rgba(206,93,85,0.25)] bg-[rgba(206,93,85,0.04)] p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-[#ce5d55]">{t('dangerZone.title')}</h3>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-[#3c323e]">{t('dangerZone.leaveOrg.label')}</p>
                        <p className="text-xs text-[#655d67] mt-0.5">{t('dangerZone.leaveOrg.description')}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsLeaveDialogOpen(true)}
                        className="shrink-0 text-[#ce5d55] border-[rgba(206,93,85,0.4)] hover:bg-[rgba(206,93,85,0.08)] hover:text-[#ce5d55] hover:border-[rgba(206,93,85,0.6)]"
                      >
                        <LogOut className="mr-2 h-3.5 w-3.5" />
                        {t('dangerZone.leaveOrg.button')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscription" className="mt-6">
              <SubscriptionDashboard />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <InviteUserDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        organizationId={activeOrganization.id}
        onInviteSent={() => { fetchInvitations(); handleTabChange('team'); }}
      />

      {/* Leave organization confirm dialog */}
      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dangerZone.leaveOrg.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dangerZone.leaveOrg.dialog.description', {
                values: { name: activeOrganization.name },
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>
              {t('dangerZone.leaveOrg.dialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveOrg}
              disabled={isLeaving}
              className="bg-[#ce5d55] hover:bg-[#b94f47] text-white"
            >
              {isLeaving ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('dangerZone.leaveOrg.dialog.confirm')}
                </span>
              ) : (
                t('dangerZone.leaveOrg.dialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
