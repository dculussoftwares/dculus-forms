import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, LoadingSpinner, toastSuccess, toastError } from '@dculus/ui';
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

const planBadgeStyle = (planId: string): React.CSSProperties => {
  switch (planId) {
    case 'starter':  return { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'advanced': return { backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
    default:         return { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' };
  }
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  switch (status) {
    case 'active':    return { backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' };
    case 'past_due':  return { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' };
    case 'cancelled': return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
    default:          return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
  }
};

const UsageBar: React.FC<{ label: string; used: number; limit: number | null }> = ({ label, used, limit }) => {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a';
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
          <div className="h-2 rounded-full w-full" style={{ backgroundColor: 'var(--tf-faint)' }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
          <p className="text-[10px] mt-0.5 text-muted-foreground">{pct}% used</p>
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

  const [changePlan, { loading: changingPlan }] = useMutation<any, any>(ADMIN_CHANGE_PLAN_MUTATION, {
    onCompleted: () => {
      toastSuccess('Plan updated', 'The plan has been changed successfully.');
      setConfirmModal(null);
      setSelectedPlan(null);
      refetch();
    },
    onError: (e) => toastError('Failed to change plan', e.message),
  });

  const [resetUsage, { loading: resettingUsage }] = useMutation<any, any>(ADMIN_RESET_USAGE_MUTATION, {
    onCompleted: () => {
      toastSuccess('Usage reset', 'Usage counters have been reset to zero.');
      setConfirmModal(null);
      setResetConfirmText('');
      refetch();
    },
    onError: (e) => toastError('Failed to reset usage', e.message),
  });

  const [cancelSub, { loading: cancelling }] = useMutation<any, any>(ADMIN_CANCEL_SUBSCRIPTION_MUTATION, {
    onCompleted: () => {
      toastSuccess('Subscription cancelled', 'The subscription has been cancelled.');
      setConfirmModal(null);
      refetch();
    },
    onError: (e) => toastError('Failed to cancel', e.message),
  });

  const [reactivateSub, { loading: reactivating }] = useMutation<any, any>(ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION, {
    onCompleted: () => {
      toastSuccess('Subscription reactivated', 'The subscription is now active again.');
      setConfirmModal(null);
      refetch();
    },
    onError: (e) => toastError('Failed to reactivate', e.message),
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getRoleBadgeColor = (role: string) => {
    if (role.toLowerCase() === 'owner') return 'bg-purple-100 text-purple-700';
    if (role.toLowerCase() === 'admin') return 'bg-blue-100 text-blue-700';
    return 'bg-muted text-foreground';
  };

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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Button onClick={() => navigate('/organizations')} variant="outline" className="flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Organizations
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="p-8">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {org.logo
                ? <img src={org.logo} alt={org.name} className="w-20 h-20 rounded-lg object-cover" />
                : <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-white" />
                  </div>
              }
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-primary mb-2">{org.name}</h1>
              {org.slug && <p className="text-muted-foreground mb-4">@{org.slug}</p>}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Created {formatDate(org.createdAt)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Members',   value: org.members.length,       icon: Users,     bg: 'bg-blue-100',    iconClass: 'text-blue-600' },
          { label: 'Forms',     value: org.stats.totalForms,     icon: FileText,  bg: 'bg-purple-100',  iconClass: 'text-purple-600' },
          { label: 'Responses', value: org.stats.totalResponses, icon: BarChart3, bg: 'bg-primary/10',  iconClass: 'text-primary' },
        ].map(({ label, value, icon: Icon, bg, iconClass }) => (
          <Card key={label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${bg}`}><Icon className={`w-6 h-6 ${iconClass}`} /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold text-primary">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
              {tab === 'subscription' && <CreditCard className="inline h-4 w-4 mr-1" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-primary mb-4">Organization Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Organization ID</p>
                  <p className="font-mono text-sm text-primary bg-muted p-2 rounded">{org.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Created Date</p>
                  <p className="text-sm text-primary">{formatDate(org.createdAt)}</p>
                </div>
                {org.slug && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Slug</p>
                    <p className="text-sm text-primary">{org.slug}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-primary mb-4">Members ({org.members.length})</h2>
              {org.members.length > 0 ? (
                <div className="space-y-3">
                  {org.members.map(member => (
                    <Card key={member.userId} className="border border-[var(--tf-border-medium)]">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {member.userImage
                              ? <img src={member.userImage} alt={member.userName} className="w-12 h-12 rounded-full object-cover" />
                              : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                  {getInitials(member.userName)}
                                </div>
                            }
                            <div className="flex-1">
                              <h3 className="font-semibold text-primary">{member.userName}</h3>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="w-3 h-3" /><span>{member.userEmail}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                                  {member.role}
                                </span>
                                <span className="text-xs text-muted-foreground">Joined {formatDate(member.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <Button onClick={() => navigate(`/users/${member.userId}`)} variant="outline" size="sm">
                            View User →
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No members in this organization</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subscription tab */}
      {activeTab === 'subscription' && (
        <div className="space-y-4">
          {!sub ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-primary">No subscription found</p>
                <p className="text-xs text-muted-foreground mt-1">This organization has no subscription record.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Card 1: Plan & Status */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-base font-semibold text-primary">Plan & Status</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-sm font-semibold capitalize" style={planBadgeStyle(sub.planId)}>
                      {sub.planId}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm font-medium capitalize" style={statusBadgeStyle(sub.status)}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Chargebee Customer ID</p>
                    <p className="font-mono text-xs text-primary bg-muted px-2 py-1 rounded inline-block">
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
                </CardContent>
              </Card>

              {/* Card 2: Usage */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-base font-semibold text-primary">Usage</h2>
                  <div className="flex gap-8">
                    <UsageBar label="Form Views" used={sub.viewsUsed} limit={sub.viewsLimit} />
                    <UsageBar label="Submissions" used={sub.submissionsUsed} limit={sub.submissionsLimit} />
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Change Plan */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-base font-semibold text-primary">Change Plan</h2>
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
                        {sub.planId === plan && <span className="ml-1 text-[10px]">(current)</span>}
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
                </CardContent>
              </Card>

              {/* Card 4: Danger Zone */}
              <Card style={{ border: '1px solid #fecaca' }}>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-1" style={{ color: '#dc2626' }}>
                    <AlertTriangle className="h-4 w-4" />
                    Danger Zone
                  </h2>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-primary">Reset Usage Counters</p>
                        <p className="text-xs text-muted-foreground">Resets views, submissions, and AI token usage to zero immediately.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setConfirmModal('resetUsage')} disabled={resettingUsage}>
                        {resettingUsage
                          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting...</>
                          : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Reset</>
                        }
                      </Button>
                    </div>

                    {sub.status === 'active' && sub.chargebeeSubscriptionId && (
                      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #fecaca' }}>
                        <div>
                          <p className="text-sm font-medium text-primary">Cancel Subscription</p>
                          <p className="text-xs text-muted-foreground">Cancels at end of billing period.</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmModal('cancel')}
                          disabled={cancelling}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          {cancelling ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      </div>
                    )}

                    {sub.status === 'cancelled' && sub.chargebeeSubscriptionId && (
                      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #fecaca' }}>
                        <div>
                          <p className="text-sm font-medium text-primary">Reactivate Subscription</p>
                          <p className="text-xs text-muted-foreground">Restores the subscription to active.</p>
                        </div>
                        <Button size="sm" onClick={() => setConfirmModal('reactivate')} disabled={reactivating}>
                          {reactivating ? 'Reactivating...' : 'Reactivate'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Confirmation modals */}
      {confirmModal === 'changePlan' && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
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
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">Reset Usage Counters</h3>
            <p className="text-sm text-muted-foreground">
              Resets views, submissions, and AI token usage to zero. Type <strong>{org.name}</strong> to confirm.
            </p>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
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
                className="bg-red-600 hover:bg-red-700 text-white"
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
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">Cancel Subscription</h3>
            <p className="text-sm text-muted-foreground">
              This will cancel the Chargebee subscription at the end of the billing period.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Back</Button>
              <Button size="sm" onClick={() => cancelSub({ variables: { orgId } })} className="bg-red-600 hover:bg-red-700 text-white">
                Cancel Subscription
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'reactivate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
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
