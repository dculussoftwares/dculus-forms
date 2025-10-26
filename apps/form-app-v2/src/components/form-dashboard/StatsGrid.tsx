import { Card, CardContent } from '@dculus/ui-v2';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Clock,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { useTranslate } from '../../i18n';

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

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor,
  iconColor,
  trend,
}: StatCardProps) => {
  return (
    <Card className="group relative overflow-hidden border border-border/70 transition-all duration-300 hover:border-primary/40 hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`${iconBgColor} rounded-xl p-3 transition-transform duration-300 group-hover:scale-110`}
          >
            <div className={iconColor}>{icon}</div>
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                trend.isPositive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {trend.isPositive ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export const StatsGrid = ({ stats }: StatsGridProps) => {
  const t = useTranslate();

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('formDashboard.stats.totalResponses.title')}
        value={stats.totalResponses}
        subtitle={t('formDashboard.stats.totalResponses.subtitle', {
          count: stats.responsesToday,
        })}
        icon={<FileText className="h-5 w-5" />}
        iconBgColor="bg-blue-50"
        iconColor="text-blue-600"
        trend={
          stats.responsesToday > 0 ? { value: 12, isPositive: true } : undefined
        }
      />

      <StatCard
        title={t('formDashboard.stats.responseRate.title')}
        value={stats.responseRate}
        subtitle={t('formDashboard.stats.responseRate.subtitle')}
        icon={<TrendingUp className="h-5 w-5" />}
        iconBgColor="bg-emerald-50"
        iconColor="text-emerald-600"
        trend={{ value: 8, isPositive: true }}
      />

      <StatCard
        title={t('formDashboard.stats.avgCompletionTime.title')}
        value={stats.averageCompletionTime}
        subtitle={t('formDashboard.stats.avgCompletionTime.subtitle')}
        icon={<Clock className="h-5 w-5" />}
        iconBgColor="bg-purple-50"
        iconColor="text-purple-600"
      />

      <StatCard
        title={t('formDashboard.stats.thisWeek.title')}
        value={stats.responsesThisWeek}
        subtitle={t('formDashboard.stats.thisWeek.subtitle')}
        icon={<Calendar className="h-5 w-5" />}
        iconBgColor="bg-orange-50"
        iconColor="text-orange-600"
        trend={{ value: 15, isPositive: true }}
      />
    </div>
  );
};
