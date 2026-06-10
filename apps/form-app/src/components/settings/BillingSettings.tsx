import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { ChevronDown, AlertTriangle, Eye, FileText, Sparkles } from 'lucide-react';
import { Card, Button, toastSuccess, toastError } from '@dculus/ui';
import { cn } from '@dculus/utils';
import {
  GET_SUBSCRIPTION,
  GET_AI_TOKEN_USAGE,
  CREATE_PORTAL_SESSION,
} from '../../graphql/subscription';
import { UpgradeModal } from '../subscription/UpgradeModal';
import { UsageChart } from '../subscription/UsageChart';
import { useTranslation } from '../../hooks/useTranslation';

function safeOpen(url: string, onError: (msg: string) => void): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (parsed.protocol !== 'https:' || (host !== 'chargebee.com' && !host.endsWith('.chargebee.com'))) {
      onError('Invalid redirect URL');
      return false;
    }
    window.open(url, '_blank');
    return true;
  } catch {
    onError('Malformed redirect URL');
    return false;
  }
}

function UsageCard({
  icon,
  label,
  used,
  limit,
  unlimited,
  percentage,
  resetDate,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number | null;
  unlimited: boolean;
  percentage: number | null;
  resetDate?: string;
}) {
  const pct = Math.min(percentage ?? 0, 100);
  const barColor =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-500' : 'bg-[#3c323e]';

  return (
    <div className="rounded-lg border border-[rgba(81,76,84,0.1)] bg-[#f7f7f8] p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-[#655d67]">
        <span className="text-[#655d67]">{icon}</span>
        {label}
      </div>
      <div className="mb-1 text-xl font-bold text-[#262627]">
        {used.toLocaleString()}
        {!unlimited && limit != null && (
          <span className="ml-1 text-sm font-normal text-[#655d67]">
            / {limit.toLocaleString()}
          </span>
        )}
      </div>
      {unlimited ? (
        <p className="mb-2 text-xs text-[#177767]">Unlimited</p>
      ) : (
        <>
          <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-[#b0a8b2]">{pct.toFixed(1)}%</p>
        </>
      )}
      {resetDate && (
        <p className="mt-1 text-[10px] text-[#b0a8b2]">{resetDate}</p>
      )}
    </div>
  );
}

export function BillingSettings() {
  const { t } = useTranslation('settings');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const { data: subData, loading: subLoading } = useQuery<any, any>(GET_SUBSCRIPTION);
  const [createPortalSession, { loading: portalLoading }] = useMutation(CREATE_PORTAL_SESSION);

  const subscription = subData?.activeOrganization?.subscription;
  const organizationId = subData?.activeOrganization?.id ?? '';

  const { data: tokenData } = useQuery<any, any>(GET_AI_TOKEN_USAGE, {
    variables: { organizationId },
    skip: !organizationId,
  });

  const handleManageBilling = async () => {
    try {
      const { data } = await createPortalSession();
      if (data?.createPortalSession?.url) {
        const opened = safeOpen(data.createPortalSession.url, (msg) =>
          toastError(t('billing.portalError'), msg)
        );
        if (opened) {
          toastSuccess(t('billing.portalOpening'), t('billing.portalOpeningDesc'));
        }
      }
    } catch (error: any) {
      toastError(t('billing.portalError'), error.message);
    }
  };

  if (subLoading) {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#262627]">{t('billing.title')}</h1>
          <p className="mt-1 text-sm text-[#655d67]">{t('billing.subtitle')}</p>
        </div>
        <Card className="animate-pulse p-6">
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
          <h1 className="text-2xl font-semibold text-[#262627]">{t('billing.title')}</h1>
          <p className="mt-1 text-sm text-[#655d67]">{t('billing.subtitle')}</p>
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

  const resetDateFormatted = new Date(Number(currentPeriodEnd)).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const tokenUsage = tokenData?.aiTokenUsage;
  const tokenPct = tokenUsage && tokenUsage.limit > 0
    ? Math.min((tokenUsage.used / tokenUsage.limit) * 100, 100)
    : 0;
  const tokenResetDate = tokenUsage
    ? (() => {
        const d = new Date(tokenUsage.resetAt);
        return isNaN(d.getTime())
          ? ''
          : `Your tokens reset on ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      })()
    : '';

  const limitExceeded = usage.views.exceeded || usage.submissions.exceeded;

  return (
    <div className="space-y-4">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#262627]">{t('billing.title')}</h1>
        <p className="mt-1 text-sm text-[#655d67]">{t('billing.subtitle')}</p>
      </div>

      {/* Limit exceeded alert */}
      {limitExceeded && (
        <div className="rounded-lg border border-[rgba(206,93,85,0.25)] bg-[rgba(206,93,85,0.06)] p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[#ce5d55] mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-[#ce5d55]">
            Usage limit exceeded. Upgrade to restore access.
          </div>
          <Button size="sm" onClick={() => setShowUpgradeModal(true)}
            className="shrink-0 bg-[#ce5d55] hover:bg-[#b94f47] text-white">
            Upgrade
          </Button>
        </div>
      )}

      {/* Past due alert */}
      {status === 'past_due' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="flex-1 text-sm text-red-700">
            Payment failed — please update your payment method.
          </p>
        </div>
      )}

      {/* Current plan card — mirrors Typeform's plan card */}
      <Card className="p-6">
        <div className="mb-1 text-lg font-bold text-[#262627]">
          Dculus <span className="font-bold">{planName}</span>
        </div>
        <p className="mb-5 text-sm text-[#655d67]">
          {planId === 'free'
            ? 'Build and share forms with your audience.'
            : `All the power of the ${planName} plan.`}
        </p>

        <div className="grid grid-cols-3 gap-4">
          <UsageCard
            icon={<Eye className="h-4 w-4" />}
            label="Form views"
            used={usage.views.used}
            limit={usage.views.limit}
            unlimited={usage.views.unlimited}
            percentage={usage.views.percentage}
            resetDate={`Resets ${resetDateFormatted}`}
          />
          <UsageCard
            icon={<FileText className="h-4 w-4" />}
            label="Submissions"
            used={usage.submissions.used}
            limit={usage.submissions.limit}
            unlimited={usage.submissions.unlimited}
            percentage={usage.submissions.percentage}
            resetDate={`Resets ${resetDateFormatted}`}
          />
          <UsageCard
            icon={<Sparkles className="h-4 w-4" />}
            label="AI tokens"
            used={tokenUsage?.used ?? 0}
            limit={tokenUsage?.limit ?? null}
            unlimited={false}
            percentage={tokenPct}
            resetDate={tokenResetDate}
          />
        </div>

        {/* View trends toggle */}
        <button
          onClick={() => setShowChart((v) => !v)}
          className="mt-4 flex items-center gap-1 text-xs text-[#655d67] hover:text-[#3c323e] transition-colors"
        >
          {showChart ? t('billing.hideTrends') : t('billing.viewTrends')}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showChart && 'rotate-180')} />
        </button>

        {showChart && (
          <div className="mt-4 border-t border-[rgba(81,76,84,0.08)] pt-4">
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

        <div className="mt-6 flex items-center gap-3">
          {planId !== 'advanced' && (
            <Button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-[#3c323e] hover:bg-[#2e2530] text-white"
            >
              Upgrade
            </Button>
          )}
        </div>
      </Card>

      {/* Billing details card */}
      <Card className="p-6">
        <div className="mb-1 text-base font-semibold text-[#262627]">Billing details</div>
        <p className="mb-4 text-sm text-[#655d67]">
          Manage your billing information and download invoices.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManageBilling}
          disabled={portalLoading}
          className="text-[#3c323e] border-[rgba(81,76,84,0.2)]"
        >
          {portalLoading ? 'Opening…' : 'Edit billing details'}
        </Button>
      </Card>

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} currentPlan={planId} />
      )}
    </div>
  );
}
