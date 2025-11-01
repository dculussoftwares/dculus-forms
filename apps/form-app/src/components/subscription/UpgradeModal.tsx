import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Button,
  Card,
  Badge,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { X, Check, TrendingUp, Zap, Sparkles } from 'lucide-react';
import { GET_AVAILABLE_PLANS, CREATE_CHECKOUT_SESSION } from '../../graphql/subscription';
import { useTranslation } from '../../hooks/useTranslation';

interface UpgradeModalProps {
  onClose: () => void;
  currentPlan: string;
}

type BillingCycle = 'monthly' | 'yearly';
type Currency = 'USD' | 'INR';

export const UpgradeModal = ({ onClose, currentPlan }: UpgradeModalProps) => {
  const { t } = useTranslation('upgradeModal');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [currency, setCurrency] = useState<Currency>('USD');

  const { data, loading } = useQuery(GET_AVAILABLE_PLANS);
  const [createCheckoutSession, { loading: checkoutLoading }] = useMutation(CREATE_CHECKOUT_SESSION);

  const plans = data?.availablePlans || [];

  // Plan configurations
  const planConfig: Record<string, {
    icon: any;
    color: string;
    gradient: string;
    features: string[];
    recommended?: boolean;
  }> = {
    free: {
      icon: Zap,
      color: 'gray',
      gradient: 'from-gray-500 to-gray-600',
        features: [
          t('plans.features.free.formViews'),
          t('plans.features.free.submissions'), 
          t('plans.features.free.unlimitedForms'),
          t('plans.features.free.collaboration'),
          t('plans.features.free.analytics'),
          t('plans.features.free.support')
        ],
    },
    starter: {
      icon: TrendingUp,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
        features: [
          t('plans.features.starter.formViews'),
          t('plans.features.starter.submissions'),
          t('plans.features.starter.unlimitedForms'),
          t('plans.features.starter.collaboration'),
          t('plans.features.starter.analytics'),
          t('plans.features.starter.support'),
          t('plans.features.starter.customDomain'),
          t('plans.features.starter.apiAccess')
        ],
      recommended: true,
    },
    advanced: {
      icon: Sparkles,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
        features: [
          t('plans.features.advanced.formViews'),
          t('plans.features.advanced.submissions'),
          t('plans.features.advanced.unlimitedForms'),
          t('plans.features.advanced.collaboration'),
          t('plans.features.advanced.analytics'),
          t('plans.features.advanced.support'),
          t('plans.features.advanced.customDomain'),
          t('plans.features.advanced.apiAccess'),
          t('plans.features.advanced.whiteLabel')
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
    return `${symbol}${amount}`;
  };

  const getMonthlyEquivalent = (amount: number, period: string) => {
    if (period === 'month') return amount;
    return (amount / 12).toFixed(2);
  };

  const handleUpgrade = async (planId: string) => {
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
        // Redirect to Chargebee checkout
        window.location.href = data.createCheckoutSession.url;
        toastSuccess(t('messages.checkoutSuccess.title'), t('messages.checkoutSuccess.message'));
      }
    } catch (error: any) {
      toastError(t('messages.checkoutError.title'), error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold">{t('header.title')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('header.subtitle')}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Billing Cycle Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <Button
                variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('monthly')}
                className="flex-1"
              >
                {t('billing.monthly')}
              </Button>
              <Button
                variant={billingCycle === 'yearly' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('yearly')}
                className="flex-1 relative"
              >
                {t('billing.yearly')}
                <Badge className="ml-2 bg-green-500 text-white text-xs">
                  {t('billing.save')}
                </Badge>
              </Button>
            </div>

            {/* Currency Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <Button
                variant={currency === 'USD' ? 'default' : 'ghost'}
                onClick={() => setCurrency('USD')}
                className="flex-1"
              >
                {t('billing.usd')}
              </Button>
              <Button
                variant={currency === 'INR' ? 'default' : 'ghost'}
                onClick={() => setCurrency('INR')}
                className="flex-1"
              >
                {t('billing.inr')}
              </Button>
            </div>
          </div>

          {/* Plans Grid */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">{t('loading.plans')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan: any) => {
                const config = planConfig[plan.id];
                if (!config) return null;

                const price = getPriceForPlan(plan.id);
                const Icon = config.icon;
                const isCurrentPlan = currentPlan === plan.id;
                const isRecommended = config.recommended;

                return (
                  <Card
                    key={plan.id}
                    className={`relative p-6 transition-all hover:shadow-lg ${
                      isCurrentPlan ? 'opacity-75' : ''
                    }`}
                  >
                    {/* Recommended Badge */}
                    {isRecommended && !isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-1">
                          {t('plans.recommended')}
                        </Badge>
                      </div>
                    )}

                    {/* Current Plan Badge */}
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-gray-600 to-gray-500 text-white px-3 py-1">
                          {t('plans.currentPlan')}
                        </Badge>
                      </div>
                    )}

                    {/* Plan Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`h-12 w-12 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}
                      >
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{plan.name}</h3>
                      </div>
                    </div>

                    {/* Pricing */}
                    {plan.id === 'free' ? (
                      <div className="mb-6">
                        <div className="text-4xl font-bold">{t('plans.free')}</div>
                        <div className="text-sm text-gray-500">{t('plans.forever')}</div>
                      </div>
                    ) : price ? (
                      <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold">
                            {formatPrice(price.amount, currency)}
                          </span>
                          <span className="text-gray-500">
                            {billingCycle === 'monthly' ? t('billing.perMonth') : t('billing.perYear')}
                          </span>
                        </div>
                        {billingCycle === 'yearly' && (
                          <div className="text-sm text-gray-500 mt-1">
                            {currency === 'USD' ? '$' : '₹'}{getMonthlyEquivalent(price.amount, 'year')}{t('billing.billedAnnually')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-6">
                        <div className="text-lg text-gray-500">
                          {t('plans.priceNotAvailable')}
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    <div className="space-y-3 mb-6">
                      {config.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Action Button */}
                    {isCurrentPlan ? (
                      <Button disabled variant="outline" className="w-full">
                        {t('buttons.currentPlan')}
                      </Button>
                    ) : plan.id === 'free' ? (
                      <Button disabled variant="outline" className="w-full">
                        {t('buttons.downgradeNotAvailable')}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={checkoutLoading || !price}
                        className="w-full"
                      >
                        {checkoutLoading ? t('buttons.processing') : t('buttons.upgradeTo', { values: { planName: plan.name } })}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {t('footer.note')}
              <br />
              {t('footer.flexibility')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
