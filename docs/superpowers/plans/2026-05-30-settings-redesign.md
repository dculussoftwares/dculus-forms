# Settings Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the double-nested tab settings UI with a Typeform-style grouped left sidebar containing Profile, Members, and Billing & Plans sections.

**Architecture:** New `components/settings/` folder holds three dedicated page components (`ProfileSettings`, `MembersSettings`, `BillingSettings`) plus a shared `SettingsNav` sidebar. `Settings.tsx` becomes a thin shell that renders the sidebar + active section. Old URLs (`/settings/account`, `/settings/team`, `/settings/subscription`) redirect to new equivalents via `useEffect`. Old components (`OrganizationSettings`, `AccountSettings`, `SubscriptionDashboard`) are kept untouched until a final cleanup commit.

**Tech Stack:** React, React Router v6 (`useParams`, `useNavigate`), Apollo Client (`useQuery`, `useMutation`), `@dculus/ui`, `lucide-react`, `useTranslation` hook, `useAuthContext`, `organization` from `../../lib/auth-client`.

---

## File Map

| Action | Path |
|---|---|
| Modify | `apps/form-app/src/App.tsx` — rename route param `:tab?` → `:section?` |
| Rewrite | `apps/form-app/src/pages/Settings.tsx` |
| Create | `apps/form-app/src/components/settings/SettingsNav.tsx` |
| Create | `apps/form-app/src/components/settings/ProfileSettings.tsx` |
| Create | `apps/form-app/src/components/settings/MembersSettings.tsx` |
| Create | `apps/form-app/src/components/settings/BillingSettings.tsx` |
| Modify | `apps/form-app/src/locales/en/settings.json` |
| Modify | `apps/form-app/src/locales/ta/settings.json` |

---

## Task 1: Add new locale strings

**Files:**
- Modify: `apps/form-app/src/locales/en/settings.json`
- Modify: `apps/form-app/src/locales/ta/settings.json`

No frontend unit tests exist for locales — verify by running `pnpm type-check` and checking the browser after Task 6.

- [ ] **Step 1: Add new top-level keys to `en/settings.json`**

In `apps/form-app/src/locales/en/settings.json`, add the following four top-level keys before the final closing `}`. Add a comma after the last existing key first.

```json
"nav": {
  "sectionAccount": "Account",
  "sectionOrganization": "Organization",
  "profile": "Profile",
  "members": "Members",
  "billing": "Billing & Plans"
},
"profile": {
  "title": "Profile",
  "subtitle": "Update your personal details and avatar"
},
"billing": {
  "title": "Billing & Plans",
  "subtitle": "Manage your subscription, usage, and plan",
  "manageBilling": "Manage billing",
  "upgradePlan": "Upgrade Plan",
  "billingPeriod": "{{start}} – {{end}} · {{days}} days remaining",
  "sectionUsage": "Usage this period",
  "viewTrends": "View daily trends",
  "hideTrends": "Hide daily trends",
  "sectionPlans": "Plans",
  "currentPlan": "Current plan",
  "upgradeArrow": "Upgrade →",
  "perMonth": "from ${{price}} / month",
  "free": "$0 / month",
  "loadingSubscription": "Loading subscription…",
  "noSubscription": "No active subscription",
  "portalOpening": "Opening billing portal",
  "portalOpeningDesc": "Manage your subscription in the new tab",
  "portalError": "Failed to open portal"
},
"membersPage": {
  "title": "Members",
  "subtitle": "Manage team access to your organization",
  "inviteButton": "Invite member",
  "orgNameLabel": "Organization name",
  "orgNameSave": "Save"
}
```

- [ ] **Step 2: Add the same keys in Tamil to `ta/settings.json`**

In `apps/form-app/src/locales/ta/settings.json`, add before the final `}`:

```json
"nav": {
  "sectionAccount": "கணக்கு",
  "sectionOrganization": "நிறுவனம்",
  "profile": "சுயவிவரம்",
  "members": "உறுப்பினர்கள்",
  "billing": "பில்லிங் & திட்டங்கள்"
},
"profile": {
  "title": "சுயவிவரம்",
  "subtitle": "உங்கள் தனிப்பட்ட விவரங்கள் மற்றும் அவதாரை புதுப்பிக்கவும்"
},
"billing": {
  "title": "பில்லிங் & திட்டங்கள்",
  "subtitle": "உங்கள் சந்தா, பயன்பாடு மற்றும் திட்டத்தை நிர்வகிக்கவும்",
  "manageBilling": "பில்லிங் நிர்வகிக்கவும்",
  "upgradePlan": "திட்டத்தை மேம்படுத்தவும்",
  "billingPeriod": "{{start}} – {{end}} · {{days}} நாட்கள் மீதமுள்ளது",
  "sectionUsage": "இந்த காலகட்டத்தில் பயன்பாடு",
  "viewTrends": "தினசரி போக்குகளை காண்க",
  "hideTrends": "தினசரி போக்குகளை மறை",
  "sectionPlans": "திட்டங்கள்",
  "currentPlan": "தற்போதைய திட்டம்",
  "upgradeArrow": "மேம்படுத்து →",
  "perMonth": "${{price}} / மாதம் முதல்",
  "free": "$0 / மாதம்",
  "loadingSubscription": "சந்தாவை ஏற்றுகிறது…",
  "noSubscription": "செயலில் சந்தா இல்லை",
  "portalOpening": "பில்லிங் போர்ட்டலைத் திறக்கிறது",
  "portalOpeningDesc": "புதிய தாவலில் உங்கள் சந்தாவை நிர்வகிக்கவும்",
  "portalError": "போர்ட்டலைத் திறக்க முடியவில்லை"
},
"membersPage": {
  "title": "உறுப்பினர்கள்",
  "subtitle": "உங்கள் நிறுவனத்திற்கான குழு அணுகலை நிர்வகிக்கவும்",
  "inviteButton": "உறுப்பினரை அழைக்கவும்",
  "orgNameLabel": "நிறுவன பெயர்",
  "orgNameSave": "சேமி"
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/locales/en/settings.json apps/form-app/src/locales/ta/settings.json
git commit -m "feat(settings): add nav/profile/billing/membersPage locale keys (en + ta)"
```

---

## Task 2: Create SettingsNav component

**Files:**
- Create: `apps/form-app/src/components/settings/SettingsNav.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../hooks/useTranslation';

const REDIRECT_MAP: Record<string, string> = {
  account: 'profile',
  team: 'members',
  subscription: 'billing',
};

export function SettingsNav() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('settings');

  const resolvedSection = section ? (REDIRECT_MAP[section] ?? section) : 'profile';

  function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
    return (
      <button
        onClick={() => navigate(`/settings/${to}`)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-[7px] text-sm transition-colors',
          resolvedSection === to
            ? 'bg-[rgba(87,84,91,0.07)] font-medium text-[#3c323e]'
            : 'text-[#655d67] hover:bg-[rgba(87,84,91,0.05)] hover:text-[#4c414e]'
        )}
      >
        <span className="w-[18px] text-center text-base leading-none">{icon}</span>
        {label}
      </button>
    );
  }

  return (
    <nav className="w-[200px] shrink-0 px-3 py-6">
      <div className="mb-2">
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-[#655d67]">
          {t('nav.sectionAccount')}
        </p>
        <NavItem to="profile" icon="👤" label={t('nav.profile')} />
      </div>
      <div className="my-3 border-t border-[rgba(81,76,84,0.08)]" />
      <div>
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-[#655d67]">
          {t('nav.sectionOrganization')}
        </p>
        <NavItem to="members" icon="👥" label={t('nav.members')} />
        <NavItem to="billing" icon="💳" label={t('nav.billing')} />
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/components/settings/SettingsNav.tsx
git commit -m "feat(settings): add SettingsNav grouped left sidebar component"
```

---

## Task 3: Create ProfileSettings component

**Files:**
- Create: `apps/form-app/src/components/settings/ProfileSettings.tsx`

ProfileSettings wraps the existing `AccountSettings` for profile editing and adds the "Leave Organization" danger zone for non-owners.

- [ ] **Step 1: Create the file**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import {
  Button,
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  toastSuccess, toastError,
} from '@dculus/ui';
import { AccountSettings } from '../account/AccountSettings';
import { useAuthContext } from '../../contexts/AuthContext';
import { organization } from '../../lib/auth-client';
import { useTranslation } from '../../hooks/useTranslation';

export function ProfileSettings() {
  const { t } = useTranslation('settings');
  const { activeOrganization, user } = useAuthContext();
  const navigate = useNavigate();
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const currentUserRole =
    activeOrganization?.members?.find((m: any) => m.user.id === user?.id)?.role ?? 'member';
  const isOwner = currentUserRole === 'owner';

  const handleLeaveOrg = async () => {
    if (!activeOrganization) return;
    setIsLeaving(true);
    try {
      const { error } = await organization.leave({ organizationId: activeOrganization.id });
      if (error) throw error;
      toastSuccess(t('dangerZone.leaveOrg.toasts.left.title'), t('dangerZone.leaveOrg.toasts.left.description'));
      navigate('/');
    } catch {
      toastError(t('dangerZone.leaveOrg.toasts.error.title'), t('dangerZone.leaveOrg.toasts.error.description'));
      setIsLeaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#3c323e]">{t('profile.title')}</h1>
        <p className="text-sm text-[#655d67]">{t('profile.subtitle')}</p>
      </div>

      <AccountSettings />

      {!isOwner && activeOrganization && (
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
      )}

      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dangerZone.leaveOrg.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dangerZone.leaveOrg.dialog.description', { values: { name: activeOrganization?.name ?? '' } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>{t('dangerZone.leaveOrg.dialog.cancel')}</AlertDialogCancel>
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
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/components/settings/ProfileSettings.tsx
git commit -m "feat(settings): add ProfileSettings component"
```

---

## Task 4: Create MembersSettings component

**Files:**
- Create: `apps/form-app/src/components/settings/MembersSettings.tsx`

Extracts the team management UI from OrganizationSettings — org name editing, members list, invitations list, invite dialog.

- [ ] **Step 1: Create the file**

```tsx
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
  const { activeOrganization, user, refetchOrganization } = useAuthContext();

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

  if (!activeOrganization) return null;

  return (
    <div className="space-y-4">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#3c323e]">{t('membersPage.title')}</h1>
          <p className="text-sm text-[#655d67]">{t('membersPage.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="mr-2 h-3.5 w-3.5" />
          {t('membersPage.inviteButton')}
        </Button>
      </div>

      {/* Org name card — owners only */}
      {isOwner && (
        <Card className="p-5">
          <p className="mb-2 text-xs font-medium text-[#655d67] uppercase tracking-wider">
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

      {/* Members list */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[rgba(81,76,84,0.08)] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[#3c323e]">
            {t('members.title')}
            <span className="ml-2 font-normal text-[#655d67]">
              {activeOrganization.members?.length ?? 0}
            </span>
          </h2>
        </div>
        <div className="p-5">
          <MembersList
            organization={activeOrganization as any}
            currentUserId={user?.id ?? ''}
            currentUserRole={currentUserRole}
            onMemberChange={refetchOrganization}
          />
        </div>
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
            <p className="text-center text-sm text-[#b0a8b2] py-4">{t('invitations.emptyTitle')}</p>
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/components/settings/MembersSettings.tsx
git commit -m "feat(settings): add MembersSettings component"
```

---

## Task 5: Create BillingSettings component

**Files:**
- Create: `apps/form-app/src/components/settings/BillingSettings.tsx`

New billing page: plan header card, usage card with collapsible chart, plan comparison strip.

- [ ] **Step 1: Create the file**

```tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronDown, CreditCard, ExternalLink, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, Button, toastSuccess, toastError } from '@dculus/ui';
import { cn } from '@dculus/utils';
import {
  GET_SUBSCRIPTION,
  GET_AVAILABLE_PLANS,
  GET_AI_TOKEN_USAGE,
  CREATE_PORTAL_SESSION,
} from '../../graphql/subscription';
import { UpgradeModal } from '../subscription/UpgradeModal';
import { UsageChart } from '../subscription/UsageChart';
import { useTranslation } from '../../hooks/useTranslation';

function getBarColor(pct: number | null | undefined): string {
  if (!pct) return 'bg-primary';
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 80) return 'bg-orange-500';
  return 'bg-primary';
}

function safeOpen(url: string, onError: (msg: string) => void) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('chargebee.com')) {
      onError('Invalid redirect URL');
      return;
    }
    window.open(url, '_blank');
  } catch {
    onError('Malformed redirect URL');
  }
}

function PlanPrice({ plan }: { plan: any }) {
  if (plan.id === 'free') return <span className="text-xs text-[#655d67]">$0 / month</span>;
  const usdMonthly = plan.prices?.find((p: any) => p.currency === 'USD' && p.period === 'month');
  if (!usdMonthly) return null;
  return (
    <span className="text-xs text-[#655d67]">
      from ${Math.round(usdMonthly.amount / 100)} / month
    </span>
  );
}

function UsageTile({
  icon, label, used, limit, unlimited, percentage, resetLabel,
}: {
  icon: React.ReactNode; label: string; used: number; limit: number | null;
  unlimited: boolean; percentage: number | null; resetLabel?: string;
}) {
  return (
    <div className="rounded-lg bg-[#f7f7f8] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-[#655d67]">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold text-[#3c323e]">
        {used.toLocaleString()}
        {!unlimited && limit && (
          <span className="ml-1 text-xs font-normal text-[#655d67]">
            / {limit.toLocaleString()}
          </span>
        )}
      </div>
      {unlimited ? (
        <p className="mt-1 text-xs text-[#177767]">Unlimited</p>
      ) : (
        <>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
            <div
              className={cn('h-full rounded-full transition-all', getBarColor(percentage))}
              style={{ width: `${Math.min(percentage ?? 0, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[#b0a8b2]">
            {(percentage ?? 0).toFixed(1)}%
            {resetLabel && ` · ${resetLabel}`}
          </p>
        </>
      )}
    </div>
  );
}

export function BillingSettings() {
  const { t } = useTranslation('settings');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const { data: subData, loading: subLoading } = useQuery(GET_SUBSCRIPTION);
  const { data: plansData } = useQuery(GET_AVAILABLE_PLANS);
  const [createPortalSession, { loading: portalLoading }] = useMutation(CREATE_PORTAL_SESSION);

  const subscription = subData?.activeOrganization?.subscription;
  const organizationId = subData?.activeOrganization?.id ?? '';

  const { data: tokenData } = useQuery(GET_AI_TOKEN_USAGE, {
    variables: { organizationId },
    skip: !organizationId,
  });

  const handleManageBilling = async () => {
    try {
      const { data } = await createPortalSession();
      if (data?.createPortalSession?.url) {
        safeOpen(data.createPortalSession.url, (msg) =>
          toastError(t('billing.portalError'), msg)
        );
        toastSuccess(t('billing.portalOpening'), t('billing.portalOpeningDesc'));
      }
    } catch (error: any) {
      toastError(t('billing.portalError'), error.message);
    }
  };

  if (subLoading) {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-[#3c323e]">{t('billing.title')}</h1>
          <p className="text-sm text-[#655d67]">{t('billing.subtitle')}</p>
        </div>
        <Card className="p-5 animate-pulse">
          <div className="h-5 w-40 rounded bg-[#e5e7eb] mb-3" />
          <div className="h-4 w-64 rounded bg-[#e5e7eb]" />
        </Card>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-[#3c323e]">{t('billing.title')}</h1>
          <p className="text-sm text-[#655d67]">{t('billing.subtitle')}</p>
        </div>
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-orange-400" />
          <p className="text-sm text-[#655d67]">{t('billing.noSubscription')}</p>
        </Card>
      </div>
    );
  }

  const { planId, status, usage, currentPeriodStart, currentPeriodEnd } = subscription;
  const planName = planId.charAt(0).toUpperCase() + planId.slice(1);

  const periodStart = new Date(Number(currentPeriodStart)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  const periodEnd = new Date(Number(currentPeriodEnd)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const daysRemaining = Math.max(
    0,
    Math.ceil((Number(currentPeriodEnd) - Date.now()) / 86_400_000)
  );

  const tokenUsage = tokenData?.aiTokenUsage;
  const tokenPct = tokenUsage && tokenUsage.limit > 0
    ? Math.min((tokenUsage.used / tokenUsage.limit) * 100, 100)
    : 0;
  const tokenResetDate = tokenUsage
    ? (() => {
        const d = new Date(tokenUsage.resetAt);
        return isNaN(d.getTime()) ? '' : `resets ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      })()
    : '';

  const plans: any[] = plansData?.availablePlans ?? [];
  const freePlan = { id: 'free', name: 'Free', features: { views: 10000, submissions: 1000 } };
  const allPlans = [freePlan, ...plans];

  const limitExceeded = usage.views.exceeded || usage.submissions.exceeded;

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#3c323e]">{t('billing.title')}</h1>
        <p className="text-sm text-[#655d67]">{t('billing.subtitle')}</p>
      </div>

      {/* Past due alert */}
      {status === 'past_due' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-red-700">
            Payment failed — please update your payment method.
          </div>
          <Button size="sm" variant="outline" onClick={handleManageBilling} disabled={portalLoading}
            className="shrink-0 border-red-300 text-red-700 hover:bg-red-100">
            <CreditCard className="mr-1.5 h-3 w-3" />
            Manage billing
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Limit exceeded alert */}
      {limitExceeded && (
        <div className="rounded-lg border border-[rgba(206,93,85,0.25)] bg-[rgba(206,93,85,0.06)] p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[#ce5d55] mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-[#ce5d55]">
            Usage limit exceeded. Upgrade to restore access.
          </div>
          <Button size="sm" onClick={() => setShowUpgradeModal(true)}
            className="shrink-0 bg-[#ce5d55] hover:bg-[#b94f47] text-white">
            <TrendingUp className="mr-1.5 h-3 w-3" />
            Upgrade Plan
          </Button>
        </div>
      )}

      {/* Plan header card */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-bold text-[#3c323e]">{planName} Plan</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(81,76,84,0.15)] bg-white px-2.5 py-0.5 text-xs font-medium text-[#4c414e]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#177767]" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#655d67]">
              {periodStart} – {periodEnd} · {daysRemaining} days remaining
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={portalLoading}
              className="gap-1.5 text-[#655d67]">
              <CreditCard className="h-3.5 w-3.5" />
              {t('billing.manageBilling')}
              <ExternalLink className="h-3 w-3" />
            </Button>
            {planId !== 'advanced' && (
              <Button size="sm" onClick={() => setShowUpgradeModal(true)}
                className="bg-[#177767] hover:bg-[#145f54] text-white">
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                {t('billing.upgradePlan')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Usage card */}
      <Card className="p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#655d67]">
          {t('billing.sectionUsage')}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <UsageTile
            icon={<span>👁</span>}
            label="Form Views"
            used={usage.views.used}
            limit={usage.views.limit}
            unlimited={usage.views.unlimited}
            percentage={usage.views.percentage}
          />
          <UsageTile
            icon={<span>📄</span>}
            label="Submissions"
            used={usage.submissions.used}
            limit={usage.submissions.limit}
            unlimited={usage.submissions.unlimited}
            percentage={usage.submissions.percentage}
          />
          {tokenUsage ? (
            <UsageTile
              icon={<span>✨</span>}
              label="AI Tokens"
              used={tokenUsage.used}
              limit={tokenUsage.limit}
              unlimited={false}
              percentage={tokenPct}
              resetLabel={tokenResetDate}
            />
          ) : (
            <div className="rounded-lg bg-[#f7f7f8] p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-[#655d67]">
                <span>✨</span> AI Tokens
              </div>
              <div className="text-sm text-[#b0a8b2]">– / –</div>
            </div>
          )}
        </div>

        {/* Collapsible chart */}
        <button
          onClick={() => setShowChart((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 border-t border-[rgba(81,76,84,0.08)] pt-3 text-xs font-medium text-[#655d67] hover:text-[#3c323e] transition-colors"
        >
          {showChart ? t('billing.hideTrends') : t('billing.viewTrends')}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showChart && 'rotate-180')} />
        </button>

        {showChart && (
          <div className="mt-3">
            <UsageChart
              viewsUsed={usage.views.used}
              submissionsUsed={usage.submissions.used}
              viewsLimit={usage.views.limit}
              submissionsLimit={usage.submissions.limit}
              currentPeriodStart={currentPeriodStart}
              currentPeriodEnd={currentPeriodEnd}
            />
          </div>
        )}
      </Card>

      {/* Plan comparison strip */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#655d67]">
          {t('billing.sectionPlans')}
        </p>
        <div className="grid grid-cols-3 divide-x divide-[rgba(81,76,84,0.1)] overflow-hidden rounded-xl border border-[rgba(81,76,84,0.12)] bg-white">
          {allPlans.map((plan) => {
            const isCurrent = plan.id === planId || (plan.id === 'free' && !plans.find((p) => p.id === planId));
            const views = plan.id === 'free' ? '10,000' : plan.id === 'starter' ? 'Unlimited' : 'Unlimited';
            const subs = plan.id === 'free' ? '1,000' : plan.id === 'starter' ? '10,000' : '100,000';
            const tokens = plan.id === 'free' ? '50k' : plan.id === 'starter' ? '500k' : '5M';
            return (
              <div
                key={plan.id}
                className={cn('p-4', isCurrent && 'bg-[rgba(87,84,91,0.03)]')}
              >
                <div className="mb-0.5 text-sm font-semibold text-[#3c323e]">
                  {plan.name ?? (plan.id === 'free' ? 'Free' : plan.id)}
                </div>
                <PlanPrice plan={plan} />
                <ul className="mt-2 space-y-0.5 text-xs text-[#655d67]">
                  <li>{views} views</li>
                  <li>{subs} submissions</li>
                  <li>{tokens} AI tokens</li>
                </ul>
                {isCurrent ? (
                  <span className="mt-3 inline-block rounded bg-[rgba(23,119,103,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[#177767]">
                    {t('billing.currentPlan')}
                  </span>
                ) : (
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="mt-3 text-xs font-medium text-[#177767] hover:underline"
                  >
                    {t('billing.upgradeArrow')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} currentPlan={planId} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/components/settings/BillingSettings.tsx
git commit -m "feat(settings): add BillingSettings component"
```

---

## Task 6: Rewrite Settings.tsx shell and update App.tsx route param

**Files:**
- Rewrite: `apps/form-app/src/pages/Settings.tsx`
- Modify: `apps/form-app/src/App.tsx` (one line)

- [ ] **Step 1: Update the route param in `App.tsx`**

Find this line in `apps/form-app/src/App.tsx`:
```tsx
<Route path="/settings/:tab?" element={
```
Change it to:
```tsx
<Route path="/settings/:section?" element={
```

- [ ] **Step 2: Rewrite `apps/form-app/src/pages/Settings.tsx`**

Replace the entire file content with:

```tsx
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/MainLayout';
import { SettingsNav } from '../components/settings/SettingsNav';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { MembersSettings } from '../components/settings/MembersSettings';
import { BillingSettings } from '../components/settings/BillingSettings';
import { useTranslation } from '../hooks/useTranslation';

const REDIRECT_MAP: Record<string, string> = {
  account: 'profile',
  team: 'members',
  subscription: 'billing',
};

const VALID_SECTIONS = new Set(['profile', 'members', 'billing']);

const Settings: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('settings');

  useEffect(() => {
    if (!section) {
      navigate('/settings/profile', { replace: true });
      return;
    }
    const redirect = REDIRECT_MAP[section];
    if (redirect) {
      navigate(`/settings/${redirect}`, { replace: true });
    }
  }, [section, navigate]);

  const resolvedSection = section
    ? (REDIRECT_MAP[section] ?? section)
    : 'profile';

  return (
    <MainLayout title={t('page.title')} subtitle={t('page.subtitle')}>
      <div className="flex min-h-0 flex-1 -mx-4 sm:-mx-6">
        <SettingsNav />
        <div className="flex-1 overflow-y-auto py-1 pr-4 sm:pr-6">
          {resolvedSection === 'profile' && <ProfileSettings />}
          {resolvedSection === 'members' && <MembersSettings />}
          {resolvedSection === 'billing' && <BillingSettings />}
          {!VALID_SECTIONS.has(resolvedSection) && <ProfileSettings />}
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
```

- [ ] **Step 3: Run type-check**

```bash
cd /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms && pnpm type-check 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors. If there are errors, fix them before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/pages/Settings.tsx apps/form-app/src/App.tsx
git commit -m "feat(settings): rewrite Settings shell with grouped sidebar nav"
```

---

## Task 7: Browser verification

- [ ] **Step 1: Ensure dev server is running**

```bash
pnpm dev
```

- [ ] **Step 2: Verify each section loads**

Navigate to each URL and confirm the correct section renders:
- `http://localhost:3000/settings/profile` → Profile section (avatar, name, email, leave org)
- `http://localhost:3000/settings/members` → Members section (org name, members list, invite button)
- `http://localhost:3000/settings/billing` → Billing section (plan header, usage tiles, plan strip)

- [ ] **Step 3: Verify redirects work**

Check old URLs redirect without a flash:
- `http://localhost:3000/settings` → should redirect to `/settings/profile`
- `http://localhost:3000/settings/account` → should redirect to `/settings/profile`
- `http://localhost:3000/settings/team` → should redirect to `/settings/members`
- `http://localhost:3000/settings/subscription` → should redirect to `/settings/billing`

- [ ] **Step 4: Verify the chart toggle**

On the Billing page, click "View daily trends ▾". The chart should expand. Click "Hide daily trends ▲". The chart should collapse.

- [ ] **Step 5: Cleanup commit — remove old components from the import graph**

Once all sections are verified, delete the now-unreferenced components:

```bash
rm apps/form-app/src/components/organization/OrganizationSettings.tsx
rm apps/form-app/src/components/account/AccountSettings.tsx  # keep the component itself, just verify it's still used by ProfileSettings
```

Wait — `AccountSettings.tsx` IS still used by `ProfileSettings.tsx` (it's rendered inside it). Do NOT delete it.

Only `OrganizationSettings.tsx` is no longer imported anywhere. Delete it:

```bash
rm apps/form-app/src/components/organization/OrganizationSettings.tsx
```

Then run type-check again to confirm nothing is broken:

```bash
pnpm type-check 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(settings): remove OrganizationSettings now superseded by sidebar nav"
```
