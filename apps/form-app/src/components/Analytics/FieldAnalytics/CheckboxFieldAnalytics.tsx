import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { StatCard, FieldAnalyticsLoader, FieldAnalyticsEmpty } from './BaseChartComponents';
import { CheckboxFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { CheckSquare, Link, BarChart3, TrendingUp } from 'lucide-react';
import { MetricHelper, METRIC_HELPERS } from './MetricHelper';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTranslation } from '../../../hooks/useTranslation';

interface CheckboxFieldAnalyticsProps {
  data: CheckboxFieldAnalyticsData;
  fieldLabel: string;
  totalResponses: number;
  loading?: boolean;
}

// Correlation Matrix Visualization
const CorrelationMatrix: React.FC<{
  correlations: Array<{ option1: string; option2: string; correlation: number }>;
  options: string[];
  loading?: boolean;
}> = ({ correlations, options: _options, loading }) => {
  const { t } = useTranslation('checkboxFieldAnalytics');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('correlations.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-[#ebe9ec] rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!correlations || correlations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('correlations.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {t('correlations.noSignificantCorrelations')}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCorrelationColor = (correlation: number) => {
    if (correlation >= 2.0) return 'bg-primary';
    if (correlation >= 1.5) return 'bg-yellow-500';
    return 'bg-[#ede9fe]0';
  };

  const getCorrelationDescription = (correlation: number) => {
    if (correlation >= 2.0) return t('correlations.strength.veryStrong');
    if (correlation >= 1.5) return t('correlations.strength.strong');
    return t('correlations.strength.moderate');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('correlations.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {correlations.slice(0, 10).map((corr, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div className="flex items-center gap-3">
                <div 
                  className={`w-3 h-3 rounded-full ${getCorrelationColor(corr.correlation)}`}
                />
                <div>
                  <div className="font-medium text-primary">
                    "{corr.option1}" ↔ "{corr.option2}"
                  </div>
                  <div className="text-sm text-foreground">
                    {getCorrelationDescription(corr.correlation)} {t('correlations.correlation')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">
                  {corr.correlation.toFixed(1)}x
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('correlations.moreLikelyTogether')}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-[#ede9fe] rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">{t('correlations.understandingTitle')}</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• {t('correlations.strongDescription')}</p>
            <p>• {t('correlations.moderateDescription')}</p>
            <p>• {t('correlations.weakDescription')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Popular Combinations Analysis
const PopularCombinations: React.FC<{
  combinations: Array<{ combination: string[]; count: number; percentage: number }>;
  loading?: boolean;
}> = ({ combinations, loading }) => {
  const { t } = useTranslation('checkboxFieldAnalytics');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('combinations.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-[#ebe9ec] rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!combinations || combinations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('combinations.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {t('combinations.noCombinationData')}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getComboColor = (percentage: number) => {
    if (percentage >= 20) return 'border-primary/30 bg-primary/5';
    if (percentage >= 10) return 'border-yellow-300 bg-yellow-50';
    return 'border-[#c4b5fd] bg-[#ede9fe]';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('combinations.mostPopularTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {combinations.slice(0, 10).map((combo, index) => (
            <div 
              key={index}
              className={`border-2 rounded-lg p-4 ${getComboColor(combo.percentage)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-6 h-6 bg-white rounded-full text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-foreground">
                      {combo.combination.length} {combo.combination.length !== 1 ? t('combinations.options') : t('combinations.option')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {combo.combination.map((option, optIndex) => (
                      <span 
                        key={optIndex}
                        className="inline-flex items-center px-2 py-1 bg-white rounded-lg text-xs font-medium text-foreground border"
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <div className="text-lg font-bold text-primary">
                    {combo.percentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-foreground">
                    {combo.count} {t('combinations.times')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {combinations.length > 10 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {t('combinations.showingTopOf', { values: { total: combinations.length } })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Selection Count Distribution
const SelectionDistribution: React.FC<{
  distribution: Array<{ selectionCount: number; responseCount: number; percentage: number }>;
  averageSelections: number;
  loading?: boolean;
}> = ({ distribution, averageSelections, loading }) => {
  const { t } = useTranslation('checkboxFieldAnalytics');
  
  const chartData = useMemo(() => {
    if (!distribution) return [];
    return distribution.map(item => ({
      name: `${item.selectionCount} ${item.selectionCount !== 1 ? t('combinations.options') : t('combinations.option')}`,
      value: item.responseCount,
      percentage: item.percentage,
      selectionCount: item.selectionCount
    }));
  }, [distribution, t]);

  if (loading || !distribution || distribution.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('selectionDistribution.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
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
                label={{ value: t('selectionDistribution.numberOfResponses'), angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isAverage = Math.abs(data.selectionCount - averageSelections) < 0.5;
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg border-[var(--tf-border-medium)]">
                        <p className="font-medium text-primary mb-2">{label}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full bg-blue-600" />
                          <span className="text-foreground">
                            {t('selectionCount.responses')}: {data.value} ({data.percentage.toFixed(1)}%)
                          </span>
                          {isAverage && (
                            <span className="text-xs text-[#7C3AAE] font-medium bg-[#ede9fe] px-1 rounded">
                              {t('selectionDistribution.average')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => {
                  const isAverage = Math.abs(entry.selectionCount - averageSelections) < 0.5;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={isAverage ? '#2563eb' : '#6b7280'} 
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>{t('patterns.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center p-4 bg-[#ede9fe] rounded-lg">
              <div className="text-2xl font-bold text-[#7C3AAE]">
                {averageSelections.toFixed(1)}
              </div>
              <div className="text-sm text-blue-800">
                Average selections per response
              </div>
            </div>
            
            <div className="space-y-3">
              {chartData.map((item, index) => {
                const isAverage = Math.abs(item.selectionCount - averageSelections) < 0.5;
                return (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{item.name}:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isAverage ? 'text-[#7C3AAE]' : 'text-primary'}`}>
                        {item.percentage.toFixed(1)}%
                      </span>
                      {isAverage && (
                        <span className="text-xs text-[#7C3AAE] font-medium">
                          (avg)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Individual Option Performance
const IndividualOptionAnalysis: React.FC<{
  options: Array<{ option: string; count: number; percentage: number }>;
  totalResponses: number;
  loading?: boolean;
}> = ({ options, totalResponses: _totalResponses, loading }) => {
  const { t } = useTranslation('checkboxFieldAnalytics');

  if (loading || !options || options.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('charts.individualPopularity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 bg-background rounded-lg hover:bg-background transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-primary truncate" title={option.option}>
                  {option.option}
                </div>
                <div className="text-sm text-foreground">
                  {option.percentage.toFixed(1)}% of responses
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="w-24 bg-[#ebe9ec] rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${option.percentage}%` }}
                  />
                </div>
                <div className="text-right min-w-0">
                  <div className="text-lg font-bold text-primary">
                    {option.count}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('combinations.times')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const CheckboxFieldAnalytics: React.FC<CheckboxFieldAnalyticsProps> = ({
  data,
  fieldLabel: _fieldLabel,
  totalResponses,
  loading
}) => {
  const { t } = useTranslation('checkboxFieldAnalytics');

  if (loading) return <FieldAnalyticsLoader />;

  if (!data || !data.individualOptions || data.individualOptions.length === 0) {
    return (
      <FieldAnalyticsEmpty
        icon={<CheckSquare className="h-8 w-8 text-[#2563EB]" />}
        title={t('emptyState.title')}
        subtitle={t('emptyState.subtitle')}
      />
    );
  }

  const totalSelections = data.individualOptions.reduce((sum, opt) => sum + opt.count, 0);
  const mostPopularOption = data.individualOptions[0];
  const uniqueCombinations = data.combinations.length;
  const responseRate = totalResponses > 0 ? (data.selectionDistribution.reduce((sum, dist) => sum + dist.responseCount, 0) / totalResponses) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('stats.totalSelections')}
          value={totalSelections}
          subtitle={t('stats.acrossAllOptions')}
          icon={<CheckSquare className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.averageSelected')}
          value={data.averageSelections.toFixed(1)}
          subtitle={t('stats.optionsPerResponse')}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.mostPopular')}
          value={`${mostPopularOption.percentage.toFixed(1)}%`}
          subtitle={mostPopularOption.option.length > 20 ? 
            `${mostPopularOption.option.substring(0, 20)}...` : 
            mostPopularOption.option
          }
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.uniqueCombos')}
          value={uniqueCombinations}
          subtitle={t('stats.differentCombinationsUsed')}
          icon={<Link className="h-5 w-5" />}
        />
      </div>

      {/* Individual Option Performance */}
      <div className="space-y-4">
        <MetricHelper {...METRIC_HELPERS.INDIVIDUAL_OPTIONS} compact />
        <IndividualOptionAnalysis 
          options={data.individualOptions}
          totalResponses={totalResponses}
        />
      </div>

      {/* Selection Distribution */}
      <SelectionDistribution 
        distribution={data.selectionDistribution}
        averageSelections={data.averageSelections}
      />

      {/* Advanced Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.COMBINATION_ANALYSIS} compact />
          <PopularCombinations combinations={data.combinations} />
        </div>
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.CORRELATIONS} compact />
          <CorrelationMatrix 
            correlations={data.correlations}
            options={data.individualOptions.map(opt => opt.option)}
          />
        </div>
      </div>

      {/* Insights Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('charts.multiSelectionSummary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-primary">{t('summary.selectionBehavior')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.responseRate')}</span>
                  <span className="font-medium">{responseRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.avgSelections')}</span>
                  <span className="font-medium">{data.averageSelections.toFixed(1)}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-primary">{t('summary.optionPerformance')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.availableOptions')}</span>
                  <span className="font-medium">{data.individualOptions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.usedOptions')}</span>
                  <span className="font-medium">
                    {data.individualOptions.filter(opt => opt.count > 0).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-primary">{t('summary.combinationPatterns')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.uniqueCombos')}</span>
                  <span className="font-medium">{uniqueCombinations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.strongCorrelations')}</span>
                  <span className="font-medium">
                    {data.correlations.filter(corr => corr.correlation >= 2.0).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-primary">{t('summary.dataQuality')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.totalResponses')}</span>
                  <span className="font-medium">{totalResponses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.selectionVariety')}</span>
                  <span className="font-medium">
                    {data.selectionDistribution.length > 3 ? t('summary.varietyHigh') : 
                     data.selectionDistribution.length > 1 ? t('summary.varietyMedium') : t('summary.varietyLow')}
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