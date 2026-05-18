import React from 'react';
import { FileText, TrendingUp, Clock, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
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
  iconBg: string;
  iconColor: string;
  trend?: { value: number; isPositive: boolean; label?: string };
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, iconBg, iconColor, trend }) => {
  return (
    <div
      className="bg-white dark:bg-card rounded-xl p-5 transition-all duration-200 cursor-default border border-[rgba(81,76,84,0.10)] shadow-[0_1px_4px_rgba(60,50,62,0.06)] hover:shadow-[0_4px_16px_rgba(60,50,62,0.10)]"
    >
      <div className="flex items-center justify-between mb-4">
        {/* Field-icon style — Typeform exact */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>

        {trend && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={trend.isPositive
              ? { backgroundColor: 'rgba(23,119,103,0.08)', color: '#177767' }
              : { backgroundColor: 'rgba(206,93,85,0.08)', color: '#ce5d55' }
            }
          >
            {trend.isPositive
              ? <ArrowUp className="w-3 h-3" />
              : <ArrowDown className="w-3 h-3" />
            }
            {trend.label ?? `${Math.abs(trend.value)}%`}
          </div>
        )}
      </div>

      <p className="text-2xl font-semibold tracking-tight text-[#3c323e]">
        {value}
      </p>
      <p className="text-sm font-medium mt-0.5 text-[#4c414e]">
        {title}
      </p>
      <p className="text-xs mt-0.5 text-[#655d67]">
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
      {/* Total Responses — salmon icon */}
      <StatCard
        title={t('stats.totalResponses.title')}
        value={stats.totalResponses}
        subtitle={t('stats.totalResponses.subtitle', { values: { count: stats.responsesToday } })}
        icon={<FileText className="w-4 h-4" />}
        iconBg="#f8cdd8"
        iconColor="#3c323e"
        trend={stats.responsesToday > 0 ? positiveTrend(12) : undefined}
      />

      {/* Response Rate — teal icon */}
      <StatCard
        title={t('stats.responseRate.title')}
        value={stats.responseRate}
        subtitle={t('stats.responseRate.subtitle')}
        icon={<TrendingUp className="w-4 h-4" />}
        iconBg="#f4faf8"
        iconColor="#177767"
        trend={positiveTrend(8)}
      />

      {/* Avg Completion Time — lavender icon */}
      <StatCard
        title={t('stats.averageCompletionTime.title')}
        value={stats.averageCompletionTime}
        subtitle={t('stats.averageCompletionTime.subtitle')}
        icon={<Clock className="w-4 h-4" />}
        iconBg="#ddd6fa"
        iconColor="#5c2e6b"
      />

      {/* This Week — gray icon */}
      <StatCard
        title={t('stats.thisWeek.title')}
        value={stats.responsesThisWeek}
        subtitle={t('stats.thisWeek.subtitle')}
        icon={<Calendar className="w-4 h-4" />}
        iconBg="#dedcde"
        iconColor="#4c414e"
        trend={positiveTrend(15)}
      />
    </div>
  );
};
