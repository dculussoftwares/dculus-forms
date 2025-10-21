import { useQuery, useMutation } from '@apollo/client';
import { GET_SUBSCRIPTION, CREATE_PORTAL_SESSION } from '../../graphql/subscription';
import { Card, Button, Badge, toastSuccess, toastError } from '@dculus/ui';
import { CreditCard, TrendingUp, Eye, FileText, Calendar, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { UpgradeModal } from './UpgradeModal';
import { UsageChart } from './UsageChart';
import { PlanComparison } from './PlanComparison';

export const SubscriptionDashboard = () => {
  const { data, loading } = useQuery(GET_SUBSCRIPTION);
  const [createPortalSession, { loading: portalLoading }] = useMutation(CREATE_PORTAL_SESSION);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPlanComparison, setShowPlanComparison] = useState(false);

  const subscription = data?.activeOrganization?.subscription;

  const handleManageSubscription = async () => {
    try {
      const { data } = await createPortalSession();
      if (data?.createPortalSession?.url) {
        window.open(data.createPortalSession.url, '_blank');
        toastSuccess('Opening subscription portal', 'Manage your subscription in the new tab');
      }
    } catch (error: any) {
      toastError('Failed to open portal', error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading subscription...</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No subscription found</h3>
          <p className="text-gray-500 mb-4">
            Your organization doesn't have an active subscription.
          </p>
          <Button onClick={() => setShowUpgradeModal(true)}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Choose a Plan
          </Button>
        </div>
      </Card>
    );
  }

  const { planId, status, usage, currentPeriodStart, currentPeriodEnd } = subscription;

  // Format plan name
  const planName = planId.charAt(0).toUpperCase() + planId.slice(1);

  // Get plan badge color
  const getPlanBadgeColor = () => {
    if (planId === 'free') return 'bg-gray-100 text-gray-800';
    if (planId === 'starter') return 'bg-blue-100 text-blue-800';
    return 'bg-purple-100 text-purple-800';
  };

  // Get status badge color
  const getStatusBadgeColor = () => {
    if (status === 'active') return 'bg-green-100 text-green-800';
    if (status === 'cancelled') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  // Format usage text
  const formatUsage = (used: number, limit: number | null, unlimited: boolean) => {
    if (unlimited) return `${used.toLocaleString()} / Unlimited`;
    if (limit) return `${used.toLocaleString()} / ${limit.toLocaleString()}`;
    return used.toLocaleString();
  };

  // Get progress bar color based on percentage
  const getProgressColor = (percentage: number | null) => {
    if (!percentage) return 'bg-blue-500';
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    return 'bg-green-500';
  };

  // Calculate days remaining in billing period
  const getDaysRemaining = () => {
    const end = new Date(currentPeriodEnd);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const daysRemaining = getDaysRemaining();
  const showWarning = usage.views.exceeded || usage.submissions.exceeded;
  const showAlert = !showWarning && ((usage.views.percentage && usage.views.percentage >= 80) || (usage.submissions.percentage && usage.submissions.percentage >= 80));

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {showWarning && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 mb-1">
              Usage Limit Exceeded
            </p>
            <p className="text-sm text-red-700 mb-3">
              You've exceeded your plan limits. Upgrade now to restore access to your forms.
            </p>
            <Button
              size="sm"
              onClick={() => setShowUpgradeModal(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <TrendingUp className="h-3 w-3 mr-2" />
              Upgrade Plan
            </Button>
          </div>
        </div>
      )}

      {showAlert && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 mb-1">
              Approaching Usage Limits
            </p>
            <p className="text-sm text-orange-700">
              You're approaching your plan limits. Consider upgrading to avoid interruptions.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUpgradeModal(true)}
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            View Plans
          </Button>
        </div>
      )}

      {/* Current Plan Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{planName} Plan</h2>
            <Badge className={getPlanBadgeColor()}>{planName}</Badge>
            <Badge className={getStatusBadgeColor()}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
          <div className="flex gap-2">
            {planId !== 'advanced' && (
              <Button onClick={() => setShowUpgradeModal(true)}>
                <TrendingUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <>Processing...</>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Subscription
                  <ExternalLink className="h-3 w-3 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Views Card */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-sm">Form Views</span>
              </div>
              {usage.views.unlimited ? (
                <Badge className="bg-green-100 text-green-800 text-xs">Unlimited</Badge>
              ) : usage.views.exceeded ? (
                <Badge className="bg-red-100 text-red-800 text-xs">Exceeded</Badge>
              ) : (
                <span className="text-xs font-medium text-blue-600">
                  {usage.views.percentage?.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {usage.views.used.toLocaleString()}
            </div>
            {!usage.views.unlimited && (
              <div className="text-sm text-blue-700 dark:text-blue-300">
                of {usage.views.limit?.toLocaleString()} this period
              </div>
            )}
          </div>

          {/* Submissions Card */}
          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-sm">Form Submissions</span>
              </div>
              {usage.submissions.unlimited ? (
                <Badge className="bg-green-100 text-green-800 text-xs">Unlimited</Badge>
              ) : usage.submissions.exceeded ? (
                <Badge className="bg-red-100 text-red-800 text-xs">Exceeded</Badge>
              ) : (
                <span className="text-xs font-medium text-purple-600">
                  {usage.submissions.percentage?.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {usage.submissions.used.toLocaleString()}
            </div>
            {!usage.submissions.unlimited && (
              <div className="text-sm text-purple-700 dark:text-purple-300">
                of {usage.submissions.limit?.toLocaleString()} this period
              </div>
            )}
          </div>

          {/* Billing Period Card */}
          <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-sm">Billing Period</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {daysRemaining} days
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              remaining in current period
            </div>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Views Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Form Views</span>
              <span className="text-gray-600">
                {formatUsage(usage.views.used, usage.views.limit, usage.views.unlimited)}
              </span>
            </div>
            {!usage.views.unlimited && (
              <div className="space-y-1">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressColor(usage.views.percentage)}`}
                    style={{ width: `${Math.min(usage.views.percentage || 0, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{usage.views.percentage?.toFixed(1)}% used</span>
                  {usage.views.exceeded && (
                    <span className="text-red-600 font-medium">Limit exceeded!</span>
                  )}
                </div>
              </div>
            )}
            {usage.views.unlimited && (
              <p className="text-sm text-green-600">✓ Unlimited views</p>
            )}
          </div>

          {/* Submissions Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Form Submissions</span>
              <span className="text-gray-600">
                {formatUsage(
                  usage.submissions.used,
                  usage.submissions.limit,
                  usage.submissions.unlimited
                )}
              </span>
            </div>
            {!usage.submissions.unlimited && (
              <div className="space-y-1">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressColor(usage.submissions.percentage)}`}
                    style={{ width: `${Math.min(usage.submissions.percentage || 0, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{usage.submissions.percentage?.toFixed(1)}% used</span>
                  {usage.submissions.exceeded && (
                    <span className="text-red-600 font-medium">Limit exceeded!</span>
                  )}
                </div>
              </div>
            )}
            {usage.submissions.unlimited && (
              <p className="text-sm text-green-600">✓ Unlimited submissions</p>
            )}
          </div>
        </div>

        {/* Billing Period Details */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Current billing period</span>
            <span className="font-medium">
              {new Date(currentPeriodStart).toLocaleDateString()} -{' '}
              {new Date(currentPeriodEnd).toLocaleDateString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Usage Chart */}
      <UsageChart
        viewsUsed={usage.views.used}
        submissionsUsed={usage.submissions.used}
        viewsLimit={usage.views.limit}
        submissionsLimit={usage.submissions.limit}
        currentPeriodStart={currentPeriodStart}
        currentPeriodEnd={currentPeriodEnd}
      />

      {/* Plan Comparison */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Compare Plans</h3>
        <Button
          variant="outline"
          onClick={() => setShowPlanComparison(!showPlanComparison)}
        >
          {showPlanComparison ? 'Hide' : 'Show'} Plan Comparison
        </Button>
      </div>

      {showPlanComparison && <PlanComparison currentPlan={planId} />}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={planId}
        />
      )}
    </div>
  );
};
