import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { StatCard, EnhancedPieChart, CHART_COLORS } from './BaseChartComponents';
import { SelectionFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { CheckCircle, BarChart2, Target, Crown } from 'lucide-react';
import { MetricHelper, METRIC_HELPERS } from './MetricHelper';
import { useTranslation } from '../../../hooks/useTranslation';

interface SelectionFieldAnalyticsProps {
  data: SelectionFieldAnalyticsData;
  fieldLabel: string;
  fieldType: 'select' | 'radio';
  totalResponses: number;
  loading?: boolean;
}

// Response Distribution Indicator
const DistributionIndicator: React.FC<{
  distributionType: string;
  options: Array<{ option: string; count: number; percentage: number }>;
}> = ({ distributionType, options }) => {
  const { t } = useTranslation('selectionFieldAnalytics');
  
  const getDistributionColor = (type: string) => {
    switch (type) {
      case 'concentrated': return 'bg-red-100 text-red-800';
      case 'even': return 'bg-green-100 text-green-800';
      case 'polarized': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDistributionDescription = (type: string) => {
    switch (type) {
      case 'concentrated':
        return t('distributionDescriptions.concentrated', { 
          values: { percentage: options[0]?.percentage.toFixed(1) } 
        });
      case 'even':
        return t('distributionDescriptions.even');
      case 'polarized':
        return t('distributionDescriptions.polarized');
      default:
        return t('distributionDescriptions.unavailable');
    }
  };

  const getDistributionIcon = (type: string) => {
    switch (type) {
      case 'concentrated': return '🎯';
      case 'even': return '⚖️';
      case 'polarized': return '🔀';
      default: return '📊';
    }
  };

  return (
    <div className={`p-4 rounded-lg ${getDistributionColor(distributionType)}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{getDistributionIcon(distributionType)}</span>
        <div>
          <h4 className="font-semibold capitalize">
            {distributionType} Distribution
          </h4>
          <p className="text-sm opacity-90">
            {getDistributionDescription(distributionType)}
          </p>
        </div>
      </div>
    </div>
  );
};

// Option Performance Table
const OptionPerformanceTable: React.FC<{
  options: Array<{ option: string; count: number; percentage: number }>;
  topOption: string;
  t: (key: string, options?: { values?: Record<string, any> }) => string;
}> = ({ options, topOption, t }) => {
  if (!options || options.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('optionPerformance.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            {t('emptyState.title')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('optionPerformance.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {options.map((option, index) => {
            const isTopOption = option.option === topOption;
            const isLowPerforming = option.percentage < 10;
            
            return (
              <div 
                key={option.option}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors
                  ${isTopOption ? 'bg-green-50 border-green-200' : 
                    isLowPerforming ? 'bg-red-50 border-red-200' : 
                    'bg-gray-50 border-gray-200'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                      ${isTopOption ? 'bg-green-500 text-white' : 
                        isLowPerforming ? 'bg-red-500 text-white' : 
                        'bg-gray-500 text-white'
                      }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {option.option}
                      </span>
                      {isTopOption && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {t('optionPerformance.responses', { values: { count: option.count } })}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {option.percentage.toFixed(1)}%
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500
                        ${isTopOption ? 'bg-green-500' : 
                          isLowPerforming ? 'bg-red-500' : 
                          'bg-blue-500'
                        }`}
                      style={{ width: `${Math.max(5, option.percentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {options.length > 5 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            {t('optionPerformance.showingAll', { values: { count: options.length } })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Selection Trend Over Time
const SelectionTrend: React.FC<{
  trend: Array<{ date: string; options: Array<{ option: string; count: number }> }>;
  topOptions: string[];
  loading?: boolean;
}> = ({ trend, topOptions, loading }) => {
  const { t, locale } = useTranslation('selectionFieldAnalytics');
  
  const chartData = useMemo(() => {
    if (!trend || trend.length === 0) return [];
    
    return trend.map(item => {
      const date = new Date(item.date).toLocaleDateString(locale, { 
        month: 'short', 
        day: 'numeric' 
      });
      
      // Create data point with top options
      const dataPoint: any = { name: date, fullDate: item.date };
      
      topOptions.slice(0, 5).forEach(optionName => {
        const option = item.options.find(o => o.option === optionName);
        dataPoint[optionName] = option ? option.count : 0;
      });
      
      return dataPoint;
    });
  }, [trend, topOptions, locale]);

  if (!trend || trend.length <= 1) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('trendsOverTime.title')}</CardTitle>
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
        <CardTitle>{t('trendsOverTime.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              {topOptions.slice(0, 5).map((option, index) => (
                <Line 
                  key={option}
                  type="monotone" 
                  dataKey={option} 
                  stroke={CHART_COLORS.primary[index % CHART_COLORS.primary.length]}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.primary[index % CHART_COLORS.primary.length], strokeWidth: 2, r: 4 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>• Shows selection counts over time for the top 5 most popular options</p>
          <p>• Each line represents one option's popularity trend</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Quick Insights Component
const QuickInsights: React.FC<{
  data: SelectionFieldAnalyticsData;
  totalFormResponses: number;
  t: (key: string, options?: { values?: Record<string, any> }) => string;
}> = ({ data, totalFormResponses, t }) => {
  const insights = useMemo(() => {
    const results = [];
    
    if (data.options.length > 0) {
      const topOption = data.options[0];
      const responseRate = totalFormResponses > 0 ? (data.options.reduce((sum, opt) => sum + opt.count, 0) / totalFormResponses) * 100 : 0;
      
      results.push({
        icon: '👑',
        title: t('quickInsights.mostPopular'),
        value: topOption.option,
        subtitle: t('quickInsights.ofResponses', { values: { percentage: topOption.percentage.toFixed(1) } })
      });
      
      if (data.options.length >= 2) {
        const secondOption = data.options[1];
        const gap = topOption.percentage - secondOption.percentage;
        results.push({
          icon: gap > 20 ? '📏' : '⚔️',
          title: gap > 20 ? t('quickInsights.clearWinner') : t('quickInsights.closeCompetition'),
          value: `${gap.toFixed(1)}%`,
          subtitle: gap > 20 ? t('quickInsights.marginAhead') : t('quickInsights.differenceBetweenTopOptions')
        });
      }
      
      results.push({
        icon: '📊',
        title: t('quickInsights.responseRate'),
        value: `${responseRate.toFixed(1)}%`,
        subtitle: t('quickInsights.ofFormSubmissions')
      });
      
      const lowPerformingOptions = data.options.filter(opt => opt.percentage < 5);
      if (lowPerformingOptions.length > 0) {
        results.push({
          icon: '⚠️',
          title: t('quickInsights.lowPerforming'),
          value: lowPerformingOptions.length.toString(),
          subtitle: lowPerformingOptions.length !== 1 ? t('quickInsights.optionsUnder5') : t('quickInsights.optionUnder5')
        });
      }
    }
    
    return results;
  }, [data, totalFormResponses, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('quickInsights.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {insights.map((insight, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-2xl">{insight.icon}</span>
              <div>
                <div className="font-semibold text-gray-900">{insight.title}</div>
                <div className="text-lg font-bold text-blue-600">{insight.value}</div>
                <div className="text-sm text-gray-600">{insight.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const SelectionFieldAnalytics: React.FC<SelectionFieldAnalyticsProps> = ({
  data,
  fieldLabel: _fieldLabel,
  fieldType,
  totalResponses,
  loading
}) => {
  const { t } = useTranslation('selectionFieldAnalytics');
  const { t: tCommon } = useTranslation('common');
  
  const pieChartData = useMemo(() => {
    if (!data?.options) return [];
    return data.options.map(option => ({
      name: option.option.length > 20 ? `${option.option.substring(0, 20)}...` : option.option,
      value: option.count,
      percentage: option.percentage,
      fullName: option.option
    }));
  }, [data?.options]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatCard 
              key={i}
              title={tCommon('loading')} 
              value="--" 
              loading={true} 
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="animate-pulse h-96 bg-gray-200 rounded"></div>
          <div className="animate-pulse h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data || !data.options || data.options.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">{t('emptyState.title')}</p>
          <p className="text-sm">{t('emptyState.subtitle', { values: { fieldType } })}</p>
        </div>
      </div>
    );
  }

  const totalSelections = data.options.reduce((sum, opt) => sum + opt.count, 0);
  const mostPopularOption = data.options[0];
  const leastPopularOption = data.options[data.options.length - 1];
  const averagePercentage = 100 / data.options.length;

  return (
    <div className="space-y-6">
      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('distribution.totalSelections')}
          value={totalSelections}
          subtitle={t('distribution.fromResponses', { values: { count: totalResponses } })}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatCard
          title={t('distribution.availableOptions')}
          value={data.options.length}
          subtitle={t('distribution.choicesProvided')}
          icon={<BarChart2 className="h-5 w-5" />}
        />
        <StatCard
          title={t('topChoices.topOption')}
          value={`${mostPopularOption.percentage.toFixed(1)}%`}
          subtitle={mostPopularOption.option.length > 20 ? 
            `${mostPopularOption.option.substring(0, 20)}...` : 
            mostPopularOption.option
          }
          icon={<Crown className="h-5 w-5" />}
        />
        <StatCard
          title={t('distribution.selectionRate')}
          value={`${((totalSelections / Math.max(totalResponses, 1)) * 100).toFixed(1)}%`}
          subtitle={t('distribution.completionRate')}
          icon={<Target className="h-5 w-5" />}
        />
      </div>

      {/* Distribution Analysis */}
      <DistributionIndicator 
        distributionType={data.responseDistribution}
        options={data.options}
      />

      {/* Main Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.RESPONSE_DISTRIBUTION} compact />
          <EnhancedPieChart
            data={pieChartData}
            title={t('pieChart.title', { values: { fieldType: fieldType === 'select' ? t('pieChart.selection') : t('pieChart.choice') } })}
            height={350}
          />
        </div>
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.OPTION_POPULARITY} compact />
          <Card>
            <CardHeader>
              <CardTitle>{t('distribution.optionPopularity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={data.options.map(option => ({
                    name: option.option.length > 15 ? `${option.option.substring(0, 15)}...` : option.option,
                    value: option.count,
                    fullName: option.option,
                    percentage: option.percentage
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    label={{ value: t('distribution.numberOfSelections'), angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ active, payload, label: _label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg border-gray-200">
                            <p className="font-medium text-gray-900 mb-2" title={data.fullName}>
                              {data.fullName}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-3 h-3 rounded-full bg-blue-600" />
                              <span className="text-gray-700">
                                {t('distribution.selectionsCount', { values: { count: data.value, percentage: data.percentage.toFixed(1) } })}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.options.map((_entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? CHART_COLORS.primary[1] : CHART_COLORS.primary[0]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OptionPerformanceTable 
          options={data.options}
          topOption={data.topOption}
          t={t}
        />
        <QuickInsights 
          data={data}
          totalFormResponses={totalResponses}
          t={t}
        />
      </div>

      {/* Trend Analysis (if available) */}
      {data.trend && data.trend.length > 1 && (
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.SELECTION_TRENDS} compact />
          <SelectionTrend 
            trend={data.trend}
            topOptions={data.options.slice(0, 5).map(opt => opt.option)}
          />
        </div>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>{t('insights.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('insights.popularChoices')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('insights.mostPopular')}</span>
                  <span className="font-medium">{mostPopularOption.percentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('insights.leastPopular')}</span>
                  <span className="font-medium">{leastPopularOption.percentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('insights.distribution')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('insights.type')}</span>
                  <span className="font-medium capitalize">
                    {data.responseDistribution === 'balanced' ? t('insights.balanced') : t('insights.skewed')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('distribution.title')}</span>
                  <span className="font-medium">{averagePercentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('insights.performance')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('insights.optionsUsed')}</span>
                  <span className="font-medium">{data.options.filter(opt => opt.count > 0).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('insights.unusedOptions')}</span>
                  <span className="font-medium">{data.options.filter(opt => opt.count === 0).length}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('insights.title')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('topChoices.leastPopular')}</span>
                  <span className="font-medium">{data.options.filter(opt => opt.percentage < 5).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('insights.competitionLevel')}</span>
                  <span className="font-medium">
                    {data.responseDistribution === 'concentrated' ? t('insights.low') : 
                     data.responseDistribution === 'even' ? t('insights.high') : t('insights.medium')}
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