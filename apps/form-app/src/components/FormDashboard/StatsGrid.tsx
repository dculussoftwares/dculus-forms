import React from 'react';
import {
  FileText,
  TrendingUp,
  Clock,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface DashboardStats {
  totalResponses: number;
  responseRate: string;
  averageCompletionTime: string;
  responsesToday: number;
  responsesThisWeek: number;
}

interface StatsGridProps {
  stats: DashboardStats;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor,
  iconColor,
  trend,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`${iconBgColor} p-2.5 rounded-xl`}>
          <div className={iconColor}>{icon}</div>
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
              trend.isPositive
                ? 'bg-primary/5 text-primary dark:bg-primary/20 dark:text-primary'
                : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
            }`}
          >
            {trend.isPositive ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )}
            {trend.label ?? `${Math.abs(trend.value)}%`}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-900 tracking-tight dark:text-slate-100">
        {value}
      </p>
      <p className="text-sm font-medium text-slate-600 mt-0.5 dark:text-slate-400">
        {title}
      </p>
      <p className="text-xs text-slate-400 mt-0.5 dark:text-slate-500">
        {subtitle}
      </p>
    </div>
  );
};

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  const { t } = useTranslation('formDashboard');

  const positiveTrend = (value: number) => ({
    value,
    isPositive: true,
    label: t('statsTrend.positive', { values: { value: Math.abs(value) } }),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('stats.totalResponses.title')}
        value={stats.totalResponses}
        subtitle={t('stats.totalResponses.subtitle', { values: { count: stats.responsesToday } })}
        icon={<FileText className="w-5 h-5" />}
        iconBgColor="bg-blue-50 dark:bg-blue-950"
        iconColor="text-blue-600 dark:text-blue-400"
        trend={stats.responsesToday > 0 ? positiveTrend(12) : undefined}
      />

      <StatCard
        title={t('stats.responseRate.title')}
        value={stats.responseRate}
        subtitle={t('stats.responseRate.subtitle')}
        icon={<TrendingUp className="w-5 h-5" />}
        iconBgColor="bg-primary/5 dark:bg-primary/10"
        iconColor="text-primary"
        trend={positiveTrend(8)}
      />

      <StatCard
        title={t('stats.averageCompletionTime.title')}
        value={stats.averageCompletionTime}
        subtitle={t('stats.averageCompletionTime.subtitle')}
        icon={<Clock className="w-5 h-5" />}
        iconBgColor="bg-purple-50 dark:bg-purple-950"
        iconColor="text-purple-600 dark:text-purple-400"
      />

      <StatCard
        title={t('stats.thisWeek.title')}
        value={stats.responsesThisWeek}
        subtitle={t('stats.thisWeek.subtitle')}
        icon={<Calendar className="w-5 h-5" />}
        iconBgColor="bg-orange-50 dark:bg-orange-950"
        iconColor="text-orange-600 dark:text-orange-400"
        trend={positiveTrend(15)}
      />
    </div>
  );
};
