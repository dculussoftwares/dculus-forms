import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { StatCard, CHART_COLORS } from './BaseChartComponents';
import { NumberFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { Calculator, TrendingUp, BarChart3, Target, Hash } from 'lucide-react';
import { MetricHelper, METRIC_HELPERS } from './MetricHelper';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from '../../../hooks/useTranslation';

interface NumberFieldAnalyticsProps {
  data: NumberFieldAnalyticsData;
  fieldLabel: string;
  totalResponses: number;
  loading?: boolean;
}

// Percentiles Chart Component
const PercentilesChart: React.FC<{
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  loading?: boolean;
}> = ({ percentiles, loading }) => {
  const { t } = useTranslation('numberFieldAnalytics');
  
  const data = useMemo(() => [
    { name: t('percentiles.25th'), value: percentiles.p25, label: t('percentiles.label25') },
    { name: t('percentiles.50thMedian'), value: percentiles.p50, label: t('percentiles.labelMedian') },
    { name: t('percentiles.75th'), value: percentiles.p75, label: t('percentiles.label75') },
    { name: t('percentiles.90th'), value: percentiles.p90, label: t('percentiles.label90') },
    { name: t('percentiles.95th'), value: percentiles.p95, label: t('percentiles.label95') },
  ], [percentiles, t]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('percentiles.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('percentiles.title')}</CardTitle>
          <MetricHelper {...METRIC_HELPERS.PERCENTILES} compact />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => {
            const percentage = ((item.value - percentiles.p25) / (percentiles.p95 - percentiles.p25)) * 100;
            const safePercentage = Math.max(0, Math.min(100, isNaN(percentage) ? 0 : percentage));
            
            return (
              <div key={item.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  <span className="text-sm font-bold text-gray-900">{item.value.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${safePercentage}%`,
                      backgroundColor: CHART_COLORS.primary[index % CHART_COLORS.primary.length]
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Box Plot Visualization
const BoxPlot: React.FC<{
  data: {
    min: number;
    max: number;
    median: number;
    percentiles: {
      p25: number;
      p50: number;
      p75: number;
    };
  };
  loading?: boolean;
}> = ({ data, loading }) => {
  const { t } = useTranslation('numberFieldAnalytics');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('boxPlot.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const range = data.max - data.min;
  const getPosition = (value: number) => {
    if (range === 0) return 50;
    return ((value - data.min) / range) * 100;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('boxPlot.title')}</CardTitle>
          <MetricHelper {...METRIC_HELPERS.STATISTICAL_SUMMARY} compact />
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-32 bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 rounded-lg p-4">
          {/* Scale */}
          <div className="flex justify-between text-xs text-gray-500 mb-4">
            <span>{data.min.toFixed(1)}</span>
            <span>{t('boxPlot.min')}</span>
            <span>{t('boxPlot.25percent')}</span>
            <span>{t('boxPlot.median')}</span>
            <span>{t('boxPlot.75percent')}</span>
            <span>{t('boxPlot.max')}</span>
            <span>{data.max.toFixed(1)}</span>
          </div>
          
          {/* Box plot visualization */}
          <div className="relative h-16">
            {/* Whiskers */}
            <div 
              className="absolute top-6 h-4 border-l-2 border-r-2 border-gray-400"
              style={{
                left: `${getPosition(data.min)}%`,
                width: `${getPosition(data.percentiles.p25) - getPosition(data.min)}%`
              }}
            />
            <div 
              className="absolute top-6 h-4 border-l-2 border-r-2 border-gray-400"
              style={{
                left: `${getPosition(data.percentiles.p75)}%`,
                width: `${getPosition(data.max) - getPosition(data.percentiles.p75)}%`
              }}
            />
            
            {/* Box */}
            <div 
              className="absolute top-4 h-8 bg-blue-200 border-2 border-blue-400 rounded"
              style={{
                left: `${getPosition(data.percentiles.p25)}%`,
                width: `${getPosition(data.percentiles.p75) - getPosition(data.percentiles.p25)}%`
              }}
            />
            
            {/* Median line */}
            <div 
              className="absolute top-4 h-8 w-0.5 bg-blue-800"
              style={{
                left: `${getPosition(data.median)}%`
              }}
            />
            
            {/* Value labels */}
            <div className="absolute bottom-0 w-full">
              <div 
                className="absolute text-xs text-center text-gray-700"
                style={{ left: `${getPosition(data.min)}%`, transform: 'translateX(-50%)' }}
              >
                {data.min.toFixed(1)}
              </div>
              <div 
                className="absolute text-xs text-center text-gray-700"
                style={{ left: `${getPosition(data.percentiles.p25)}%`, transform: 'translateX(-50%)' }}
              >
                {data.percentiles.p25.toFixed(1)}
              </div>
              <div 
                className="absolute text-xs text-center font-bold text-blue-800"
                style={{ left: `${getPosition(data.median)}%`, transform: 'translateX(-50%)' }}
              >
                {data.median.toFixed(1)}
              </div>
              <div 
                className="absolute text-xs text-center text-gray-700"
                style={{ left: `${getPosition(data.percentiles.p75)}%`, transform: 'translateX(-50%)' }}
              >
                {data.percentiles.p75.toFixed(1)}
              </div>
              <div 
                className="absolute text-xs text-center text-gray-700"
                style={{ left: `${getPosition(data.max)}%`, transform: 'translateX(-50%)' }}
              >
                {data.max.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600 space-y-1">
          <p>• {t('boxPlot.explanation1')}</p>
          <p>• {t('boxPlot.explanation2')}</p>
          <p>• {t('boxPlot.explanation3')}</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Trend Analysis Component
const TrendAnalysis: React.FC<{
  trend: Array<{ date: string; average: number; count: number }>;
  loading?: boolean;
}> = ({ trend, loading: _loading }) => {
  const { t, locale } = useTranslation('numberFieldAnalytics');
  
  const chartData = useMemo(() => {
    if (!trend || trend.length === 0) return [];
    
    return trend.map(item => ({
      name: new Date(item.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      value: parseFloat(item.average.toFixed(2)),
      count: item.count,
      fullDate: item.date
    }));
  }, [trend, locale]);

  if (!trend || trend.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('trend.title')}</CardTitle>
          <MetricHelper {...METRIC_HELPERS.TREND_ANALYSIS} compact />
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={CHART_COLORS.primary[2]} 
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.primary[2], strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export const NumberFieldAnalytics: React.FC<NumberFieldAnalyticsProps> = ({
  data,
  fieldLabel: _fieldLabel,
  totalResponses,
  loading
}) => {
  const { t } = useTranslation('numberFieldAnalytics');
  const { t: tCommon } = useTranslation('common');
  
  const distributionData = useMemo(() => {
    if (!data?.distribution) return [];
    return data.distribution.map(item => ({
      range: item.range,
      count: item.count,
      percentage: item.percentage
    }));
  }, [data?.distribution]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <StatCard 
              key={i}
              title={tCommon('loading')} 
              value="--" 
              loading={true} 
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
          <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">{t('emptyState.title')}</p>
          <p className="text-sm">{t('emptyState.subtitle')}</p>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (Math.abs(num) < 0.01 && num !== 0) {
      return num.toExponential(2);
    }
    return num.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title={t('stats.minimum')}
          value={formatNumber(data.min)}
          subtitle={t('stats.lowestValue')}
          icon={<Hash className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.average')}
          value={formatNumber(data.average)}
          subtitle={t('stats.meanValue')}
          icon={<Target className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.median')}
          value={formatNumber(data.median)}
          subtitle={t('stats.middleValue')}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.maximum')}
          value={formatNumber(data.max)}
          subtitle={t('stats.highestValue')}
          icon={<Hash className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.stdDev')}
          value={formatNumber(data.standardDeviation)}
          subtitle={t('stats.dataSpread')}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Main Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('valueDistribution.chartTitle')}</CardTitle>
              <MetricHelper {...METRIC_HELPERS.VALUE_DISTRIBUTION} compact />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_COLORS.primary[0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <BoxPlot 
          data={{
            min: data.min,
            max: data.max,
            median: data.median,
            percentiles: data.percentiles
          }}
        />
      </div>

      {/* Percentiles and Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PercentilesChart percentiles={data.percentiles} />
        {data.trend && data.trend.length > 1 && (
          <TrendAnalysis trend={data.trend} />
        )}
      </div>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('summary.title')}</CardTitle>
            <MetricHelper {...METRIC_HELPERS.STATISTICAL_SUMMARY} compact />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.centralTendency')}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.mean')}</span>
                  <span className="font-medium">{formatNumber(data.average)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.median')}</span>
                  <span className="font-medium">{formatNumber(data.median)}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.spread')}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.range')}</span>
                  <span className="font-medium">{formatNumber(data.max - data.min)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.stdDev')}</span>
                  <span className="font-medium">{formatNumber(data.standardDeviation)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.quartiles')}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.q1')}</span>
                  <span className="font-medium">{formatNumber(data.percentiles.p25)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.q3')}</span>
                  <span className="font-medium">{formatNumber(data.percentiles.p75)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.dataQuality')}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.responses')}</span>
                  <span className="font-medium">{totalResponses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.skewness')}</span>
                  <span className="font-medium">
                    {data.average > data.median ? t('summary.skewnessRight') : 
                     data.average < data.median ? t('summary.skewnessLeft') : t('summary.skewnessSymmetric')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};