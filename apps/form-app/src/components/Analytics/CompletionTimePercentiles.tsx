import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import { CompletionTimePercentiles as PercentilesData } from '../../hooks/useFormAnalytics';
import { useTranslation } from '../../hooks/useTranslation';

interface CompletionTimePercentilesProps {
  data: PercentilesData | null;
  averageTime: number | null;
  loading?: boolean;
}

// Helper function to format completion time from seconds to human-readable format
const formatCompletionTime = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return 'N/A';
  
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
};

interface PercentileCardProps {
  label: string;
  value: number | null;
  description: string;
  color: string;
  bgColor: string;
}

const PercentileCard: React.FC<PercentileCardProps> = ({ label, value, description, color, bgColor }) => (
  <div className="rounded-xl p-4" style={{ backgroundColor: bgColor, border: '1px solid var(--tf-border-light)' }}>
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Clock className="h-4 w-4 opacity-50" style={{ color }} />
    </div>
    <p className="text-xl font-light" style={{ color }}>{formatCompletionTime(value)}</p>
    <p className="text-[10px] mt-1.5 text-muted-foreground">{description}</p>
  </div>
);

export const CompletionTimePercentiles: React.FC<CompletionTimePercentilesProps> = ({
  data,
  averageTime,
  loading = false
}) => {
  const { t } = useTranslation('completionTimePercentiles');
  
  if (loading) {
    return (
      <div className="rounded-xl p-5 bg-white" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        {/* Loading skeleton */}
        <div className="flex items-center gap-1.5 mb-4">
          <div className="h-4 w-4 rounded" style={{ backgroundColor: 'var(--tf-border-light)' }} />
          <div className="h-4 rounded w-40" style={{ backgroundColor: 'var(--tf-border-light)' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: 'var(--tf-faint)' }}>
              <div className="h-3 rounded w-16 mb-3" style={{ backgroundColor: 'var(--tf-border-light)' }} />
              <div className="h-5 rounded w-12 mb-2" style={{ backgroundColor: 'var(--tf-border-light)' }} />
              <div className="h-3 rounded w-20" style={{ backgroundColor: 'var(--tf-border-faint)' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data && !averageTime) {
    return (
      <div className="rounded-xl p-5 bg-white" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="text-center py-8 text-xs text-muted-foreground">{t('noData')}</div>
      </div>
    );
  }

  /* Typeform field-icon palette for percentile cards */
  const percentiles = [
    { label: t('average.label'), value: averageTime, description: t('average.description'), color: 'var(--tf-green)', bgColor: 'var(--tf-icon-teal)' },
    { label: t('p50.label'), value: data?.p50 || null, description: t('p50.description'), color: '#1d5fa8', bgColor: '#dbeafe' },
    { label: t('p75.label'), value: data?.p75 || null, description: t('p75.description'), color: '#8b6a18', bgColor: '#fbe19d' },
    { label: t('p90.label'), value: data?.p90 || null, description: t('p90.description'), color: '#5c2e6b', bgColor: 'var(--tf-icon-lavender)' },
    { label: t('p95.label'), value: data?.p95 || null, description: t('p95.description'), color: 'var(--tf-dark)', bgColor: 'var(--tf-icon-salmon)' },
  ];

  return (
    <div className="rounded-xl p-5 bg-white" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
      <div className="flex items-center gap-1.5 mb-4">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-primary">{t('title')}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {percentiles.map((p, i) => <PercentileCard key={i} {...p} />)}
      </div>

      {/* Insights */}
      {(averageTime || data) && (
        <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--tf-faint)' }}>
          <h4 className="text-xs font-medium mb-2 text-primary">{t('insights.title')}</h4>
          <div className="text-xs space-y-1 text-muted-foreground">
            {averageTime && data?.p50 && (
              <p>• {t('insights.medianVsAverage', { values: { median: formatCompletionTime(data.p50), comparison: averageTime > data.p50 ? t('insights.shorter') : t('insights.longer'), average: formatCompletionTime(averageTime) } })}</p>
            )}
            {data?.p90 && data?.p50 && (
              <p>• {t('insights.p90Insight', { values: { time: formatCompletionTime(data.p90) } })}</p>
            )}
            {data?.p95 && data?.p90 && (
              <p>• {t('insights.p95Insight', { values: { time: formatCompletionTime(data.p95) } })}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};