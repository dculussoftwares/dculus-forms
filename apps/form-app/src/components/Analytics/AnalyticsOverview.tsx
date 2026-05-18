import React from 'react';
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
      <div
        className="rounded-xl p-5 animate-pulse"
        style={{ backgroundColor: 'white', border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-3 rounded w-20" style={{ backgroundColor: 'var(--tf-border-light)' }} />
          <div className="h-9 w-9 rounded-xl" style={{ backgroundColor: 'var(--tf-border-faint)' }} />
        </div>
        <div className="h-7 rounded w-14 mb-2" style={{ backgroundColor: 'var(--tf-border-light)' }} />
        <div className="h-3 rounded w-24" style={{ backgroundColor: 'var(--tf-border-faint)' }} />
      </div>
    );
  }

  const displayValue = typeof value === 'number' ? value.toLocaleString() : value || '--';

  return (
    <div
      className="rounded-xl p-5 transition-shadow duration-200 hover:shadow-md"
      style={{ backgroundColor: 'white', border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {/* Typeform field-icon style — small square with colored bg */}
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBgColor }}
        >
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
      </div>

      {/* Typeform-style stat: light weight, large */}
      <p className="text-2xl font-light tracking-tight mb-1 text-primary">
        {displayValue}
      </p>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        {trend && (
          <div className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: trend.isPositive ? 'var(--tf-green)' : 'var(--tf-error)' }}>
            {trend.isPositive
              ? <TrendingUp className="h-3 w-3" />
              : <TrendingDown className="h-3 w-3" />
            }
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
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

  /* Typeform field-icon palette for metric icons */
  const metrics = [
    {
      title: t('overview.metrics.totalViews.title'),
      value: data?.totalViews || 0,
      subtitle: t('overview.metrics.totalViews.subtitle'),
      icon: Users,
      iconColor: 'var(--tf-green)',   /* teal */
      iconBgColor: 'var(--tf-icon-teal)',
    },
    {
      title: t('overview.metrics.totalSubmissions.title'),
      value: submissionData?.totalSubmissions || 0,
      subtitle: t('overview.metrics.totalSubmissions.subtitle', { values: { rate: submissionConversionRate } }),
      icon: FileCheck,
      iconColor: 'var(--tf-dark)',   /* salmon */
      iconBgColor: 'var(--tf-icon-salmon)',
    },
    {
      title: t('overview.metrics.viewSessions.title'),
      value: data?.uniqueSessions || 0,
      subtitle: t('overview.metrics.viewSessions.subtitle', { values: { rate: conversionRate } }),
      icon: Monitor,
      iconColor: '#5c2e6b',   /* lavender */
      iconBgColor: 'var(--tf-icon-lavender)',
    },
    {
      title: t('overview.metrics.submissionSessions.title'),
      value: submissionData?.uniqueSessions || 0,
      subtitle: t('overview.metrics.submissionSessions.subtitle'),
      icon: Target,
      iconColor: 'var(--tf-text)',   /* neutral gray */
      iconBgColor: 'var(--tf-icon-gray)',
    },
    {
      title: t('overview.metrics.topViewCountry.title'),
      value: topCountry?.name || t('overview.metrics.topViewCountry.unknown'),
      subtitle: topCountry
        ? t('overview.metrics.topViewCountry.subtitle', { values: { count: topCountry.count, percentage: topCountry.percentage.toFixed(1) } })
        : t('overview.metrics.topViewCountry.noData'),
      icon: Globe,
      iconColor: '#8b6a18',   /* yellow */
      iconBgColor: '#fbe19d',
    },
    {
      title: t('overview.metrics.topSubmissionCountry.title'),
      value: topSubmissionCountry?.name || t('overview.metrics.topSubmissionCountry.unknown'),
      subtitle: topSubmissionCountry
        ? t('overview.metrics.topSubmissionCountry.subtitle', { values: { count: topSubmissionCountry.count, percentage: topSubmissionCountry.percentage.toFixed(1) } })
        : t('overview.metrics.topSubmissionCountry.noData'),
      icon: Globe,
      iconColor: '#2d6236',   /* green */
      iconBgColor: '#c4e3ba',
    },
    {
      title: t('overview.metrics.avgCompletionTime.title'),
      value: formatCompletionTime(submissionData?.averageCompletionTime || null, t),
      subtitle: submissionData?.averageCompletionTime
        ? t('overview.metrics.avgCompletionTime.subtitle')
        : t('overview.metrics.avgCompletionTime.noData'),
      icon: Clock,
      iconColor: '#5c2e6b',   /* lavender */
      iconBgColor: 'var(--tf-icon-lavender)',
    },
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