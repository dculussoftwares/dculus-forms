import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useParams, useNavigate } from 'react-router';
import { Button, LoadingSpinner, toastSuccess, toastError } from '@dculus/ui';
import {
  ArrowLeft, Building2, Users, FileText, BarChart3,
  Calendar, Mail, ExternalLink, AlertTriangle, CreditCard, RefreshCw, Loader2,
} from 'lucide-react';
import {
  ADMIN_ORGANIZATION_BY_ID_QUERY,
  ADMIN_SET_ENTERPRISE_PLAN_MUTATION,
  ADMIN_RESET_USAGE_MUTATION,
  ADMIN_CANCEL_SUBSCRIPTION_MUTATION,
  ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION,
  AdminOrganizationByIdQueryData,
  OrgSubscription,
} from '../../graphql/organizationDetail';
import {
  ADMIN_PLANS_QUERY,
  ADMIN_ASSIGN_PLAN_MUTATION,
  AdminPlansQueryData,
} from '../../graphql/plans';
import { CARD_STYLE, roleBadgeStyle } from '../../lib/cardTokens';

const CHARGEBEE_SITE = (import.meta as { env?: Record<string, string> }).env?.VITE_CHARGEBEE_SITE ?? '';

const MODAL_STYLE: React.CSSProperties = { border: '1px solid var(--tf-border-medium)', boxShadow: 'var(--shadow-xl)' };

const planBadgeStyle = (planId: string): React.CSSProperties => {
  switch (planId) {
    case 'starter':    return { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'advanced':   return { backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
    case 'enterprise': return { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
    default:           return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

// A limit input paired with an "Unlimited" toggle — null means unlimited, matching
// the Subscription schema's viewsLimit/submissionsLimit/aiCreditsLimit convention.
const LimitField: React.FC<{
  label: string;
  value: string;
  unlimited: boolean;
  onValueChange: (v: string) => void;
  onUnlimitedChange: (v: boolean) => void;
}> = ({ label, value, unlimited, onValueChange, onUnlimitedChange }) => (
  <div className="flex-1 min-w-[160px]">
    <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        step={1}
        className="w-full border rounded px-2 py-1.5 text-sm disabled:opacity-50"
        placeholder="0"
        value={value}
        disabled={unlimited}
        onChange={e => onValueChange(e.target.value)}
      />
      <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
        <input type="checkbox" checked={unlimited} onChange={e => onUnlimitedChange(e.target.checked)} />
        Unlimited
      </label>
    </div>
  </div>
);

const statusBadgeStyle = (status: string): React.CSSProperties => {
  switch (status) {
    case 'active':    return { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' };
    case 'past_due':  return { backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-lg)' };
    default:          return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

const UsageBar: React.FC<{ label: string; used: number; limit: number | null }> = ({ label, used, limit }) => {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = pct >= 100 ? 'var(--tf-error)' : pct >= 80 ? '#d97706' : 'var(--tf-green)';
  return (
    <div className="flex-1">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {limit == null ? 'Unlimited' : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </span>
      </div>
      {limit != null && (
        <>
          <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: 'var(--tf-faint)' }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
          <p className="text-[11px] mt-1 text-muted-foreground">{pct}% used</p>
        </>
      )}
    </div>
  );
};

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const daysRemaining = (endDate: string) => {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const OrganizationDetailPage = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'subscription'>('overview');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<
    null | 'changePlan' | 'setEnterprise' | 'resetUsage' | 'cancel' | 'reactivate'
  >(null);
  const [resetConfirmText, setResetConfirmText] = useState('');
  // Chargebee checkout URL returned after setting a paid enterprise deal —
  // shown in a modal so the admin can copy/share it (it's also emailed to the owner).
  const [enterpriseCheckoutUrl, setEnterpriseCheckoutUrl] = useState<string | null>(null);
  const [checkoutUrlCopied, setCheckoutUrlCopied] = useState(false);

  // Enterprise deal form state — kept separate from the simple 3-plan picker since
  // it needs a negotiated price + three independently-unlimited-able limits.
  const [entCurrency, setEntCurrency] = useState<'USD' | 'INR'>('USD');
  const [entPeriod, setEntPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [entPrice, setEntPrice] = useState('');
  const [entViews, setEntViews] = useState('');
  const [entViewsUnlimited, setEntViewsUnlimited] = useState(true);
  const [entSubmissions, setEntSubmissions] = useState('');
  const [entSubmissionsUnlimited, setEntSubmissionsUnlimited] = useState(true);
  const [entAiCredits, setEntAiCredits] = useState('');
  const [entAiCreditsUnlimited, setEntAiCreditsUnlimited] = useState(true);

  const { data, loading, error, refetch } = useQuery<AdminOrganizationByIdQueryData>(
    ADMIN_ORGANIZATION_BY_ID_QUERY,
    { variables: { id: orgId }, skip: !orgId }
  );

  // Assignable plans come from the live Chargebee catalog (active, non-enterprise),
  // with enterprise appended as the admin-assisted negotiated-deal flow. The org's
  // current plan is always included so its "(current)" indicator renders even while
  // the catalog query is loading or when the org sits on a hidden/archived plan.
  const { data: plansData } = useQuery<AdminPlansQueryData>(ADMIN_PLANS_QUERY);
  const assignablePlans = (plansData?.adminPlans ?? [])
    .filter(p => p.status === 'active' && p.id !== 'enterprise')
    .map(p => p.id);
  const currentPlanId = data?.adminOrganizationById?.subscription?.planId;
  const planOptions = Array.from(
    new Set([
      ...assignablePlans,
      ...(currentPlanId && currentPlanId !== 'enterprise' ? [currentPlanId] : []),
      'enterprise',
    ])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [changePlan, { loading: changingPlan }] = useMutation(ADMIN_ASSIGN_PLAN_MUTATION, {
    onCompleted: () => {
      toastSuccess('Plan assigned', 'Chargebee billing has been updated to the new plan.');
      setConfirmModal(null);
      setSelectedPlan(null);
      refetch();
    },
    onError: (e) => toastError('Failed to assign plan', e.message),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [setEnterprisePlan, { loading: settingEnterprise }] = useMutation(ADMIN_SET_ENTERPRISE_PLAN_MUTATION, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onCompleted: (data: any) => {
      const result = data?.adminSetEnterprisePlan;
      setConfirmModal(null);
      setSelectedPlan(null);
      if (result?.requiresPayment && result?.checkoutUrl) {
        toastSuccess('Enterprise deal created', 'The org is disabled until the customer completes payment.');
        setCheckoutUrlCopied(false);
        setEnterpriseCheckoutUrl(result.checkoutUrl);
      } else {
        toastSuccess('Enterprise plan set', 'The $0 deal is active immediately — no payment required.');
      }
      refetch();
    },
    onError: (e) => toastError('Failed to set enterprise plan', e.message),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resetUsage, { loading: resettingUsage }] = useMutation(ADMIN_RESET_USAGE_MUTATION, {
    onCompleted: () => {
      toastSuccess('Usage reset', 'Usage counters have been reset to zero.');
      setConfirmModal(null);
      setResetConfirmText('');
      refetch();
    },
    onError: (e) => toastError('Failed to reset usage', e.message),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cancelSub, { loading: cancelling }] = useMutation(ADMIN_CANCEL_SUBSCRIPTION_MUTATION, {
    onCompleted: () => {
      toastSuccess('Subscription cancelled', 'The subscription has been cancelled.');
      setConfirmModal(null);
      refetch();
    },
    onError: (e) => toastError('Failed to cancel', e.message),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reactivateSub, { loading: reactivating }] = useMutation(ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION, {
    onCompleted: () => {
      toastSuccess('Subscription reactivated', 'The subscription is now active again.');
      setConfirmModal(null);
      refetch();
    },
    onError: (e) => toastError('Failed to reactivate', e.message),
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return <div className="flex items-center justify-center min-h-64"><LoadingSpinner /></div>;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h3 className="text-sm font-semibold text-primary mb-1">Error loading organization</h3>
        <p className="text-xs text-muted-foreground mb-4">{error?.message || 'Organization not found'}</p>
        <Button onClick={() => navigate('/organizations')} variant="outline" size="sm">Back to Organizations</Button>
      </div>
    );
  }

  const org = data.adminOrganizationById;
  const sub: OrgSubscription | null = org.subscription;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Back */}
      <Button
        onClick={() => navigate('/organizations')}
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1.5 text-xs h-7 px-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Organizations
      </Button>

      {/* Header card */}
      <div className="rounded-xl bg-white p-6" style={CARD_STYLE}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
            {org.logo
              ? <img src={org.logo} alt={org.name} className="w-14 h-14 rounded-xl object-cover" />
              : <Building2 className="w-7 h-7 text-primary" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-primary truncate">{org.name}</h1>
            {org.slug && <p className="text-xs text-muted-foreground mt-0.5">@{org.slug}</p>}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created {formatDate(org.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Members',   value: org.members.length,       icon: Users,     iconBg: 'var(--tf-icon-lavender)', iconColor: 'var(--tf-icon-lavender-text)' },
          { label: 'Forms',     value: org.stats.totalForms,     icon: FileText,  iconBg: 'var(--tf-icon-salmon)',   iconColor: 'var(--tf-dark)' },
          { label: 'Responses', value: org.stats.totalResponses, icon: BarChart3, iconBg: 'var(--tf-icon-teal)',     iconColor: 'var(--tf-green)' },
        ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <div key={label} className="rounded-xl bg-white p-5 flex items-center gap-4" style={CARD_STYLE}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="text-2xl font-light text-primary">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid var(--tf-border-medium)' }}>
        <nav className="flex gap-6">
          {(['overview', 'subscription'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="pb-3 text-sm font-medium capitalize transition-colors"
              style={{
                borderBottom: activeTab === tab ? '2px solid var(--tf-dark)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--tf-dark)' : 'var(--tf-muted)',
              }}
            >
              {tab === 'subscription' && <CreditCard className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-5" style={CARD_STYLE}>
            <h2 className="text-sm font-semibold text-primary mb-3">Organization Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Organization ID</p>
                <p className="font-mono text-xs text-primary px-2.5 py-1.5 rounded-lg inline-block" style={{ backgroundColor: 'var(--tf-faint)' }}>
                  {org.id}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Created Date</p>
                <p className="text-sm text-primary">{formatDate(org.createdAt)}</p>
              </div>
              {org.slug && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Slug</p>
                  <p className="text-sm text-primary">{org.slug}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5" style={CARD_STYLE}>
            <h2 className="text-sm font-semibold text-primary mb-3">Members ({org.members.length})</h2>
            {org.members.length > 0 ? (
              <div className="space-y-2">
                {org.members.map(member => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between gap-3 rounded-lg p-3"
                    style={{ border: '1px solid var(--tf-border-medium)' }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {member.userImage
                        ? <img src={member.userImage} alt={member.userName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                        : <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                            style={{ backgroundColor: 'var(--tf-icon-salmon)', color: 'var(--tf-dark)' }}
                          >
                            {getInitials(member.userName)}
                          </div>
                      }
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-primary truncate">{member.userName}</h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{member.userEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={roleBadgeStyle(member.role)}>
                            {member.role}
                          </span>
                          <span className="text-[11px] text-muted-foreground">Joined {formatDate(member.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(`/users/${member.userId}`)}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 shrink-0 text-muted-foreground hover:text-primary"
                    >
                      View User →
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">No members in this organization</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscription tab */}
      {activeTab === 'subscription' && (
        <div className="space-y-4">
          {!sub ? (
            <div className="rounded-xl bg-white p-8 text-center" style={CARD_STYLE}>
              <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-primary">No subscription found</p>
              <p className="text-xs text-muted-foreground mt-1">This organization has no subscription record.</p>
            </div>
          ) : (
            <>
              {/* Card 1: Plan & Status */}
              <div className="rounded-xl bg-white p-5 space-y-4" style={CARD_STYLE}>
                <h2 className="text-sm font-semibold text-primary">Plan & Status</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold capitalize" style={planBadgeStyle(sub.planId)}>
                    {sub.planId}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium capitalize" style={statusBadgeStyle(sub.status)}>
                    {sub.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Chargebee Customer ID</p>
                  <p className="font-mono text-xs text-primary px-2 py-1 rounded-lg inline-block" style={{ backgroundColor: 'var(--tf-faint)' }}>
                    {sub.chargebeeCustomerId}
                  </p>
                </div>
                {CHARGEBEE_SITE && (
                  <a
                    href={`https://${CHARGEBEE_SITE}.chargebee.com/customers/${sub.chargebeeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: 'var(--tf-green)' }}
                  >
                    Open in Chargebee <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <div className="text-xs text-muted-foreground">
                  <span>Billing period: {formatDate(sub.currentPeriodStart)} → {formatDate(sub.currentPeriodEnd)}</span>
                  <span className="ml-2 font-medium text-primary">· {daysRemaining(sub.currentPeriodEnd)} days remaining</span>
                </div>
              </div>

              {/* Card 2: Usage */}
              <div className="rounded-xl bg-white p-5 space-y-4" style={CARD_STYLE}>
                <h2 className="text-sm font-semibold text-primary">Usage</h2>
                <div className="flex flex-col sm:flex-row gap-6">
                  <UsageBar label="Form Views" used={sub.viewsUsed} limit={sub.viewsLimit} />
                  <UsageBar label="Submissions" used={sub.submissionsUsed} limit={sub.submissionsLimit} />
                </div>
              </div>

              {/* Card 3: Change Plan */}
              <div className="rounded-xl bg-white p-5 space-y-4" style={CARD_STYLE}>
                <h2 className="text-sm font-semibold text-primary">Change Plan</h2>
                <p className="text-xs text-muted-foreground">
                  Assigning a plan updates the organization&apos;s real Chargebee subscription — invoicing
                  and renewals behave like a normal plan change. If the customer has no payment method on
                  file, auto-collection is turned off and invoices are generated for offline collection.
                  Enterprise uses a negotiated price override with per-org limits.
                </p>
                <div className="flex gap-3 flex-wrap">
                  {planOptions.map(plan => (
                    <button
                      key={plan}
                      onClick={() => {
                        setSelectedPlan(plan);
                        if (plan === 'enterprise') {
                          setEntViewsUnlimited(sub.viewsLimit == null);
                          setEntViews(sub.viewsLimit != null ? String(sub.viewsLimit) : '');
                          setEntSubmissionsUnlimited(sub.submissionsLimit == null);
                          setEntSubmissions(sub.submissionsLimit != null ? String(sub.submissionsLimit) : '');
                          setEntAiCreditsUnlimited(sub.aiCreditsLimit == null);
                          setEntAiCredits(sub.aiCreditsLimit != null ? String(sub.aiCreditsLimit) : '');
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all"
                      style={{
                        border: selectedPlan === plan
                          ? '2px solid var(--tf-dark)'
                          : sub.planId === plan
                            ? '2px solid var(--tf-green)'
                            : '2px solid var(--tf-border-medium)',
                        backgroundColor: selectedPlan === plan ? 'var(--tf-dark)' : sub.planId === plan ? 'var(--tf-green-bg)' : 'white',
                        color: selectedPlan === plan ? 'white' : sub.planId === plan ? 'var(--tf-green)' : 'var(--tf-text)',
                      }}
                    >
                      {plan}
                      {sub.planId === plan && <span className="ml-1 text-[11px]">(current)</span>}
                    </button>
                  ))}
                </div>

                {selectedPlan === 'enterprise' ? (
                  <div className="space-y-4 pt-2" style={{ borderTop: '1px solid var(--tf-border-medium)' }}>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Currency</label>
                        <select
                          className="w-full rounded-lg px-2 py-1.5 text-sm"
                          style={{ border: '1px solid var(--tf-border-strong)' }}
                          value={entCurrency}
                          onChange={e => setEntCurrency(e.target.value as 'USD' | 'INR')}
                        >
                          <option value="USD">USD</option>
                          <option value="INR">INR</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Billing period</label>
                        <select
                          className="w-full rounded-lg px-2 py-1.5 text-sm"
                          style={{ border: '1px solid var(--tf-border-strong)' }}
                          value={entPeriod}
                          onChange={e => setEntPeriod(e.target.value as 'monthly' | 'yearly')}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          Price ({entCurrency}, per period)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full rounded-lg px-2 py-1.5 text-sm"
                          style={{ border: '1px solid var(--tf-border-strong)' }}
                          placeholder="0.00"
                          value={entPrice}
                          onChange={e => setEntPrice(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <LimitField
                        label="Views limit"
                        value={entViews}
                        unlimited={entViewsUnlimited}
                        onValueChange={setEntViews}
                        onUnlimitedChange={setEntViewsUnlimited}
                      />
                      <LimitField
                        label="Submissions limit"
                        value={entSubmissions}
                        unlimited={entSubmissionsUnlimited}
                        onValueChange={setEntSubmissions}
                        onUnlimitedChange={setEntSubmissionsUnlimited}
                      />
                      <LimitField
                        label="AI credits limit"
                        value={entAiCredits}
                        unlimited={entAiCreditsUnlimited}
                        onValueChange={setEntAiCredits}
                        onUnlimitedChange={setEntAiCreditsUnlimited}
                      />
                    </div>
                    <Button
                      disabled={
                        entPrice === '' ||
                        Number.isNaN(Number(entPrice)) ||
                        Number(entPrice) < 0 ||
                        (!entViewsUnlimited && entViews === '') ||
                        (!entSubmissionsUnlimited && entSubmissions === '') ||
                        (!entAiCreditsUnlimited && entAiCredits === '') ||
                        settingEnterprise
                      }
                      onClick={() => setConfirmModal('setEnterprise')}
                      size="sm"
                    >
                      {settingEnterprise
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting...</>
                        : 'Set Enterprise Plan'
                      }
                    </Button>
                  </div>
                ) : (
                  <Button
                    disabled={!selectedPlan || selectedPlan === sub.planId || changingPlan}
                    onClick={() => setConfirmModal('changePlan')}
                    size="sm"
                  >
                    {changingPlan
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Changing...</>
                      : 'Change Plan'
                    }
                  </Button>
                )}
              </div>

              {/* Card 4: Danger Zone */}
              <div className="rounded-xl bg-white p-5 space-y-4" style={{ border: '1px solid var(--tf-error-bg-lg)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
                <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--tf-error)' }}>
                  <AlertTriangle className="h-4 w-4" />
                  Danger Zone
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-primary">Reset Usage Counters</p>
                      <p className="text-xs text-muted-foreground">Resets views, submissions, and AI token usage to zero immediately.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setConfirmModal('resetUsage')} disabled={resettingUsage} className="shrink-0">
                      {resettingUsage
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</>
                        : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Reset</>
                      }
                    </Button>
                  </div>

                  {sub.status === 'active' && sub.chargebeeSubscriptionId && (
                    <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: '1px solid var(--tf-error-bg-lg)' }}>
                      <div>
                        <p className="text-sm font-medium text-primary">Cancel Subscription</p>
                        <p className="text-xs text-muted-foreground">Cancels at end of billing period.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmModal('cancel')}
                        disabled={cancelling}
                        className="shrink-0"
                        style={{ borderColor: 'var(--tf-error-bg-lg)', color: 'var(--tf-error)' }}
                      >
                        {cancelling ? 'Cancelling...' : 'Cancel'}
                      </Button>
                    </div>
                  )}

                  {sub.status === 'cancelled' && sub.chargebeeSubscriptionId && (
                    <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: '1px solid var(--tf-error-bg-lg)' }}>
                      <div>
                        <p className="text-sm font-medium text-primary">Reactivate Subscription</p>
                        <p className="text-xs text-muted-foreground">Restores the subscription to active.</p>
                      </div>
                      <Button size="sm" onClick={() => setConfirmModal('reactivate')} disabled={reactivating} className="shrink-0">
                        {reactivating ? 'Reactivating...' : 'Reactivate'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Confirmation modals */}
      {confirmModal === 'changePlan' && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={MODAL_STYLE}>
            <h3 className="text-base font-semibold text-primary">Change Plan</h3>
            <p className="text-sm text-muted-foreground">
              Change <strong>{org.name}</strong> from <strong>{sub?.planId}</strong> to <strong>{selectedPlan}</strong>?
              This updates the organization&apos;s real Chargebee subscription — billing changes take effect
              immediately (prorated per your Chargebee site settings).
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Button>
              <Button size="sm" onClick={() => changePlan({ variables: { orgId, planId: selectedPlan } })}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'setEnterprise' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !settingEnterprise && setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={MODAL_STYLE}>
            <h3 className="text-base font-semibold text-primary">Set Enterprise Plan</h3>
            <p className="text-sm text-muted-foreground">
              This will update <strong>{org.name}</strong>&apos;s real Chargebee subscription to charge{' '}
              <strong>{entCurrency} {Number(entPrice || 0).toFixed(2)}</strong> per {entPeriod.replace('ly', '')}, with:
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>Views: {entViewsUnlimited ? 'Unlimited' : Number(entViews).toLocaleString()}</li>
              <li>Submissions: {entSubmissionsUnlimited ? 'Unlimited' : Number(entSubmissions).toLocaleString()}</li>
              <li>AI credits: {entAiCreditsUnlimited ? 'Unlimited' : Number(entAiCredits).toLocaleString()}</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              {Number(entPrice || 0) > 0
                ? 'Pay-to-activate: a Chargebee payment link is generated and emailed to the org owner. The organization is DISABLED until payment completes; the saved card is then auto-charged every renewal.'
                : 'A $0 deal activates immediately — no payment is required.'}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)} disabled={settingEnterprise}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={settingEnterprise}
                onClick={() => setEnterprisePlan({
                  variables: {
                    orgId,
                    currency: entCurrency,
                    period: entPeriod,
                    priceInSmallestUnit: Math.round(Number(entPrice || 0) * 100),
                    viewsLimit: entViewsUnlimited ? null : Number(entViews),
                    submissionsLimit: entSubmissionsUnlimited ? null : Number(entSubmissions),
                    aiCreditsLimit: entAiCreditsUnlimited ? null : Number(entAiCredits),
                  },
                })}
              >
                {settingEnterprise ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting...</> : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'resetUsage' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !resettingUsage && setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={MODAL_STYLE}>
            <h3 className="text-base font-semibold text-primary">Reset Usage Counters</h3>
            <p className="text-sm text-muted-foreground">
              Resets views, submissions, and AI token usage to zero. Type <strong>{org.name}</strong> to confirm.
            </p>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid var(--tf-border-strong)' }}
              aria-label={`Type ${org.name} to confirm`}
              placeholder={org.name}
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              disabled={resettingUsage}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setConfirmModal(null); setResetConfirmText(''); }} disabled={resettingUsage}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={resetConfirmText !== org.name || resettingUsage}
                onClick={() => resetUsage({ variables: { orgId } })}
                style={{ backgroundColor: 'var(--tf-error)', color: 'white' }}
              >
                {resettingUsage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</> : 'Reset'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'cancel' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={MODAL_STYLE}>
            <h3 className="text-base font-semibold text-primary">Cancel Subscription</h3>
            <p className="text-sm text-muted-foreground">
              This will cancel the Chargebee subscription at the end of the billing period.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Back</Button>
              <Button size="sm" onClick={() => cancelSub({ variables: { orgId } })} style={{ backgroundColor: 'var(--tf-error)', color: 'white' }}>
                Cancel Subscription
              </Button>
            </div>
          </div>
        </div>
      )}

      {enterpriseCheckoutUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEnterpriseCheckoutUrl(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4" style={MODAL_STYLE}>
            <h3 className="text-base font-semibold text-primary">Payment link created</h3>
            <p className="text-sm text-muted-foreground">
              The organization is <strong>disabled</strong> until this payment completes. The link has been
              emailed to the org owner — you can also copy and share it directly. Once paid, the account
              activates automatically and future renewals are charged to the saved card.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                className="flex-1 border rounded px-2 py-1.5 text-xs font-mono bg-gray-50"
                value={enterpriseCheckoutUrl}
                onFocus={e => e.target.select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(enterpriseCheckoutUrl);
                  setCheckoutUrlCopied(true);
                }}
              >
                {checkoutUrlCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" onClick={() => setEnterpriseCheckoutUrl(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'reactivate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={MODAL_STYLE}>
            <h3 className="text-base font-semibold text-primary">Reactivate Subscription</h3>
            <p className="text-sm text-muted-foreground">
              This will reactivate the Chargebee subscription immediately.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Button>
              <Button size="sm" onClick={() => reactivateSub({ variables: { orgId } })}>Reactivate</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
