import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { Button, Card } from '@dculus/ui';
import { CheckCircle2, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import { GET_SUBSCRIPTION } from '../../graphql/subscription';
import { useTranslation } from '../../hooks/useTranslation';

export const CheckoutSuccess = () => {
  const { t } = useTranslation('checkoutSuccess');
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);

  // Fetch subscription to get updated details
  const { data, loading, refetch } = useQuery(GET_SUBSCRIPTION, {
    pollInterval: 3000, // Poll every 3 seconds for webhook to sync
    fetchPolicy: 'network-only',
  });

  const subscription = data?.activeOrganization?.subscription;

  useEffect(() => {
    // Stop confetti after 3 seconds
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Stop polling once we detect the plan has changed
  useEffect(() => {
    if (subscription && subscription.planId !== 'free') {
      // Plan has been upgraded successfully
      refetch();
    }
  }, [subscription, refetch]);

  const getPlanInfo = (planId: string) => {
    const plans: Record<
      string,
      {
        name: string;
        icon: any;
        gradient: string;
        color: string;
        features: string[];
      }
    > = {
      starter: {
        name: t('plans.starter.name'),
        icon: TrendingUp,
        gradient: 'from-blue-500 to-blue-600',
        color: 'blue',
        features: [
          t('plans.starter.features.unlimitedViews'),
          t('plans.starter.features.submissions'),
          t('plans.starter.features.advancedAnalytics'),
          t('plans.starter.features.prioritySupport'),
        ],
      },
      advanced: {
        name: t('plans.advanced.name'),
        icon: Sparkles,
        gradient: 'from-purple-500 to-purple-600',
        color: 'purple',
        features: [
          t('plans.advanced.features.unlimitedViews'),
          t('plans.advanced.features.submissions'),
          t('plans.advanced.features.advancedAnalytics'),
          t('plans.advanced.features.prioritySupport'),
          t('plans.advanced.features.customIntegrations'),
          t('plans.advanced.features.whiteLabel'),
        ],
      },
    };

    return plans[planId] || plans['starter'];
  };

  const planInfo = subscription ? getPlanInfo(subscription.planId) : null;
  const Icon = planInfo?.icon || TrendingUp;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('loading.message')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      {/* Confetti Effect (simple CSS animation) */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      <Card className="max-w-2xl w-full p-8">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-25"></div>
            <div className="relative bg-green-100 dark:bg-green-900/30 rounded-full p-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>

        {/* Plan Details */}
        {planInfo && subscription && (
          <div className="mb-8">
            <div
              className={`bg-gradient-to-br ${planInfo.gradient} rounded-lg p-6 text-white mb-6`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  <Icon className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{planInfo.name}</h2>
                  <p className="text-white text-opacity-90">{t('planDetails.activated')}</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                {planInfo.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage Limits */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('usage.views')}
                </div>
                <div className="text-2xl font-bold">
                  {subscription.viewsLimit ? subscription.viewsLimit.toLocaleString() : t('usage.unlimited')}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t('usage.submissions')}
                </div>
                <div className="text-2xl font-bold">
                  {subscription.submissionsLimit
                    ? subscription.submissionsLimit.toLocaleString()
                    : t('usage.unlimited')}
                </div>
              </div>
            </div>

            {/* Billing Period */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>{t('billing.nextBilling')}</strong>{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => navigate('/dashboard')}
            className="flex-1"
            variant="default"
          >
            {t('buttons.goToDashboard')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            onClick={() => navigate('/settings/subscription')}
            variant="outline"
            className="flex-1"
          >
            {t('buttons.viewSubscription')}
          </Button>
        </div>

        {/* Additional Info */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {t('footer.receiptEmail')}
          </p>
        </div>
      </Card>

      {/* CSS for confetti animation */}
      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
          }
        }
        .animate-fall {
          animation: fall linear forwards;
        }
      `}</style>
    </div>
  );
};
