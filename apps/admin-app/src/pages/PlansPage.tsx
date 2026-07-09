import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Button, LoadingSpinner, toastSuccess, toastError } from '@dculus/ui';
import { CreditCard, Plus, Loader2, Eye, EyeOff } from 'lucide-react';
import {
  ADMIN_PLANS_QUERY,
  ADMIN_CREATE_PLAN_MUTATION,
  ADMIN_UPDATE_PLAN_MUTATION,
  ADMIN_ARCHIVE_PLAN_MUTATION,
  ADMIN_UNARCHIVE_PLAN_MUTATION,
  AdminPlan,
  AdminPlansQueryData,
} from '../graphql/plans';
import { useTranslation } from '../hooks/useTranslation';

const PLAN_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,48}$/;

// All currency×period combinations a plan can offer. Amounts are entered in
// major units and converted to the smallest unit (×100) on submit.
const PRICE_COMBOS = [
  { currency: 'USD', period: 'monthly' },
  { currency: 'USD', period: 'yearly' },
  { currency: 'INR', period: 'monthly' },
  { currency: 'INR', period: 'yearly' },
] as const;

type PriceComboKey = `${string}-${string}`;
const comboKey = (currency: string, period: string): PriceComboKey => `${currency}-${period}`;

const statusBadgeStyle = (status: string): React.CSSProperties =>
  status === 'active'
    ? { backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }
    : { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };

const formatAmount = (currency: string, priceInSmallestUnit: number) =>
  `${currency === 'INR' ? '₹' : '$'}${(priceInSmallestUnit / 100).toLocaleString()}`;

// A limit input paired with an "Unlimited" toggle — null means unlimited,
// matching the Subscription schema convention (same widget as the enterprise
// form on OrganizationDetailPage).
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

interface PlanFormState {
  id: string;
  name: string;
  description: string;
  visibleOnPricingPage: boolean;
  // keyed by `${currency}-${period}`; enabled combos carry their amount in major units
  prices: Record<PriceComboKey, { enabled: boolean; amount: string; existing: boolean }>;
  views: string;
  viewsUnlimited: boolean;
  submissions: string;
  submissionsUnlimited: boolean;
  aiCredits: string;
  aiCreditsUnlimited: boolean;
}

const emptyFormState = (): PlanFormState => ({
  id: '',
  name: '',
  description: '',
  visibleOnPricingPage: false,
  prices: Object.fromEntries(
    PRICE_COMBOS.map(c => [comboKey(c.currency, c.period), { enabled: false, amount: '', existing: false }])
  ) as PlanFormState['prices'],
  views: '',
  viewsUnlimited: true,
  submissions: '',
  submissionsUnlimited: true,
  aiCredits: '',
  aiCreditsUnlimited: true,
});

const formStateFromPlan = (plan: AdminPlan): PlanFormState => {
  const prices = emptyFormState().prices;
  for (const price of plan.prices) {
    if (price.status !== 'active') continue;
    const key = comboKey(price.currency, price.period);
    if (key in prices) {
      prices[key] = { enabled: true, amount: String(price.priceInSmallestUnit / 100), existing: true };
    }
  }
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description ?? '',
    visibleOnPricingPage: plan.visibleOnPricingPage,
    prices,
    views: plan.limits.views != null ? String(plan.limits.views) : '',
    viewsUnlimited: plan.limits.views == null,
    submissions: plan.limits.submissions != null ? String(plan.limits.submissions) : '',
    submissionsUnlimited: plan.limits.submissions == null,
    aiCredits: plan.limits.aiCredits != null ? String(plan.limits.aiCredits) : '',
    aiCreditsUnlimited: plan.limits.aiCredits == null,
  };
};

export default function PlansPage() {
  const { t } = useTranslation('plans');
  const [formMode, setFormMode] = useState<null | 'create' | 'edit'>(null);
  const [form, setForm] = useState<PlanFormState>(emptyFormState());
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | { type: 'archive' | 'restore'; plan: AdminPlan }>(null);

  const { data, loading, error, refetch } = useQuery<AdminPlansQueryData>(ADMIN_PLANS_QUERY);
  const plans = data?.adminPlans ?? [];

  const [createPlan, { loading: creating }] = useMutation(ADMIN_CREATE_PLAN_MUTATION, {
    onCompleted: () => {
      toastSuccess(t('toasts.created'), t('toasts.createdDetail'));
      setFormMode(null);
      refetch();
    },
    onError: e => toastError(t('toasts.createFailed'), e.message),
  });

  const [updatePlan, { loading: updating }] = useMutation(ADMIN_UPDATE_PLAN_MUTATION, {
    onCompleted: () => {
      toastSuccess(t('toasts.updated'), t('toasts.updatedDetail'));
      setFormMode(null);
      setEditingPlan(null);
      refetch();
    },
    onError: e => toastError(t('toasts.updateFailed'), e.message),
  });

  const [toggleVisibility, { loading: togglingVisibility }] = useMutation(ADMIN_UPDATE_PLAN_MUTATION, {
    onError: e => toastError(t('toasts.updateFailed'), e.message),
  });

  const [archivePlan, { loading: archiving }] = useMutation(ADMIN_ARCHIVE_PLAN_MUTATION, {
    onCompleted: () => {
      toastSuccess(t('toasts.archived'), t('toasts.archivedDetail'));
      setConfirmAction(null);
      refetch();
    },
    onError: e => toastError(t('toasts.archiveFailed'), e.message),
  });

  const [unarchivePlan, { loading: restoring }] = useMutation(ADMIN_UNARCHIVE_PLAN_MUTATION, {
    onCompleted: () => {
      toastSuccess(t('toasts.restored'), t('toasts.restoredDetail'));
      setConfirmAction(null);
      refetch();
    },
    onError: e => toastError(t('toasts.restoreFailed'), e.message),
  });

  const openCreate = () => {
    setForm(emptyFormState());
    setEditingPlan(null);
    setFormMode('create');
  };

  const openEdit = (plan: AdminPlan) => {
    setForm(formStateFromPlan(plan));
    setEditingPlan(plan);
    setFormMode('edit');
  };

  const handleVisibilityToggle = async (plan: AdminPlan) => {
    const next = !plan.visibleOnPricingPage;
    try {
      const result = await toggleVisibility({ variables: { input: { id: plan.id, visibleOnPricingPage: next } } });
      if (result?.data) {
        toastSuccess(next ? t('toasts.visibilityOn') : t('toasts.visibilityOff'), plan.name);
        refetch();
      }
    } catch {
      // Failure toast is handled by the mutation's onError.
    }
  };

  const enabledPrices = PRICE_COMBOS.filter(c => form.prices[comboKey(c.currency, c.period)].enabled);

  const formValid =
    (formMode === 'edit' || PLAN_ID_REGEX.test(form.id)) &&
    form.name.trim() !== '' &&
    enabledPrices.length > 0 &&
    enabledPrices.every(c => {
      const amount = form.prices[comboKey(c.currency, c.period)].amount;
      return amount !== '' && !Number.isNaN(Number(amount)) && Number(amount) >= 0;
    }) &&
    (form.viewsUnlimited || form.views !== '') &&
    (form.submissionsUnlimited || form.submissions !== '') &&
    (form.aiCreditsUnlimited || form.aiCredits !== '');

  const submitForm = () => {
    const prices = enabledPrices.map(c => ({
      currency: c.currency,
      period: c.period,
      priceInSmallestUnit: Math.round(Number(form.prices[comboKey(c.currency, c.period)].amount) * 100),
    }));
    const limits = {
      views: form.viewsUnlimited ? null : Number(form.views),
      submissions: form.submissionsUnlimited ? null : Number(form.submissions),
      aiCredits: form.aiCreditsUnlimited ? null : Number(form.aiCredits),
    };
    if (formMode === 'create') {
      createPlan({
        variables: {
          input: {
            id: form.id,
            name: form.name.trim(),
            description: form.description.trim() || null,
            prices,
            limits,
            visibleOnPricingPage: form.visibleOnPricingPage,
          },
        },
      });
    } else {
      updatePlan({
        variables: {
          input: {
            id: form.id,
            name: form.name.trim(),
            description: form.description.trim() || null,
            prices,
            limits,
            visibleOnPricingPage: form.visibleOnPricingPage,
          },
        },
      });
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h2 className="text-sm font-semibold mb-1 text-primary">{t('error.unableToLoad')}</h2>
        <p className="text-xs mb-3 text-muted-foreground">{error.message || t('error.checkConnection')}</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>{t('error.tryAgain')}</Button>
      </div>
    );
  }

  const saving = creating || updating;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-primary">{t('title')}</h1>
          <p className="text-xs mt-0.5 text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t('createPlan')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <div
          className="rounded-xl bg-white overflow-hidden"
          style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
        >
          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--tf-faint)' }}>
                <CreditCard className="h-6 w-6 text-[var(--tf-icon-gray)]" />
              </div>
              <p className="text-sm font-medium text-primary">{t('empty.title')}</p>
              <p className="text-xs mt-0.5 text-muted-foreground">{t('empty.subtitle')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--tf-border-light)' }}>
                    {[t('table.plan'), t('table.status'), t('table.visibility'), t('table.prices'), t('table.limits'), t('table.subscribers'), t('table.actions')].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tf-muted)', backgroundColor: 'var(--tf-faint)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {plans.map((plan, i) => {
                    const isEnterprise = plan.id === 'enterprise';
                    const activePrices = plan.prices.filter(p => p.status === 'active');
                    return (
                      <tr
                        key={plan.id}
                        className="hover:bg-[var(--tf-tab-bg-faint)] transition-colors"
                        style={{ borderTop: i > 0 ? '1px solid rgba(81,76,84,0.07)' : undefined }}
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-primary">{plan.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{plan.id}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={statusBadgeStyle(plan.status)}>
                            {t(`status.${plan.status}`)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {isEnterprise ? (
                            <span className="text-xs text-muted-foreground" title={t('visibility.enterpriseAlwaysHidden')}>
                              <EyeOff className="h-3.5 w-3.5 inline mr-1" />
                              {t('visibility.hidden')}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleVisibilityToggle(plan)}
                              disabled={togglingVisibility || plan.status === 'archived'}
                              className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-50"
                              style={{ color: plan.visibleOnPricingPage ? 'var(--tf-green)' : 'var(--tf-muted)' }}
                            >
                              {plan.visibleOnPricingPage
                                ? <><Eye className="h-3.5 w-3.5" />{t('visibility.visible')}</>
                                : <><EyeOff className="h-3.5 w-3.5" />{t('visibility.hidden')}</>
                              }
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-foreground">
                          {activePrices.length === 0
                            ? <span className="text-muted-foreground">—</span>
                            : activePrices.map(p => (
                                <div key={p.id}>
                                  {formatAmount(p.currency, p.priceInSmallestUnit)}/{p.period === 'yearly' ? 'yr' : 'mo'} {p.currency}
                                </div>
                              ))
                          }
                        </td>
                        <td className="px-5 py-3.5 text-xs text-foreground">
                          <div>{t('limits.views')}: {plan.limits.views == null ? t('limits.unlimited') : plan.limits.views.toLocaleString()}</div>
                          <div>{t('limits.submissions')}: {plan.limits.submissions == null ? t('limits.unlimited') : plan.limits.submissions.toLocaleString()}</div>
                          <div>{t('limits.aiCredits')}: {plan.limits.aiCredits == null ? t('limits.unlimited') : plan.limits.aiCredits.toLocaleString()}</div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-foreground">{plan.subscriberCount}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-1">
                            {!isEnterprise && (
                              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => openEdit(plan)}>
                                {t('actions.edit')}
                              </Button>
                            )}
                            {!isEnterprise && plan.id !== 'free' && plan.status === 'active' && (
                              <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-red-600" onClick={() => setConfirmAction({ type: 'archive', plan })}>
                                {t('actions.archive')}
                              </Button>
                            )}
                            {plan.status === 'archived' && (
                              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setConfirmAction({ type: 'restore', plan })}>
                                {t('actions.restore')}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {formMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !saving && setFormMode(null)} />
          <div
            className="relative bg-white rounded-xl p-6 max-w-lg w-full mx-4 space-y-4 max-h-[85vh] overflow-y-auto"
            style={{ border: '1px solid var(--tf-border-medium)' }}
          >
            <h3 className="text-base font-semibold text-primary">
              {formMode === 'create' ? t('form.createTitle') : t('form.editTitle')}
            </h3>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('form.id')}</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm font-mono disabled:opacity-60 disabled:bg-gray-50"
                  placeholder="pro"
                  value={form.id}
                  disabled={formMode === 'edit'}
                  onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase() }))}
                />
                <p className="text-[10px] mt-0.5 text-muted-foreground">{t('form.idHint')}</p>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('form.name')}</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Pro Plan"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{t('form.description')}</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={form.visibleOnPricingPage}
                  onChange={e => setForm(f => ({ ...f, visibleOnPricingPage: e.target.checked }))}
                />
                {t('form.visibleOnPricingPage')}
              </label>
              <p className="text-[10px] mt-0.5 text-muted-foreground">{t('form.visibleHint')}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t('form.prices')}</p>
              <p className="text-[10px] text-muted-foreground mb-2">{t('form.pricesHint')}</p>
              <div className="space-y-2">
                {PRICE_COMBOS.map(combo => {
                  const key = comboKey(combo.currency, combo.period);
                  const price = form.prices[key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm w-36 shrink-0">
                        <input
                          type="checkbox"
                          checked={price.enabled}
                          disabled={price.existing}
                          title={price.existing ? t('form.priceLocked') : undefined}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              prices: { ...f.prices, [key]: { ...f.prices[key], enabled: e.target.checked } },
                            }))
                          }
                        />
                        {combo.currency} / {combo.period}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="flex-1 border rounded px-2 py-1.5 text-sm disabled:opacity-50"
                        placeholder="0.00"
                        value={price.amount}
                        disabled={!price.enabled}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            prices: { ...f.prices, [key]: { ...f.prices[key], amount: e.target.value } },
                          }))
                        }
                      />
                      {price.existing && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('form.priceLocked')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('form.limitsTitle')}</p>
              <div className="flex flex-wrap gap-3">
                <LimitField
                  label={t('limits.views')}
                  value={form.views}
                  unlimited={form.viewsUnlimited}
                  onValueChange={v => setForm(f => ({ ...f, views: v }))}
                  onUnlimitedChange={v => setForm(f => ({ ...f, viewsUnlimited: v }))}
                />
                <LimitField
                  label={t('limits.submissions')}
                  value={form.submissions}
                  unlimited={form.submissionsUnlimited}
                  onValueChange={v => setForm(f => ({ ...f, submissions: v }))}
                  onUnlimitedChange={v => setForm(f => ({ ...f, submissionsUnlimited: v }))}
                />
                <LimitField
                  label={t('limits.aiCredits')}
                  value={form.aiCredits}
                  unlimited={form.aiCreditsUnlimited}
                  onValueChange={v => setForm(f => ({ ...f, aiCredits: v }))}
                  onUnlimitedChange={v => setForm(f => ({ ...f, aiCreditsUnlimited: v }))}
                />
              </div>
              {formMode === 'edit' && editingPlan && editingPlan.subscriberCount > 0 && (
                <p className="text-[11px] mt-2 px-2 py-1.5 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                  {t('form.backfillWarning', { values: { count: editingPlan.subscriberCount } })}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setFormMode(null)} disabled={saving}>
                {t('form.cancel')}
              </Button>
              <Button size="sm" disabled={!formValid || saving} onClick={submitForm}>
                {saving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{formMode === 'create' ? t('form.creating') : t('form.saving')}</>
                  : formMode === 'create' ? t('form.create') : t('form.save')
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Archive / Restore confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">
              {confirmAction.type === 'archive' ? t('confirm.archiveTitle') : t('confirm.restoreTitle')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(confirmAction.type === 'archive' ? 'confirm.archiveBody' : 'confirm.restoreBody', {
                values: { name: confirmAction.plan.name },
              })}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>{t('confirm.cancel')}</Button>
              <Button
                size="sm"
                disabled={archiving || restoring}
                className={confirmAction.type === 'archive' ? 'bg-red-600 hover:bg-red-700 text-white' : undefined}
                onClick={() =>
                  confirmAction.type === 'archive'
                    ? archivePlan({ variables: { planId: confirmAction.plan.id } })
                    : unarchivePlan({ variables: { planId: confirmAction.plan.id } })
                }
              >
                {(archiving || restoring)
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : t('confirm.confirm')
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
