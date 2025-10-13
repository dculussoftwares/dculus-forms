import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@dculus/ui';
import { Clock, TrendingUp } from 'lucide-react';
import { CompletionTimePercentiles as PercentilesData } from '../../hooks/useFormAnalytics';
import { useTranslation } from 'react-i18next';

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

const PercentileCard: React.FC<PercentileCardProps> = ({ 
  label, 
  value, 
  description, 
  color, 
  bgColor 
}) => (
  <div className={`${bgColor} rounded-lg p-4 border`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className={`text-lg font-bold ${color} mt-1`}>
          {formatCompletionTime(value)}
        </p>
      </div>
      <Clock className={`h-5 w-5 ${color} opacity-60`} />
    </div>
    <p className="text-xs text-gray-500 mt-2">{description}</p>
  </div>
);

export const CompletionTimePercentiles: React.FC<CompletionTimePercentilesProps> = ({
  data,
  averageTime,
  loading = false
}) => {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('analytics:completionTimeStatistics')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-gray-100 rounded-lg p-4 border">
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-12 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data && !averageTime) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('analytics:completionTimeStatistics')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            {t('analytics:noCompletionTimeData')}
          </div>
        </CardContent>
      </Card>
    );
  }

  const percentiles = [
    {
      label: t('analytics:average'),
      value: averageTime,
      description: t('analytics:meanCompletionTime'),
      color: 'text-blue-700',
      bgColor: 'bg-blue-50'
    },
    {
      label: t('analytics:percentile50'),
      value: data?.p50 || null,
      description: t('analytics:completeFaster50'),
      color: 'text-green-700',
      bgColor: 'bg-green-50'
    },
    {
      label: t('analytics:percentile75'),
      value: data?.p75 || null,
      description: t('analytics:completeFaster75'),
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50'
    },
    {
      label: t('analytics:percentile90'),
      value: data?.p90 || null,
      description: t('analytics:completeFaster90'),
      color: 'text-orange-700',
      bgColor: 'bg-orange-50'
    },
    {
      label: t('analytics:percentile95'),
      value: data?.p95 || null,
      description: t('analytics:completeFaster95'),
      color: 'text-red-700',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t('analytics:completionTimeStatistics')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {percentiles.map((percentile, index) => (
            <PercentileCard
              key={index}
              {...percentile}
            />
          ))}
        </div>
        
        {/* Insights */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">{t('analytics:insights')}</h4>
          <div className="text-sm text-gray-600 space-y-1">
            {averageTime && data?.p50 && (
              <p>
                • {t('analytics:medianCompletionTimeIs', {
                  median: formatCompletionTime(data.p50),
                  comparison: averageTime > data.p50 ? 'shorter' : 'longer',
                  average: formatCompletionTime(averageTime)
                })}
              </p>
            )}
            {data?.p90 && data?.p50 && (
              <p>
                • {t('analytics:ninetyPercentCompleteIn', { time: formatCompletionTime(data.p90) })}
              </p>
            )}
            {data?.p95 && data?.p90 && (
              <p>
                • {t('analytics:slowest5PercentTake', { time: formatCompletionTime(data.p95) })}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
