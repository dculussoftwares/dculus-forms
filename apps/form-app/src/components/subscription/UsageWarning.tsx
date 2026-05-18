import { AlertCircle, TrendingUp, X } from 'lucide-react';
import { Button, Card } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { useState } from 'react';

interface UsageWarningProps {
  type: 'views' | 'submissions';
  used: number;
  limit: number;
  percentage: number;
  exceeded: boolean;
  onUpgrade: () => void;
  dismissible?: boolean;
}

export const UsageWarning = ({
  type,
  used,
  limit,
  percentage,
  exceeded,
  onUpgrade,
  dismissible = true,
}: UsageWarningProps) => {
  const { t } = useTranslation('usageWarning');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Only show warning if >= 80% or exceeded
  if (percentage < 80 && !exceeded) return null;

  // Determine severity level
  const isError = exceeded;

  // Color scheme based on severity
  const bgColor = isError
    ? 'bg-[var(--tf-error-bg)] dark:bg-red-900/20'
    : 'bg-orange-50 dark:bg-orange-900/20';
  const borderColor = isError
    ? 'border-[var(--tf-error-bg-lg)] dark:border-red-800'
    : 'border-orange-200 dark:border-orange-800';
  const textColor = isError
    ? 'text-destructive dark:text-red-200'
    : 'text-orange-800 dark:text-orange-200';
  const iconColor = isError
    ? 'text-destructive dark:text-red-400'
    : 'text-orange-600 dark:text-orange-400';

  const resourceType = type === 'views' ? t('resource.views') : t('resource.submissions');

  return (
    <Card
      className={cn(bgColor, borderColor, 'border p-4 mb-4 transition-all')}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconColor)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className={cn('font-semibold', textColor)}>
              {exceeded
                ? t('title.exceeded', { values: { resourceType } })
                : t('title.approaching', { values: { resourceType } })}
            </h3>
            {dismissible && (
              <Button
                variant="ghost"
                onClick={() => setDismissed(true)}
                className={cn('h-6 w-6 p-0 hover:bg-transparent', textColor)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className={cn('text-sm mb-3', textColor)}>
            {exceeded
              ? t('message.exceeded', {
                  values: { used, limit, resourceType: resourceType.toLowerCase() },
                })
              : t('message.approaching', {
                  values: {
                    used,
                    limit,
                    percentage: Math.round(percentage),
                    resourceType: resourceType.toLowerCase(),
                  },
                })}
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
            <div
              className={cn('h-2 rounded-full transition-all', isError ? 'bg-red-600' : 'bg-orange-500')}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>

          {/* Action Button */}
          <Button
            onClick={onUpgrade}
            className={cn(isError ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white')}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {exceeded ? t('buttons.upgradeNow') : t('buttons.upgradePlan')}
          </Button>
        </div>
      </div>
    </Card>
  );
};
