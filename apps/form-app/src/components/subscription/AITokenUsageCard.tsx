import { useQuery } from '@apollo/client';
import { Sparkles, TrendingUp } from 'lucide-react';
import { Card, Button } from '@dculus/ui';
import { useState } from 'react';
import { GET_AI_TOKEN_USAGE } from '../../graphql/subscription';
import { UpgradeModal } from './UpgradeModal';
import { useTranslation } from '../../hooks/useTranslation';

interface AITokenUsageCardProps {
  organizationId: string;
  currentPlan: string;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-500';
  if (percentage >= 80) return 'bg-orange-500';
  return 'bg-amber-500';
}

export function AITokenUsageCard({ organizationId, currentPlan }: AITokenUsageCardProps) {
  const { t } = useTranslation('subscriptionDashboard');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data, loading } = useQuery(GET_AI_TOKEN_USAGE, {
    variables: { organizationId },
    skip: !organizationId,
  });

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="h-2 w-full rounded bg-muted" />
        </div>
      </Card>
    );
  }

  if (!data?.aiTokenUsage) return null;

  const { used, limit, resetAt } = data.aiTokenUsage;
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const limitReached = used >= limit;
  const resetDate = new Date(resetAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold">{t('aiTokens.title')}</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {t('aiTokens.resetsOn', { values: { date: resetDate } })}
          </span>
        </div>

        {/* Limit-reached warning */}
        {limitReached && (
          <div className="flex items-start justify-between gap-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-700 dark:text-red-400">
              {t('aiTokens.limitReached')}
            </p>
            <Button
              size="sm"
              onClick={() => setShowUpgradeModal(true)}
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {t('aiTokens.upgradePlan')}
            </Button>
          </div>
        )}

        {/* Token count */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-2xl font-bold">{used.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">
              {t('aiTokens.used', {
                values: {
                  used: used.toLocaleString(),
                  limit: limit.toLocaleString(),
                },
              })}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${getProgressColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {t('aiTokens.percentageUsed', { values: { percentage: percentage.toFixed(1) } })}
          </p>
        </div>
      </div>

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={currentPlan}
        />
      )}
    </Card>
  );
}
