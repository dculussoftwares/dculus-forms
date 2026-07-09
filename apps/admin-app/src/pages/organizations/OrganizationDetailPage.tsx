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
  ADMIN_CHANGE_PLAN_MUTATION,
  ADMIN_RESET_USAGE_MUTATION,
  ADMIN_CANCEL_SUBSCRIPTION_MUTATION,
  ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION,
  AdminOrganizationByIdQueryData,
  OrgSubscription,
} from '../../graphql/organizationDetail';

const CHARGEBEE_SITE = (import.meta as { env?: Record<string, string> }).env?.VITE_CHARGEBEE_SITE ?? '';
const PLANS = ['free', 'starter', 'advanced'] as const;

const CARD_STYLE: React.CSSProperties = { border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' };

const planBadgeStyle = (planId: string): React.CSSProperties => {
  switch (planId) {
    case 'starter':  return { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'advanced': return { backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
    default:         return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  switch (status) {
    case 'active':    return { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' };
    case 'past_due':  return { backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-lg)' };
    default:          return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

const roleBadgeStyle = (role: string): React.CSSProperties => {
  switch (role.toLowerCase()) {
    case 'owner': return { backgroundColor: 'var(--tf-icon-lavender)', color: '#5c2e6b' };
    case 'admin': return { backgroundColor: 'var(--tf-icon-salmon)', color: 'var(--tf-dark)' };
    default:      return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)' };
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
  const [confirmModal, setConfirmModal] = useState<null | 'changePlan' | 'resetUsage' | 'cancel' | 'reactivate'>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const { data, loading, error, refetch } = useQuery<AdminOrganizationByIdQueryData>(
    ADMIN_ORGANIZATION_BY_ID_QUERY,
    { variables: { id: orgId }, skip: !orgId }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [changePlan, { loading: changingPlan }] = useMutation(ADMIN_CHANGE_PLAN_MUTATION, {
    onCompleted: () => {
      toastSuccess('Plan updated', 'The plan has been changed successfully.');
      setConfirmModal(null);
      setSelectedPlan(null);
      refetch();
    },
    onError: (e) => toastError('Failed to change plan', e.message),
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
          { label: 'Members',   value: org.members.length,       icon: Users,     iconBg: 'var(--tf-icon-lavender)', iconColor: '#5c2e6b' },
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
                  This updates the local subscription record immediately. Use the Chargebee portal link above to adjust billing.
                </p>
                <div className="flex gap-3">
                  {PLANS.map(plan => (
                    <button
                      key={plan}
                      onClick={() => setSelectedPlan(plan)}
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
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: 'var(--shadow-xl)' }}>
            <h3 className="text-base font-semibold text-primary">Change Plan</h3>
            <p className="text-sm text-muted-foreground">
              Change <strong>{org.name}</strong> from <strong>{sub?.planId}</strong> to <strong>{selectedPlan}</strong>?
              This updates the local subscription record immediately.
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

      {confirmModal === 'resetUsage' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !resettingUsage && setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: 'var(--shadow-xl)' }}>
            <h3 className="text-base font-semibold text-primary">Reset Usage Counters</h3>
            <p className="text-sm text-muted-foreground">
              Resets views, submissions, and AI token usage to zero. Type <strong>{org.name}</strong> to confirm.
            </p>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: '1px solid var(--tf-border-strong)' }}
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
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: 'var(--shadow-xl)' }}>
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

      {confirmModal === 'reactivate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: 'var(--shadow-xl)' }}>
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
