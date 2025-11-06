import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@dculus/ui';
import { XCircle, ArrowLeft, TrendingUp, HelpCircle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useState } from 'react';

export const CheckoutCancel = () => {
  const { t } = useTranslation('checkoutCancel');
  const navigate = useNavigate();
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        {/* Cancel Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4">
            <XCircle className="h-16 w-16 text-gray-600 dark:text-gray-400" />
          </div>
        </div>

        {/* Cancel Message */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('subtitle')}
          </p>
        </div>

        {/* Reason Cards */}
        <div className="mb-8 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  {t('reasons.needHelp.title')}
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  {t('reasons.needHelp.description')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open support chat or email
                    window.location.href = 'mailto:support@dculus.com';
                  }}
                  className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700"
                >
                  {t('reasons.needHelp.button')}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                  {t('reasons.comparePlans.title')}
                </h3>
                <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                  {t('reasons.comparePlans.description')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/pricing')}
                  className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700"
                >
                  {t('reasons.comparePlans.button')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* What You're Missing */}
        <div className="mb-8 p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <h3 className="font-bold text-lg mb-4 text-center">
            {t('benefits.title')}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <div className="bg-purple-600 rounded-full p-1 flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm">{t('benefits.items.unlimitedViews')}</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-purple-600 rounded-full p-1 flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm">{t('benefits.items.moreSubmissions')}</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-purple-600 rounded-full p-1 flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm">{t('benefits.items.advancedAnalytics')}</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-purple-600 rounded-full p-1 flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm">{t('benefits.items.prioritySupport')}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setShowUpgrade(true)}
            className="flex-1"
            variant="default"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            {t('buttons.tryAgain')}
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('buttons.backToDashboard')}
          </Button>
        </div>

        {/* Footer Note */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {t('footer.noCharge')}
            <br />
            {t('footer.flexible')}
          </p>
        </div>
      </Card>

      {/* Upgrade Modal Trigger */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md p-6 m-4">
            <h3 className="text-xl font-bold mb-4">{t('modal.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('modal.message')}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate('/settings/subscription')}
                className="flex-1"
              >
                {t('modal.buttons.viewPlans')}
              </Button>
              <Button
                onClick={() => setShowUpgrade(false)}
                variant="outline"
                className="flex-1"
              >
                {t('modal.buttons.cancel')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
