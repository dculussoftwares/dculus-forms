import React from 'react';
import { Card } from '@dculus/ui';
import { Users, Monitor, Globe, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { FormAnalyticsData } from '../../hooks/useFormAnalytics';

interface AnalyticsOverviewProps {
  data: FormAnalyticsData | null;
  conversionRate: number;
  topCountry: any;
  topBrowser: any;
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
  conversionRate,
  topCountry,
  topBrowser,
  loading
}) => {
  const metrics = [
    {
      title: 'Total Views',
      value: data?.totalViews || 0,
      subtitle: 'Total form impressions',
      icon: Users,
      iconColor: 'text-blue-600',
      iconBgColor: 'bg-blue-100',
      trend: undefined // TODO: Add trend calculation when we have historical data
    },
    {
      title: 'Unique Sessions',
      value: data?.uniqueSessions || 0,
      subtitle: `${conversionRate}% session rate`,
      icon: Monitor,
      iconColor: 'text-green-600',
      iconBgColor: 'bg-green-100'
    },
    {
      title: 'Top Country',
      value: topCountry?.name || 'Unknown',
      subtitle: topCountry 
        ? `${topCountry.count} views (${topCountry.percentage.toFixed(1)}%)`
        : 'No data available',
      icon: Globe,
      iconColor: 'text-purple-600',
      iconBgColor: 'bg-purple-100'
    },
    {
      title: 'Top Browser',
      value: topBrowser?.name || 'Unknown',
      subtitle: topBrowser 
        ? `${topBrowser.count} views (${topBrowser.percentage.toFixed(1)}%)`
        : 'No data available',
      icon: BarChart3,
      iconColor: 'text-orange-600',
      iconBgColor: 'bg-orange-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          {...metric}
          loading={loading}
        />
      ))}
    </div>
  );
};