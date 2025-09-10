import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { StatCard } from './BaseChartComponents';
import { CheckboxFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { CheckSquare, Link, BarChart3, TrendingUp } from 'lucide-react';
import { MetricHelper, METRIC_HELPERS } from './MetricHelper';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Option Correlations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!correlations || correlations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Option Correlations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No significant correlations found
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCorrelationColor = (correlation: number) => {
    if (correlation >= 2.0) return 'bg-green-500';
    if (correlation >= 1.5) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getCorrelationDescription = (correlation: number) => {
    if (correlation >= 2.0) return 'Very Strong';
    if (correlation >= 1.5) return 'Strong';
    return 'Moderate';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Option Correlations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {correlations.slice(0, 10).map((corr, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div 
                  className={`w-3 h-3 rounded-full ${getCorrelationColor(corr.correlation)}`}
                />
                <div>
                  <div className="font-medium text-gray-900">
                    "{corr.option1}" ↔ "{corr.option2}"
                  </div>
                  <div className="text-sm text-gray-600">
                    {getCorrelationDescription(corr.correlation)} correlation
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">
                  {corr.correlation.toFixed(1)}x
                </div>
                <div className="text-xs text-gray-500">
                  more likely together
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Understanding Correlations</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• <span className="font-medium">Strong (2.0x+):</span> Options frequently selected together</p>
            <p>• <span className="font-medium">Moderate (1.5x+):</span> Options sometimes selected together</p>
            <p>• <span className="font-medium">Weak (&lt;1.5x):</span> Options rarely selected together</p>
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
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Popular Combinations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
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
          <CardTitle>Popular Combinations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No combination data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const getComboColor = (percentage: number) => {
    if (percentage >= 20) return 'border-green-300 bg-green-50';
    if (percentage >= 10) return 'border-yellow-300 bg-yellow-50';
    return 'border-blue-300 bg-blue-50';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Popular Combinations</CardTitle>
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
                    <span className="text-sm text-gray-600">
                      {combo.combination.length} option{combo.combination.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {combo.combination.map((option, optIndex) => (
                      <span 
                        key={optIndex}
                        className="inline-flex items-center px-2 py-1 bg-white rounded-md text-xs font-medium text-gray-700 border"
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <div className="text-lg font-bold text-gray-900">
                    {combo.percentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {combo.count} times
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {combinations.length > 10 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Showing top 10 of {combinations.length} unique combinations
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
  const chartData = useMemo(() => {
    if (!distribution) return [];
    return distribution.map(item => ({
      name: `${item.selectionCount} option${item.selectionCount !== 1 ? 's' : ''}`,
      value: item.responseCount,
      percentage: item.percentage,
      selectionCount: item.selectionCount
    }));
  }, [distribution]);

  if (loading || !distribution || distribution.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Selection Count Distribution</CardTitle>
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
                label={{ value: 'Number of Responses', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isAverage = Math.abs(data.selectionCount - averageSelections) < 0.5;
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg border-gray-200">
                        <p className="font-medium text-gray-900 mb-2">{label}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full bg-blue-600" />
                          <span className="text-gray-700">
                            Responses: {data.value} ({data.percentage.toFixed(1)}%)
                          </span>
                          {isAverage && (
                            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-1 rounded">
                              Average
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
          <CardTitle>Selection Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
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
                    <span className="text-sm text-gray-700">{item.name}:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isAverage ? 'text-blue-600' : 'text-gray-900'}`}>
                        {item.percentage.toFixed(1)}%
                      </span>
                      {isAverage && (
                        <span className="text-xs text-blue-600 font-medium">
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

  if (loading || !options || options.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Individual Option Popularity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate" title={option.option}>
                  {option.option}
                </div>
                <div className="text-sm text-gray-600">
                  {option.percentage.toFixed(1)}% of responses
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${option.percentage}%` }}
                  />
                </div>
                <div className="text-right min-w-0">
                  <div className="text-lg font-bold text-gray-900">
                    {option.count}
                  </div>
                  <div className="text-xs text-gray-500">
                    times
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
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatCard 
              key={i}
              title="Loading..." 
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

  if (!data || !data.individualOptions || data.individualOptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No checkbox data available</p>
          <p className="text-sm">This checkbox field hasn't received any responses yet.</p>
        </div>
      </div>
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
          title="Total Selections"
          value={totalSelections}
          subtitle="Across all options"
          icon={<CheckSquare className="h-5 w-5" />}
        />
        <StatCard
          title="Average Selected"
          value={data.averageSelections.toFixed(1)}
          subtitle="Options per response"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          title="Most Popular"
          value={`${mostPopularOption.percentage.toFixed(1)}%`}
          subtitle={mostPopularOption.option.length > 20 ? 
            `${mostPopularOption.option.substring(0, 20)}...` : 
            mostPopularOption.option
          }
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Unique Combos"
          value={uniqueCombinations}
          subtitle="Different combinations used"
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
          <CardTitle>Multi-Selection Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Selection Behavior</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Response rate:</span>
                  <span className="font-medium">{responseRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg selections:</span>
                  <span className="font-medium">{data.averageSelections.toFixed(1)}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Option Performance</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Available options:</span>
                  <span className="font-medium">{data.individualOptions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Used options:</span>
                  <span className="font-medium">
                    {data.individualOptions.filter(opt => opt.count > 0).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Combination Patterns</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Unique combos:</span>
                  <span className="font-medium">{uniqueCombinations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Strong correlations:</span>
                  <span className="font-medium">
                    {data.correlations.filter(corr => corr.correlation >= 2.0).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Data Quality</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total responses:</span>
                  <span className="font-medium">{totalResponses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Selection variety:</span>
                  <span className="font-medium">
                    {data.selectionDistribution.length > 3 ? 'High' : 
                     data.selectionDistribution.length > 1 ? 'Medium' : 'Low'}
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