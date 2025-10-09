import React from 'react';
import {
  FileText,
  TrendingUp,
  Clock,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

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
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-lg" />
      <div className="relative bg-white rounded-2xl p-6 border border-slate-200 transition-all duration-300 group-hover:border-slate-300">
        <div className="flex items-start justify-between mb-4">
          <div className={`${iconBgColor} p-3 rounded-xl`}>
            <div className={iconColor}>
              {icon}
            </div>
          </div>
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
              trend.isPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {trend.isPositive ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-600">
            {title}
          </p>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">
            {value}
          </p>
          <p className="text-xs text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
};

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Responses"
        value={stats.totalResponses}
        subtitle={`+${stats.responsesToday} from today`}
        icon={<FileText className="w-5 h-5" />}
        iconBgColor="bg-blue-50"
        iconColor="text-blue-600"
        trend={stats.responsesToday > 0 ? { value: 12, isPositive: true } : undefined}
      />

      <StatCard
        title="Response Rate"
        value={stats.responseRate}
        subtitle="Views converted to responses"
        icon={<TrendingUp className="w-5 h-5" />}
        iconBgColor="bg-emerald-50"
        iconColor="text-emerald-600"
        trend={{ value: 8, isPositive: true }}
      />

      <StatCard
        title="Avg. Completion Time"
        value={stats.averageCompletionTime}
        subtitle="Average time to complete"
        icon={<Clock className="w-5 h-5" />}
        iconBgColor="bg-purple-50"
        iconColor="text-purple-600"
      />

      <StatCard
        title="This Week"
        value={stats.responsesThisWeek}
        subtitle="Responses this week"
        icon={<Calendar className="w-5 h-5" />}
        iconBgColor="bg-orange-50"
        iconColor="text-orange-600"
        trend={{ value: 15, isPositive: true }}
      />
    </div>
  );
};