import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Button, LoadingSpinner, toastSuccess, toastError } from '@dculus/ui';
import { Plus, Loader2, Puzzle } from 'lucide-react';
import {
  ADMIN_ADDONS_QUERY,
  ADMIN_CREATE_ADDON_MUTATION,
  ADMIN_UPDATE_ADDON_MUTATION,
  ADMIN_ARCHIVE_ADDON_MUTATION,
  ADMIN_UNARCHIVE_ADDON_MUTATION,
  type AdminAddon,
  type AdminAddonsQueryData,
} from '../../graphql/addons';
import { useTranslation } from '../../hooks/useTranslation';

const ADDON_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,48}$/;

const PRICE_COMBOS = [
  { currency: 'USD', period: 'monthly' },
  { currency: 'USD', period: 'yearly' },
  { currency: 'INR', period: 'monthly' },
  { currency: 'INR', period: 'yearly' },
] as const;
const comboKey = (currency: string, period: string) => `${currency}-${period}`;

const METERS = ['views', 'submissions', 'emails', 'aiCredits'] as const;
type Meter = (typeof METERS)[number];

const formatAmount = (currency: string, priceInSmallestUnit: number) =>
  `${currency === 'INR' ? '₹' : '$'}${(priceInSmallestUnit / 100).toLocaleString()}`;

const statusBadgeStyle = (status: string): React.CSSProperties =>
  status === 'active'
    ? { backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }
    : { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };

interface AddonFormState {
  id: string;
  name: string;
  description: string;
  prices: Record<string, { enabled: boolean; amount: string; existing: boolean }>;
  // per-unit grant per meter; `none` = this add-on doesn't touch the meter
  grants: Record<Meter, { none: boolean; value: string }>;
}

const emptyForm = (): AddonFormState => ({
  id: '',
  name: '',
  description: '',
  prices: Object.fromEntries(
    PRICE_COMBOS.map((c) => [comboKey(c.currency, c.period), { enabled: false, amount: '', existing: false }])
  ),
  grants: Object.fromEntries(METERS.map((m) => [m, { none: true, value: '' }])) as AddonFormState['grants'],
});

const formFromAddon = (addon: AdminAddon): AddonFormState => {
  const form = emptyForm();
  form.id = addon.id;
  form.name = addon.name;
  form.description = addon.description ?? '';
  for (const price of addon.prices) {
    if (price.status !== 'active') continue;
    const key = comboKey(price.currency, price.period);
    if (key in form.prices) {
      form.prices[key] = { enabled: true, amount: String(price.priceInSmallestUnit / 100), existing: true };
    }
  }
  for (const meter of METERS) {
    const grant = addon.grants[meter];
    form.grants[meter] = { none: grant == null, value: grant != null ? String(grant) : '' };
  }
  return form;
};

export function AddonsSection() {
  const { t } = useTranslation('plans');
  const [mode, setMode] = useState<null | 'create' | 'edit'>(null);
  const [form, setForm] = useState<AddonFormState>(emptyForm());
  const [confirm, setConfirm] = useState<null | { type: 'archive' | 'restore'; addon: AdminAddon }>(null);

  const { data, loading, error, refetch } = useQuery<AdminAddonsQueryData>(ADMIN_ADDONS_QUERY);
  const addons = data?.adminAddons ?? [];

  const done = (title: string, detail: string) => {
    toastSuccess(title, detail);
    setMode(null);
    setConfirm(null);
    refetch();
  };
  const [createAddon, { loading: creating }] = useMutation(ADMIN_CREATE_ADDON_MUTATION, {
    onCompleted: () => done(t('addons.toasts.created'), t('addons.toasts.createdDetail')),
    onError: (e) => toastError(t('addons.toasts.createFailed'), e.message),
  });
  const [updateAddon, { loading: updating }] = useMutation(ADMIN_UPDATE_ADDON_MUTATION, {
    onCompleted: () => done(t('addons.toasts.updated'), t('addons.toasts.updatedDetail')),
    onError: (e) => toastError(t('addons.toasts.updateFailed'), e.message),
  });
  const [archiveAddon, { loading: archiving }] = useMutation(ADMIN_ARCHIVE_ADDON_MUTATION, {
    onCompleted: () => done(t('addons.toasts.archived'), t('addons.toasts.archivedDetail')),
    onError: (e) => toastError(t('addons.toasts.archiveFailed'), e.message),
  });
  const [unarchiveAddon, { loading: restoring }] = useMutation(ADMIN_UNARCHIVE_ADDON_MUTATION, {
    onCompleted: () => done(t('addons.toasts.restored'), t('addons.toasts.restoredDetail')),
    onError: (e) => toastError(t('addons.toasts.restoreFailed'), e.message),
  });

  const enabledPrices = PRICE_COMBOS.filter((c) => form.prices[comboKey(c.currency, c.period)].enabled);
  const grantedMeters = METERS.filter((m) => !form.grants[m].none);
  const formValid =
    (mode === 'edit' || ADDON_ID_REGEX.test(form.id)) &&
    form.name.trim() !== '' &&
    enabledPrices.length > 0 &&
    enabledPrices.every((c) => {
      const amount = form.prices[comboKey(c.currency, c.period)].amount;
      return amount !== '' && Number(amount) >= 0;
    }) &&
    grantedMeters.length > 0 &&
    grantedMeters.every((m) => form.grants[m].value !== '' && Number(form.grants[m].value) > 0);

  const submit = () => {
    const prices = enabledPrices.map((c) => ({
      currency: c.currency,
      period: c.period,
      priceInSmallestUnit: Math.round(Number(form.prices[comboKey(c.currency, c.period)].amount) * 100),
    }));
    const grants = Object.fromEntries(
      METERS.map((m) => [m, form.grants[m].none ? null : Number(form.grants[m].value)])
    );
    const input = {
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      prices,
      grants,
    };
    if (mode === 'create') createAddon({ variables: { input } });
    else updateAddon({ variables: { input } });
  };

  const saving = creating || updating;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">{t('addons.title')}</h2>
          <p className="text-xs mt-0.5 text-muted-foreground">{t('addons.subtitle')}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(emptyForm());
            setMode('create');
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t('addons.create')}
        </Button>
      </div>

      {error ? (
        <p className="text-xs text-muted-foreground">
          {t('addons.error')}{' '}
          <button className="underline" onClick={() => refetch()}>{t('error.tryAgain')}</button>
        </p>
      ) : loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div
          className="rounded-xl bg-white overflow-hidden"
          style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
        >
          {addons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Puzzle className="h-6 w-6 mb-2 text-[var(--tf-icon-gray)]" />
              <p className="text-sm font-medium text-primary">{t('addons.empty')}</p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--tf-border-light)' }}>
                  {[t('addons.table.addon'), t('table.status'), t('addons.table.grants'), t('table.prices'), t('table.actions')].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tf-muted)', backgroundColor: 'var(--tf-faint)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {addons.map((addon, i) => (
                  <tr key={addon.id} style={{ borderTop: i > 0 ? '1px solid rgba(81,76,84,0.07)' : undefined }}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-primary">{addon.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{addon.id}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={statusBadgeStyle(addon.status)}>
                        {t(`status.${addon.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-foreground">
                      {METERS.filter((m) => addon.grants[m] != null).map((m) => (
                        <div key={m}>+{(addon.grants[m] as number).toLocaleString()} {t(`limits.${m}`)}</div>
                      ))}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-foreground">
                      {addon.prices.filter((p) => p.status === 'active').map((p) => (
                        <div key={p.id}>
                          {formatAmount(p.currency, p.priceInSmallestUnit)}/{p.period === 'yearly' ? 'yr' : 'mo'} {p.currency}
                        </div>
                      ))}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => { setForm(formFromAddon(addon)); setMode('edit'); }}>
                          {t('actions.edit')}
                        </Button>
                        {addon.status === 'active' ? (
                          <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-red-600" onClick={() => setConfirm({ type: 'archive', addon })}>
                            {t('actions.archive')}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setConfirm({ type: 'restore', addon })}>
                            {t('actions.restore')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !saving && setMode(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-lg w-full mx-4 space-y-4 max-h-[85vh] overflow-y-auto" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">
              {mode === 'create' ? t('addons.form.createTitle') : t('addons.form.editTitle')}
            </h3>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('addons.form.id')}</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm font-mono disabled:opacity-60 disabled:bg-gray-50"
                  placeholder="extra-submissions"
                  value={form.id}
                  disabled={mode === 'edit'}
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.toLowerCase() }))}
                />
                <p className="text-[10px] mt-0.5 text-muted-foreground">{t('form.idHint')}</p>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('form.name')}</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{t('form.description')}</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t('addons.form.grantsTitle')}</p>
              <p className="text-[10px] text-muted-foreground mb-2">{t('addons.form.grantsHint')}</p>
              <div className="space-y-2">
                {METERS.map((meter) => (
                  <div key={meter} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm">{t(`limits.${meter}`)}</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="flex-1 border rounded px-2 py-1.5 text-sm disabled:opacity-50"
                      placeholder="0"
                      disabled={form.grants[meter].none}
                      value={form.grants[meter].value}
                      onChange={(e) => setForm((f) => ({ ...f, grants: { ...f.grants, [meter]: { ...f.grants[meter], value: e.target.value } } }))}
                    />
                    <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={form.grants[meter].none}
                        onChange={(e) => setForm((f) => ({ ...f, grants: { ...f.grants, [meter]: { ...f.grants[meter], none: e.target.checked } } }))}
                      />
                      {t('addons.form.noGrant')}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{t('form.prices')}</p>
              <p className="text-[10px] text-muted-foreground mb-2">{t('addons.form.pricesHint')}</p>
              <div className="space-y-2">
                {PRICE_COMBOS.map((combo) => {
                  const key = comboKey(combo.currency, combo.period);
                  const price = form.prices[key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm w-36 shrink-0">
                        <input
                          type="checkbox"
                          checked={price.enabled}
                          disabled={price.existing}
                          onChange={(e) => setForm((f) => ({ ...f, prices: { ...f.prices, [key]: { ...f.prices[key], enabled: e.target.checked } } }))}
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
                        onChange={(e) => setForm((f) => ({ ...f, prices: { ...f.prices, [key]: { ...f.prices[key], amount: e.target.value } } }))}
                      />
                      {price.existing && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('form.priceLocked')}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {mode === 'edit' && (
              <p className="text-[11px] px-2 py-1.5 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                {t('addons.form.syncNote')}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setMode(null)} disabled={saving}>{t('form.cancel')}</Button>
              <Button size="sm" disabled={!formValid || saving} onClick={submit}>
                {saving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{mode === 'create' ? t('form.creating') : t('form.saving')}</>
                  : mode === 'create' ? t('addons.form.create') : t('form.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirm(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">
              {confirm.type === 'archive' ? t('addons.confirm.archiveTitle') : t('addons.confirm.restoreTitle')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(confirm.type === 'archive' ? 'addons.confirm.archiveBody' : 'addons.confirm.restoreBody', { values: { name: confirm.addon.name } })}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>{t('confirm.cancel')}</Button>
              <Button
                size="sm"
                disabled={archiving || restoring}
                className={confirm.type === 'archive' ? 'bg-red-600 hover:bg-red-700 text-white' : undefined}
                onClick={() =>
                  confirm.type === 'archive'
                    ? archiveAddon({ variables: { addonId: confirm.addon.id } })
                    : unarchiveAddon({ variables: { addonId: confirm.addon.id } })
                }
              >
                {archiving || restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : t('confirm.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
