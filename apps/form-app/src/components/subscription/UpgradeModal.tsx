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

interface UpgradeModalProps {
  onClose: () => void;
  currentPlan: string;
}

type BillingCycle = 'monthly' | 'yearly';
type Currency = 'USD' | 'INR';

export const UpgradeModal = ({ onClose, currentPlan }: UpgradeModalProps) => {
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
        '10,000 form views per month',
        '1,000 form submissions per month',
        'Unlimited forms',
        'Real-time collaboration',
        'Basic analytics',
        'Community support',
      ],
    },
    starter: {
      icon: TrendingUp,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      features: [
        'Unlimited form views',
        '10,000 form submissions per month',
        'Unlimited forms',
        'Real-time collaboration',
        'Advanced analytics',
        'Email support',
        'Custom domain',
        'API access',
      ],
      recommended: true,
    },
    advanced: {
      icon: Sparkles,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      features: [
        'Unlimited form views',
        '100,000 form submissions per month',
        'Unlimited forms',
        'Real-time collaboration',
        'Advanced analytics + Export',
        'Priority support',
        'Custom domain',
        'API access',
        'White-label options',
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
      toastError('Price not found', 'Unable to find pricing for selected plan');
      return;
    }

    try {
      const { data } = await createCheckoutSession({
        variables: { itemPriceId: price.id },
      });

      if (data?.createCheckoutSession?.url) {
        // Redirect to Chargebee checkout
        window.location.href = data.createCheckoutSession.url;
        toastSuccess('Redirecting to checkout', 'Please complete payment to upgrade');
      }
    } catch (error: any) {
      toastError('Checkout failed', error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold">Upgrade Your Plan</h2>
            <p className="text-sm text-gray-500 mt-1">
              Choose the perfect plan for your needs
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
                Monthly
              </Button>
              <Button
                variant={billingCycle === 'yearly' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('yearly')}
                className="flex-1 relative"
              >
                Yearly
                <Badge className="ml-2 bg-green-500 text-white text-xs">
                  Save 8%
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
                USD ($)
              </Button>
              <Button
                variant={currency === 'INR' ? 'default' : 'ghost'}
                onClick={() => setCurrency('INR')}
                className="flex-1"
              >
                INR (₹)
              </Button>
            </div>
          </div>

          {/* Plans Grid */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading plans...</p>
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
                          Recommended
                        </Badge>
                      </div>
                    )}

                    {/* Current Plan Badge */}
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-gray-600 to-gray-500 text-white px-3 py-1">
                          Current Plan
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
                        <div className="text-4xl font-bold">Free</div>
                        <div className="text-sm text-gray-500">Forever</div>
                      </div>
                    ) : price ? (
                      <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold">
                            {formatPrice(price.amount, currency)}
                          </span>
                          <span className="text-gray-500">
                            /{billingCycle === 'monthly' ? 'month' : 'year'}
                          </span>
                        </div>
                        {billingCycle === 'yearly' && (
                          <div className="text-sm text-gray-500 mt-1">
                            {currency === 'USD' ? '$' : '₹'}{getMonthlyEquivalent(price.amount, 'year')}/month billed annually
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-6">
                        <div className="text-lg text-gray-500">
                          Price not available
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
                        Current Plan
                      </Button>
                    ) : plan.id === 'free' ? (
                      <Button disabled variant="outline" className="w-full">
                        Downgrade not available
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={checkoutLoading || !price}
                        className="w-full"
                      >
                        {checkoutLoading ? 'Processing...' : `Upgrade to ${plan.name}`}
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
              All plans include unlimited forms, real-time collaboration, and our plugin system.
              <br />
              You can upgrade or downgrade at any time. No long-term contracts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
