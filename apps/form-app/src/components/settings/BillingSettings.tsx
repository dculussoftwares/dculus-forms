import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { ChevronDown, AlertTriangle, Eye, FileText, Sparkles } from 'lucide-react';
import { Card, Button, toastSuccess, toastError } from '@dculus/ui';
import { cn } from '@dculus/utils';
import {
  GET_SUBSCRIPTION,
  GET_AI_TOKEN_USAGE,
  CREATE_PORTAL_SESSION,
  COMPLETE_ENTERPRISE_PAYMENT,
} from '../../graphql/subscription';
import { UpgradeModal } from '../subscription/UpgradeModal';
import { UsageChart } from '../subscription/UsageChart';
import { useTranslation } from '../../hooks/useTranslation';

function isChargebeeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return (
      parsed.protocol === 'https:' && (host === 'chargebee.com' || host.endsWith('.chargebee.com'))
    );
  } catch {
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

  const { data: subData, loading: subLoading } = useQuery(GET_SUBSCRIPTION);
  const [createPortalSession, { loading: portalLoading }] = useMutation(CREATE_PORTAL_SESSION);
  const [completeEnterprisePayment, { loading: enterpriseCheckoutLoading }] = useMutation(
    COMPLETE_ENTERPRISE_PAYMENT
  );

  const subscription = subData?.activeOrganization?.subscription;
  const organizationId = subData?.activeOrganization?.id ?? '';

  const { data: tokenData } = useQuery(GET_AI_TOKEN_USAGE, {
    variables: { organizationId },
    skip: !organizationId,
  });

  // Pre-open the tab synchronously in the click handler: calling window.open
  // after `await` loses the click's transient activation and gets popup-blocked.
  // The blank tab is navigated once the mutation returns, or closed on failure.
  const openHostedPage = async (
    fetchUrl: () => Promise<string | undefined>,
    errorTitle: string,
    onOpened: () => void
  ) => {
    const tab = window.open('', '_blank');
    try {
      const url = await fetchUrl();
      if (url && isChargebeeUrl(url) && tab) {
        tab.location.href = url;
        onOpened();
      } else {
        tab?.close();
        toastError(errorTitle, tab ? t('billing.invalidRedirectUrl') : t('billing.popupBlocked'));
      }
    } catch (error: unknown) {
      tab?.close();
      toastError(errorTitle, error instanceof Error ? error.message : t('billing.genericError'));
    }
  };

  const handleManageBilling = () =>
    openHostedPage(
      async () => (await createPortalSession()).data?.createPortalSession?.url,
      t('billing.portalError'),
      () => toastSuccess(t('billing.portalOpening'), t('billing.portalOpeningDesc'))
    );

  const handleCompleteEnterprisePayment = () =>
    openHostedPage(
      async () => (await completeEnterprisePayment()).data?.completeEnterprisePayment?.url,
      t('billing.checkoutError'),
      () => toastSuccess(t('billing.checkoutOpening'), t('billing.checkoutOpeningDesc'))
    );

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

  const { planId, status, usage, currentPeriodStart, currentPeriodEnd, enterprisePendingActivation } = subscription;
  const planName = planId.charAt(0).toUpperCase() + planId.slice(1);

  const resetDateFormatted = new Date(Number(currentPeriodEnd)).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const tokenUsage = tokenData?.aiTokenUsage;
  const tokenPct = tokenUsage && tokenUsage.creditsLimit > 0
    ? Math.min((tokenUsage.creditsUsed / tokenUsage.creditsLimit) * 100, 100)
    : 0;
  const tokenResetDate = tokenUsage
    ? (() => {
        const d = new Date(tokenUsage.resetAt);
        return isNaN(d.getTime())
          ? ''
          : t('billing.aiCreditsResetOn', {
              values: {
                date: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
              },
            });
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

      {/* Enterprise plan awaiting first payment — distinct from ordinary
          dunning below: the org has never paid, so the Chargebee self-serve
          portal can't help (Chargebee's subscription hasn't switched to the
          enterprise item yet). This regenerates a fresh checkout page instead
          of relying on the admin's emailed/copied link, which expires. */}
      {planId === 'enterprise' && status === 'past_due' && enterprisePendingActivation && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3 flex-wrap">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="flex-1 text-sm text-red-700">{t('billing.enterprisePendingDescription')}</p>
          <Button
            size="sm"
            onClick={handleCompleteEnterprisePayment}
            disabled={enterpriseCheckoutLoading}
            className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
          >
            {enterpriseCheckoutLoading ? t('billing.opening') : t('billing.completePayment')}
          </Button>
        </div>
      )}

      {/* Past due alert (ordinary dunning) — not shown for a still-unpaid
          enterprise deal, which gets the banner above instead. */}
      {status === 'past_due' && !(planId === 'enterprise' && enterprisePendingActivation) && (
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
            label={t('billing.aiCreditsLabel')}
            used={tokenUsage?.creditsUsed ?? 0}
            limit={tokenUsage?.creditsLimit ?? null}
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
              organizationId={organizationId}
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
