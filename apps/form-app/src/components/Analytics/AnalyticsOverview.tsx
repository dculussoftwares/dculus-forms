import React from 'react';
import { Card } from '@dculus/ui';
import { Users, Monitor, Globe, TrendingUp, TrendingDown, FileCheck, Target, Clock } from 'lucide-react';
import { FormAnalyticsData, FormSubmissionAnalyticsData } from '../../hooks/useFormAnalytics';
import { useTranslation } from '../../hooks/useTranslation';

interface AnalyticsOverviewProps {
  data: FormAnalyticsData | null;
  submissionData: FormSubmissionAnalyticsData | null;
  conversionRate: number;
  submissionConversionRate: number;
  topCountry: any;
  topSubmissionCountry: any;
  loading?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  iconBgColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
}

// Helper function to format completion time from seconds to human-readable format
const formatCompletionTime = (seconds: number | null, t: (key: string, options?: any) => string): string => {
  if (!seconds || seconds <= 0) return t('overview.metrics.avgCompletionTime.notAvailable');
  
  if (seconds < 60) {
    return t('overview.metrics.avgCompletionTime.formatSeconds', { values: { seconds: Math.round(seconds) } });
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 
      ? t('overview.metrics.avgCompletionTime.formatMinutesSeconds', { values: { minutes, seconds: remainingSeconds } })
      : t('overview.metrics.avgCompletionTime.formatMinutes', { values: { minutes } });
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 
      ? t('overview.metrics.avgCompletionTime.formatHoursMinutes', { values: { hours, minutes } })
      : t('overview.metrics.avgCompletionTime.formatHours', { values: { hours } });
  }
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBgColor,
  trend,
  loading
}) => {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
            <div className={`h-12 w-12 ${iconBgColor} rounded-lg`}></div>
          </div>
          <div className="h-3 bg-gray-200 rounded w-24 mt-4"></div>
        </div>
      </Card>
    );
  }

  const displayValue = typeof value === 'number' 
    ? value.toLocaleString() 
    : value || '--';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{displayValue}</p>
        </div>
        <div className={`h-12 w-12 ${iconBgColor} rounded-lg flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-gray-500">{subtitle}</p>
        {trend && (
          <div className={`flex items-center text-xs ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </Card>
  );
};

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({
  data,
  submissionData,
  conversionRate,
  submissionConversionRate,
  topCountry,
  topSubmissionCountry,
  loading
}) => {
  const { t } = useTranslation('formAnalytics');

  const metrics = [
    {
      title: t('overview.metrics.totalViews.title'),
      value: data?.totalViews || 0,
      subtitle: t('overview.metrics.totalViews.subtitle'),
      icon: Users,
      iconColor: 'text-blue-600',
      iconBgColor: 'bg-blue-100',
      trend: undefined // TODO: Add trend calculation when we have historical data
    },
    {
      title: t('overview.metrics.totalSubmissions.title'),
      value: submissionData?.totalSubmissions || 0,
      subtitle: t('overview.metrics.totalSubmissions.subtitle', { values: { rate: submissionConversionRate } }),
      icon: FileCheck,
      iconColor: 'text-green-600',
      iconBgColor: 'bg-green-100'
    },
    {
      title: t('overview.metrics.viewSessions.title'),
      value: data?.uniqueSessions || 0,
      subtitle: t('overview.metrics.viewSessions.subtitle', { values: { rate: conversionRate } }),
      icon: Monitor,
      iconColor: 'text-purple-600',
      iconBgColor: 'bg-purple-100'
    },
    {
      title: t('overview.metrics.submissionSessions.title'),
      value: submissionData?.uniqueSessions || 0,
      subtitle: t('overview.metrics.submissionSessions.subtitle'),
      icon: Target,
      iconColor: 'text-indigo-600',
      iconBgColor: 'bg-indigo-100'
    },
    {
      title: t('overview.metrics.topViewCountry.title'),
      value: topCountry?.name || t('overview.metrics.topViewCountry.unknown'),
      subtitle: topCountry 
        ? t('overview.metrics.topViewCountry.subtitle', { 
            values: { 
              count: topCountry.count, 
              percentage: topCountry.percentage.toFixed(1) 
            } 
          })
        : t('overview.metrics.topViewCountry.noData'),
      icon: Globe,
      iconColor: 'text-orange-600',
      iconBgColor: 'bg-orange-100'
    },
    {
      title: t('overview.metrics.topSubmissionCountry.title'),
      value: topSubmissionCountry?.name || t('overview.metrics.topSubmissionCountry.unknown'),
      subtitle: topSubmissionCountry 
        ? t('overview.metrics.topSubmissionCountry.subtitle', { 
            values: { 
              count: topSubmissionCountry.count, 
              percentage: topSubmissionCountry.percentage.toFixed(1) 
            } 
          })
        : t('overview.metrics.topSubmissionCountry.noData'),
      icon: Globe,
      iconColor: 'text-red-600',
      iconBgColor: 'bg-red-100'
    },
    {
      title: t('overview.metrics.avgCompletionTime.title'),
      value: formatCompletionTime(submissionData?.averageCompletionTime || null, t),
      subtitle: submissionData?.averageCompletionTime 
        ? t('overview.metrics.avgCompletionTime.subtitle')
        : t('overview.metrics.avgCompletionTime.noData'),
      icon: Clock,
      iconColor: 'text-cyan-600',
      iconBgColor: 'bg-cyan-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {metrics.map((metric, index) => (
        <div key={index}>
          <MetricCard
            {...metric}
            loading={loading}
          />
        </div>
      ))}
    </div>
  );
};