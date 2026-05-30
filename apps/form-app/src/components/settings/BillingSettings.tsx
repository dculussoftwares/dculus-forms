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
  const freePlan = { id: 'free', name: 'Free', prices: [], features: { views: 10000, submissions: 1000 } };
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
            const isCurrent = plan.id === planId || (plan.id === 'free' && planId === 'free');
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
