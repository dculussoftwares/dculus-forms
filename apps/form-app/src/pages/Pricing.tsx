import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { Button, Card, Badge, toastSuccess, toastError } from '@dculus/ui';
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

  const { data, loading } = useQuery(GET_AVAILABLE_PLANS);
  const [createCheckoutSession, { loading: checkoutLoading }] =
    useMutation(CREATE_CHECKOUT_SESSION);

  const plans = data?.availablePlans || [];

  const planConfig: Record<
    string,
    {
      icon: any;
      color: string;
      gradient: string;
      tagline: string;
      features: string[];
      recommended?: boolean;
    }
  > = {
    free: {
      icon: Zap,
      color: 'gray',
      gradient: 'from-gray-500 to-gray-600',
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
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
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
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
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
    const displayAmount = curr === 'USD' ? amount / 100 : amount / 100;
    return `${symbol}${displayAmount.toFixed(2)}`;
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('hero.title')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            {t('hero.subtitle')}
          </p>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            {/* Billing Cycle Toggle */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
              <Button
                variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('monthly')}
                size="sm"
              >
                {t('billing.monthly')}
              </Button>
              <Button
                variant={billingCycle === 'yearly' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('yearly')}
                size="sm"
                className="relative"
              >
                {t('billing.yearly')}
                <Badge className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5">
                  {t('billing.savePercent')}
                </Badge>
              </Button>
            </div>

            {/* Currency Toggle */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
              <Button
                variant={currency === 'USD' ? 'default' : 'ghost'}
                onClick={() => setCurrency('USD')}
                size="sm"
              >
                {t('billing.usd')}
              </Button>
              <Button
                variant={currency === 'INR' ? 'default' : 'ghost'}
                onClick={() => setCurrency('INR')}
                size="sm"
              >
                {t('billing.inr')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Plans Section */}
      <div className="px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">{t('loading.plans')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {plans.map((plan: any) => {
                const config = planConfig[plan.id];
                if (!config) return null;

                const price = getPriceForPlan(plan.id);
                const Icon = config.icon;
                const isRecommended = config.recommended;

                return (
                  <Card
                    key={plan.id}
                    className={`relative p-8 transition-all hover:shadow-xl ${
                      isRecommended
                        ? 'ring-2 ring-blue-500 scale-105'
                        : 'hover:scale-105'
                    }`}
                  >
                    {/* Recommended Badge */}
                    {isRecommended && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-1.5">
                          {t('plans.recommended')}
                        </Badge>
                      </div>
                    )}

                    {/* Plan Icon & Name */}
                    <div className="flex flex-col items-center mb-6">
                      <div
                        className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center mb-4`}
                      >
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{config.tagline}</p>
                    </div>

                    {/* Pricing */}
                    {plan.id === 'free' ? (
                      <div className="text-center mb-8">
                        <div className="text-5xl font-bold">{t('plans.free.price')}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {t('plans.free.forever')}
                        </div>
                      </div>
                    ) : price ? (
                      <div className="text-center mb-8">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-5xl font-bold">
                            {formatPrice(price.amount, currency)}
                          </span>
                          <span className="text-gray-500">
                            {billingCycle === 'monthly'
                              ? t('billing.perMonth')
                              : t('billing.perYear')}
                          </span>
                        </div>
                        {billingCycle === 'yearly' && (
                          <div className="text-sm text-gray-500 mt-2">
                            {currency === 'USD' ? '$' : '₹'}
                            {getMonthlyEquivalent(price.amount / 100, 'year')}
                            {t('billing.billedAnnually')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center mb-8">
                        <div className="text-lg text-gray-500">
                          {t('plans.priceNotAvailable')}
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    <div className="space-y-3 mb-8">
                      {config.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <Button
                      onClick={() => handleGetStarted(plan.id)}
                      disabled={checkoutLoading}
                      className={`w-full ${
                        isRecommended
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'
                          : ''
                      }`}
                    >
                      {checkoutLoading
                        ? t('buttons.processing')
                        : plan.id === 'free'
                        ? t('buttons.getStarted')
                        : t('buttons.upgradeTo', { values: { planName: plan.name } })}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            {t('faq.title')}
          </h2>
          <div className="space-y-4">
            {[
              {
                question: t('faq.items.changePlans.question'),
                answer: t('faq.items.changePlans.answer'),
              },
              {
                question: t('faq.items.cancelAnytime.question'),
                answer: t('faq.items.cancelAnytime.answer'),
              },
              {
                question: t('faq.items.paymentMethods.question'),
                answer: t('faq.items.paymentMethods.answer'),
              },
              {
                question: t('faq.items.freeForever.question'),
                answer: t('faq.items.freeForever.answer'),
              },
            ].map((faq, index) => (
              <Card key={index} className="p-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-2">{faq.question}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-blue-600 to-purple-600 text-white p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">{t('cta.title')}</h2>
            <p className="text-xl mb-8 text-white text-opacity-90">
              {t('cta.subtitle')}
            </p>
            <Button
              onClick={() => (user ? navigate('/dashboard') : navigate('/signup'))}
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              {user ? t('cta.buttons.goToDashboard') : t('cta.buttons.getStartedFree')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
