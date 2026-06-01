// apps/form-app/src/components/form-builder/AITokenMeter.tsx
import React from 'react';
import { useQuery } from '@apollo/client';
import { cn } from '@dculus/utils';
import { AI_TOKEN_USAGE } from '../../graphql/aiChat';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  organizationId: string;
}

const AITokenMeter: React.FC<Props> = ({ organizationId }) => {
  const { t } = useTranslation('aiEditDrawer');
  const { data } = useQuery(AI_TOKEN_USAGE, {
    variables: { organizationId },
    pollInterval: 30_000,
    fetchPolicy: 'cache-and-network',
  });

  const usage = data?.aiTokenUsage;
  if (!usage) return null;

  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const resetDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(usage.resetAt)
  );

  const barColor =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-green-500';
  const textColor =
    pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <div className="border-t border-border px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{t('tokenMeter.label')}</span>
        <span className={cn('text-xs font-medium', textColor)}>
          {(usage.used / 1000).toFixed(0)}k / {(usage.limit / 1000).toFixed(0)}k
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className={cn('text-xs', textColor)}>
          {t('tokenMeter.used', { values: { percent: pct } })}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('tokenMeter.resets', { values: { date: resetDate } })}
        </span>
      </div>
      {pct >= 100 && (
        <p className="mt-1 text-xs text-red-600">
          {t('tokenMeter.limitReached')}{' '}
          <a href="/pricing" className="underline">{t('tokenMeter.upgrade')}</a>
        </p>
      )}
    </div>
  );
};

export default AITokenMeter;
