import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { X, Check } from 'lucide-react';
import { cn } from '@dculus/utils';
import { toastSuccess, toastError } from '@dculus/ui';
import { GET_AVAILABLE_PLANS, CREATE_CHECKOUT_SESSION } from '../../graphql/subscription';

interface UpgradeModalProps {
  onClose: () => void;
  currentPlan: string;
}

type BillingCycle = 'monthly' | 'yearly';
type Currency = 'USD' | 'INR';

const PLAN_META: Record<string, { tagline: string; planSize: string[]; benefits: string[] }> = {
  free: {
    tagline: 'Build and share forms for free, forever',
    planSize: ['10,000 form views / month', '1,000 submissions / month', '50k AI tokens / month'],
    benefits: ['Unlimited forms', 'Real-time collaboration', 'Basic analytics'],
  },
  starter: {
    tagline: 'More responses, more power',
    planSize: ['Unlimited form views', '10,000 submissions / month', '500k AI tokens / month'],
    benefits: ['Everything in Free', 'Advanced analytics', 'Email support', 'API access (coming soon)'],
  },
  advanced: {
    tagline: 'For teams that need scale',
    planSize: ['Unlimited form views', '100,000 submissions / month', '5M AI tokens / month'],
    benefits: ['Everything in Starter', 'Priority support', 'Analytics export', 'White-label (coming soon)'],
  },
};

function safeRedirect(url: string, onError: (msg: string) => void) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (parsed.protocol !== 'https:' || (host !== 'chargebee.com' && !host.endsWith('.chargebee.com'))) {
      onError('Invalid redirect URL');
      return;
    }
    window.location.href = url;
  } catch {
    onError('Malformed redirect URL');
  }
}

export const UpgradeModal = ({ onClose, currentPlan }: UpgradeModalProps) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    currentPlan === 'free' ? 'starter' : currentPlan === 'starter' ? 'advanced' : null
  );

  const { data, loading } = useQuery<any, any>(GET_AVAILABLE_PLANS);
  const [createCheckoutSession, { loading: checkoutLoading }] = useMutation<any, any>(CREATE_CHECKOUT_SESSION);

  const plans: any[] = data?.availablePlans || [];

  const getPrice = (planId: string) => {
    const plan = plans.find((p: any) => p.id === planId);
    if (!plan) return null;
    const period = billingCycle === 'monthly' ? 'month' : 'year';
    return plan.prices?.find((p: any) => p.currency === currency && p.period === period) ?? null;
  };

  const formatAmount = (price: any): string => {
    if (!price) return '—';
    const symbol = currency === 'USD' ? '$' : '₹';
    const amount = billingCycle === 'yearly'
      ? Math.round(price.amount / 12)
      : price.amount;
    return `${symbol}${amount}`;
  };

  const handleCheckout = async () => {
    if (!selectedPlanId) return;
    const price = getPrice(selectedPlanId);
    if (!price) {
      toastError('Price not found', 'Unable to find pricing for the selected plan');
      return;
    }
    try {
      const { data } = await createCheckoutSession({ variables: { itemPriceId: price.id } });
      if (data?.createCheckoutSession?.url) {
        toastSuccess('Redirecting to checkout', 'Please complete payment to upgrade');
        safeRedirect(data.createCheckoutSession.url, (msg) =>
          toastError('Checkout failed', msg)
        );
      }
    } catch (error: any) {
      toastError('Checkout failed', error.message);
    }
  };

  const selectedPrice = selectedPlanId ? getPrice(selectedPlanId) : null;
  const selectedPlanMeta = selectedPlanId ? PLAN_META[selectedPlanId] : null;
  const selectedPlanData = selectedPlanId ? plans.find((p: any) => p.id === selectedPlanId) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f7f7f8] overflow-y-auto">

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[rgba(81,76,84,0.1)] bg-white px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#262627]">Plans that power your forms</h1>
        <div className="flex items-center gap-4">
          {/* Billing cycle toggle */}
          <div className="flex items-center rounded-full border border-[rgba(81,76,84,0.15)] bg-white p-0.5 text-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                'rounded-full px-4 py-1.5 transition-colors',
                billingCycle === 'monthly'
                  ? 'bg-[#3c323e] text-white'
                  : 'text-[#655d67] hover:text-[#3c323e]'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors',
                billingCycle === 'yearly'
                  ? 'bg-[#3c323e] text-white'
                  : 'text-[#655d67] hover:text-[#3c323e]'
              )}
            >
              Yearly
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                billingCycle === 'yearly'
                  ? 'bg-[#177767] text-white'
                  : 'bg-[rgba(23,119,103,0.12)] text-[#177767]'
              )}>
                Save 30%
              </span>
            </button>
          </div>

          {/* Currency toggle */}
          <div className="flex items-center rounded-full border border-[rgba(81,76,84,0.15)] bg-white p-0.5 text-sm">
            {(['USD', 'INR'] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cn(
                  'rounded-full px-3 py-1.5 transition-colors',
                  currency === c
                    ? 'bg-[#3c323e] text-white'
                    : 'text-[#655d67] hover:text-[#3c323e]'
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#655d67] hover:bg-[rgba(87,84,91,0.08)] hover:text-[#3c323e] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1">

        {/* Plan cards */}
        <div className="flex-1 px-8 py-8 flex flex-col">
          {loading ? (
            <div className="grid grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 animate-pulse rounded-xl bg-white border border-[rgba(81,76,84,0.12)]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5 h-full">
              {/* All plans from API — includes free if returned, skip unknowns */}
              {plans.map((plan: any) => {
                const meta = PLAN_META[plan.id];
                if (!meta) return null;
                const isPlanCurrent = currentPlan === plan.id;
                const isSelected = selectedPlanId === plan.id;
                return (
                  <PlanCard
                    key={plan.id}
                    planId={plan.id}
                    name={plan.name}
                    meta={meta}
                    price={getPrice(plan.id)}
                    formatAmount={formatAmount}
                    billingCycle={billingCycle}
                    isCurrentPlan={isPlanCurrent}
                    isSelected={isSelected}
                    onSelect={() => !isPlanCurrent && setSelectedPlanId(plan.id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Order summary panel */}
        <div className="w-[300px] shrink-0 border-l border-[rgba(81,76,84,0.1)] bg-white px-6 py-8">
          {selectedPlanId && selectedPlanData ? (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#655d67]">
                  Your new plan
                </p>
                <p className="text-lg font-bold text-[#262627]">{selectedPlanData.name}</p>
                {selectedPlanMeta && (
                  <p className="text-sm text-[#655d67]">{selectedPlanMeta.tagline}</p>
                )}
              </div>

              {selectedPrice && (
                <div className="rounded-lg border border-[rgba(81,76,84,0.12)] p-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[#262627]">
                      {formatAmount(selectedPrice)}
                    </span>
                    <span className="text-sm text-[#655d67]">/ mo</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <p className="mt-0.5 text-xs text-[#655d67]">Billed yearly</p>
                  )}
                </div>
              )}

              <div className="border-t border-[rgba(81,76,84,0.08)] pt-5">
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || !selectedPrice}
                  className={cn(
                    'w-full rounded-lg py-3 text-sm font-medium text-white transition-colors',
                    checkoutLoading || !selectedPrice
                      ? 'bg-[rgba(60,50,62,0.4)] cursor-not-allowed'
                      : 'bg-[#3c323e] hover:bg-[#2e2530]'
                  )}
                >
                  {checkoutLoading ? 'Redirecting…' : 'Continue to checkout'}
                </button>
              </div>

              <ul className="space-y-1.5 text-xs text-[#655d67]">
                <li>• You can cancel anytime before the renewal date.</li>
                <li>• All prices exclude applicable taxes.</li>
              </ul>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-center text-sm text-[#b0a8b2]">
                Select a plan to continue
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

function PlanCard({
  planId, name, meta, price, formatAmount, billingCycle,
  isCurrentPlan, isSelected, onSelect,
}: {
  planId: string;
  name: string;
  meta: typeof PLAN_META[string];
  price: any;
  formatAmount: (price: any) => string;
  billingCycle: BillingCycle;
  isCurrentPlan: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex flex-col rounded-xl border bg-white p-6 transition-all',
        isSelected
          ? 'border-2 border-[#177767] shadow-sm'
          : isCurrentPlan
          ? 'border border-[rgba(81,76,84,0.12)] opacity-60'
          : 'cursor-pointer border border-[rgba(81,76,84,0.12)] hover:shadow-md hover:border-[rgba(81,76,84,0.25)]'
      )}
    >
      {/* Plan name + tagline */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#262627]">{name}</h3>
          {isCurrentPlan && (
            <span className="rounded-full bg-[rgba(87,84,91,0.08)] px-2.5 py-0.5 text-[11px] font-medium text-[#655d67]">
              Current
            </span>
          )}
          {isSelected && !isCurrentPlan && (
            <span className="rounded-full bg-[rgba(23,119,103,0.1)] px-2.5 py-0.5 text-[11px] font-medium text-[#177767]">
              Selected
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[#655d67]">{meta.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-5">
        {planId === 'free' ? (
          <>
            <div className="text-2xl font-bold text-[#262627]">Free</div>
            <div className="text-xs text-[#655d67]">Forever</div>
          </>
        ) : price ? (
          <>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-bold text-[#262627]">{formatAmount(price)}</span>
              <span className="text-xs text-[#655d67]"> / mo</span>
            </div>
            {billingCycle === 'yearly' && (
              <div className="text-xs text-[#655d67]">Billed yearly</div>
            )}
          </>
        ) : (
          <div className="text-sm text-[#b0a8b2]">—</div>
        )}
      </div>

      {/* Plan size */}
      <div className="border-t border-[rgba(81,76,84,0.08)] pt-4 pb-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#655d67]">
          Plan size
        </p>
        <ul className="space-y-1.5">
          {meta.planSize.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[#4c414e]">
              <Check className="h-3.5 w-3.5 shrink-0 text-[#177767] mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Key benefits */}
      <div className="border-t border-[rgba(81,76,84,0.08)] pt-4 flex-1">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#655d67]">
          Key benefits
        </p>
        <ul className="space-y-1.5">
          {meta.benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[#4c414e]">
              <Check className="h-3.5 w-3.5 shrink-0 text-[#177767] mt-0.5" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
