import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Tabs, TabsContent, TabsList, TabsTrigger, Alert, AlertDescription, toastError } from '@dculus/ui';
import { Users, UserPlus, Settings as SettingsIcon, AlertTriangle, CreditCard } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { MembersList } from './MembersList';
import { InvitationsList } from './InvitationsList';
import { InviteUserDialog } from './InviteUserDialog';
import { SubscriptionDashboard } from '../subscription/SubscriptionDashboard';
import { organization } from '../../lib/auth-client';
import { useTranslation } from '../../hooks/useTranslation';

interface OrganizationSettingsProps {
  initialTab?: string;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({ initialTab }) => {
  const { activeOrganization, organizationError } = useAuthContext();
  const navigate = useNavigate();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab && ['team', 'subscription'].includes(initialTab) ? initialTab : 'team');
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
  const { t } = useTranslation('settings');

  const fetchInvitations = useCallback(async () => {
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
        toastError(t('toasts.accessDenied.title'), t('toasts.accessDenied.description'));
      } else if (error?.message?.includes('Authentication required')) {
        toastError(t('toasts.authRequired.title'), t('toasts.authRequired.description'));
      }
    }
  }, [activeOrganization?.id, t]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(`/settings/${value}`);
  };

  // Show error state if there's an organization error
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
              {organizationError.includes('Access denied') || organizationError.includes('not a member')
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

  const totalTeamMembers = (activeOrganization.members?.length || 0) + (Array.isArray(pendingInvitations) ? pendingInvitations.length : 0);
  const teamTabLabel = t('organization.tabs.teamWithCount', { values: { count: totalTeamMembers } });

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
                {t('organization.cardDescription')}
              </CardDescription>
            </div>
            <Button onClick={() => setIsInviteDialogOpen(true)} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t('organization.inviteButton')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {teamTabLabel}
              </TabsTrigger>
              <TabsTrigger value="subscription" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t('organization.tabs.subscription')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="mt-6 space-y-8">
              <MembersList organization={activeOrganization as any} />
              <div className="border-t pt-8">
                <InvitationsList
                  invitations={pendingInvitations}
                  onInvitationAction={fetchInvitations}
                />
              </div>
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
        onInviteSent={() => {
          fetchInvitations();
          handleTabChange('team');
        }}
      />
    </div>
  );
};
