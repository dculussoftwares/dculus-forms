import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { Button, toastSuccess, toastError } from '@dculus/ui';
import {
  Check,
  Zap,
  TrendingUp,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { GET_AVAILABLE_PLANS, CREATE_CHECKOUT_SESSION } from '../graphql/subscription';
import { useAuthContext } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';

type BillingCycle = 'monthly' | 'yearly';
type Currency = 'USD' | 'INR';

export const Pricing = () => {
  const { t } = useTranslation('pricing');
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [currency, setCurrency] = useState<Currency>('USD');

  const { data, loading } = useQuery<any, any>(GET_AVAILABLE_PLANS);
  const [createCheckoutSession, { loading: checkoutLoading }] =
    useMutation(CREATE_CHECKOUT_SESSION);

  const plans = data?.availablePlans || [];

  /* Typeform field-icon palette for plan tiers */
  const planConfig: Record<string, { icon: any; iconBg: string; iconColor: string; tagline: string; features: string[]; recommended?: boolean }> = {
    free: {
      icon: Zap,
      iconBg: 'var(--tf-icon-gray)', iconColor: 'var(--tf-text)',
      tagline: t('plans.free.tagline'),
      features: [
        t('plans.free.features.views'),
        t('plans.free.features.submissions'),
        t('plans.free.features.forms'),
        t('plans.free.features.collaboration'),
        t('plans.free.features.analytics'),
        t('plans.free.features.support'),
      ],
    },
    starter: {
      icon: TrendingUp,
      iconBg: 'var(--tf-icon-teal)', iconColor: 'var(--tf-green)',
      tagline: t('plans.starter.tagline'),
      features: [
        t('plans.starter.features.views'),
        t('plans.starter.features.submissions'),
        t('plans.starter.features.forms'),
        t('plans.starter.features.collaboration'),
        t('plans.starter.features.analytics'),
        t('plans.starter.features.support'),
        t('plans.starter.features.customDomain'),
        t('plans.starter.features.apiAccess'),
      ],
      recommended: true,
    },
    advanced: {
      icon: Sparkles,
      iconBg: 'var(--tf-icon-lavender)', iconColor: '#5c2e6b',
      tagline: t('plans.advanced.tagline'),
      features: [
        t('plans.advanced.features.views'),
        t('plans.advanced.features.submissions'),
        t('plans.advanced.features.forms'),
        t('plans.advanced.features.collaboration'),
        t('plans.advanced.features.analytics'),
        t('plans.advanced.features.support'),
        t('plans.advanced.features.customDomain'),
        t('plans.advanced.features.apiAccess'),
        t('plans.advanced.features.whiteLabel'),
        t('plans.advanced.features.sla'),
      ],
    },
  };

  const getPriceForPlan = (planId: string) => {
    const plan = plans.find((p: any) => p.id === planId);
    if (!plan) return null;

    const period = billingCycle === 'monthly' ? 'month' : 'year';
    const price = plan.prices.find(
      (p: any) => p.currency === currency && p.period === period
    );

    return price;
  };

  const formatPrice = (amount: number, curr: string) => {
    const symbol = curr === 'USD' ? '$' : '₹';
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getMonthlyEquivalent = (amount: number, period: string) => {
    if (period === 'month') return amount;
    return (amount / 12).toFixed(2);
  };

  const handleGetStarted = async (planId: string) => {
    if (!user) {
      // Redirect to signup
      navigate('/signup?redirect=/pricing');
      return;
    }

    if (planId === 'free') {
      navigate('/dashboard');
      return;
    }

    const price = getPriceForPlan(planId);
    if (!price) {
      toastError(t('messages.priceNotFound.title'), t('messages.priceNotFound.message'));
      return;
    }

    try {
      const { data } = await createCheckoutSession({
        variables: { itemPriceId: price.id },
      });

      if (data?.createCheckoutSession?.url) {
        window.location.href = data.createCheckoutSession.url;
        toastSuccess(t('messages.redirecting.title'), t('messages.redirecting.message'));
      }
    } catch (error: any) {
      toastError(t('messages.error.title'), error.message);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--tf-faint)' }}>
      {/* ── Hero ── */}
      <div className="pt-14 pb-10 px-6 text-center">
        <h1 className="text-4xl font-light mb-3 tracking-tight text-primary">
          {t('hero.title')}
        </h1>
        <p className="text-base mb-10 text-muted-foreground">
          {t('hero.subtitle')}
        </p>

        {/* Controls — Typeform ghost toggle group */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* Billing toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--tf-border-strong)' }}>
            {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => (
              <Button key={cycle} onClick={() => setBillingCycle(cycle)}
                variant={billingCycle === cycle ? 'default' : 'ghost'}
                className="flex items-center gap-1.5 h-8 px-4 text-xs font-medium rounded-none"
              >
                {cycle === 'monthly' ? t('billing.monthly') : t('billing.yearly')}
                {cycle === 'yearly' && billingCycle !== 'yearly' && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: 'var(--tf-icon-teal)', color: 'var(--tf-green)' }}>
                    {t('billing.savePercent')}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Currency toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--tf-border-strong)' }}>
            {(['USD', 'INR'] as Currency[]).map((curr) => (
              <Button key={curr} onClick={() => setCurrency(curr)}
                variant={currency === curr ? 'default' : 'ghost'}
                className="h-8 px-4 text-xs font-medium rounded-none"
              >
                {curr === 'USD' ? t('billing.usd') : t('billing.inr')}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Plans ── */}
      <div className="px-6 pb-14 max-w-5xl mx-auto">
        {loading ? (
          <div className="text-center py-14">
            <div className="w-8 h-8 rounded-full border-2 animate-spin mx-auto mb-3" style={{ borderColor: 'var(--tf-border-strong)', borderTopColor: 'var(--tf-dark)' }} />
            <p className="text-xs text-muted-foreground">{t('loading.plans')}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan: any) => {
              const config = planConfig[plan.id];
              if (!config) return null;
              const price = getPriceForPlan(plan.id);
              const Icon = config.icon;
              const isRecommended = config.recommended;

              return (
                <div
                  key={plan.id}
                  className="relative rounded-xl bg-white p-7 flex flex-col transition-all duration-200"
                  style={{
                    border: isRecommended ? '2px solid #3c323e' : '1px solid var(--tf-border-medium)',
                    boxShadow: isRecommended ? '0 4px 24px rgba(60,50,62,0.12)' : '0 1px 4px var(--tf-overlay)',
                  }}
                >
                  {/* Recommended badge — Typeform pill style */}
                  {isRecommended && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: 'var(--tf-dark)' }}>
                        {t('plans.recommended')}
                      </span>
                    </div>
                  )}

                  {/* Icon + name */}
                  <div className="flex flex-col items-center mb-6 text-center">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: config.iconBg }}>
                      <Icon className="h-6 w-6" style={{ color: config.iconColor }} />
                    </div>
                    <h3 className="text-lg font-semibold text-primary">{plan.name}</h3>
                    <p className="text-xs mt-0.5 text-muted-foreground">{config.tagline}</p>
                  </div>

                  {/* Price — Typeform light weight */}
                  {plan.id === 'free' ? (
                    <div className="text-center mb-7">
                      <div className="text-4xl font-light text-primary">{t('plans.free.price')}</div>
                      <div className="text-xs mt-1 text-muted-foreground">{t('plans.free.forever')}</div>
                    </div>
                  ) : price ? (
                    <div className="text-center mb-7">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-light text-primary">{formatPrice(price.amount, currency)}</span>
                        <span className="text-xs text-muted-foreground">{billingCycle === 'monthly' ? t('billing.perMonth') : t('billing.perYear')}</span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <div className="text-xs mt-1 text-muted-foreground">
                          {currency === 'USD' ? '$' : '₹'}{getMonthlyEquivalent(price.amount, 'year')}{t('billing.billedAnnually')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center mb-7 text-sm text-muted-foreground">{t('plans.priceNotAvailable')}</div>
                  )}

                  {/* Features — Typeform simple ticks */}
                  <div className="space-y-2.5 mb-7 flex-1">
                    {config.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--tf-green)]" />
                        <span className="text-xs text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA button — Typeform dark aubergine */}
                  <Button
                    onClick={() => handleGetStarted(plan.id)}
                    disabled={checkoutLoading}
                    className="w-full h-9 flex items-center justify-center gap-1.5"
                  >
                    {checkoutLoading ? t('buttons.processing') : plan.id === 'free' ? t('buttons.getStarted') : t('buttons.upgradeTo', { values: { planName: plan.name } })}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FAQ ── */}
      <div className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-light text-center mb-7 text-primary">{t('faq.title')}</h2>
        <div className="space-y-3">
          {[
            { question: t('faq.items.changePlans.question'), answer: t('faq.items.changePlans.answer') },
            { question: t('faq.items.cancelAnytime.question'), answer: t('faq.items.cancelAnytime.answer') },
            { question: t('faq.items.paymentMethods.question'), answer: t('faq.items.paymentMethods.answer') },
            { question: t('faq.items.freeForever.question'), answer: t('faq.items.freeForever.answer') },
          ].map((faq, i) => (
            <div key={i} className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
              <div className="flex items-start gap-3">
                <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-medium mb-1 text-primary">{faq.question}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="rounded-xl p-10 text-center text-white" style={{ backgroundColor: 'var(--tf-darkest)' }}>
          <h2 className="text-2xl font-light mb-3">{t('cta.title')}</h2>
          <p className="text-sm mb-7 text-[rgba(255,255,255,0.70)]">{t('cta.subtitle')}</p>
          <Button
            onClick={() => (user ? navigate('/dashboard') : navigate('/signup'))}
            variant="outline"
            className="inline-flex items-center gap-2 h-10 px-7"
          >
            {user ? t('cta.buttons.goToDashboard') : t('cta.buttons.getStartedFree')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
