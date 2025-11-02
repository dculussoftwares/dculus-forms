import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { StatCard, CHART_COLORS } from './BaseChartComponents';
import { DateFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { Calendar, Clock, TrendingUp, Sunrise, Snowflake, Flower, Sun, Leaf } from 'lucide-react';
import { MetricHelper, METRIC_HELPERS } from './MetricHelper';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTranslation } from '../../../hooks/useTranslation';

interface DateFieldAnalyticsProps {
  data: DateFieldAnalyticsData;
  fieldLabel: string;
  totalResponses: number;
  loading?: boolean;
}

// Calendar Heatmap Component
const CalendarHeatmap: React.FC<{
  dateDistribution: Array<{ date: string; count: number }>;
  loading?: boolean;
}> = ({ dateDistribution, loading }) => {
  const { t } = useTranslation('dateFieldAnalytics');
  
  const heatmapData = useMemo(() => {
    if (!dateDistribution || dateDistribution.length === 0) return { months: [], maxCount: 0 };

    const counts = new Map<string, number>();
    let maxCount = 0;

    dateDistribution.forEach(item => {
      counts.set(item.date, item.count);
      maxCount = Math.max(maxCount, item.count);
    });

    // Group dates by month for display
    const monthsMap = new Map<string, Array<{ date: string; count: number; day: number }>>();
    
    dateDistribution.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, []);
      }
      
      monthsMap.get(monthKey)!.push({
        date: item.date,
        count: item.count,
        day: date.getDate()
      });
    });

    const months = Array.from(monthsMap.entries())
      .map(([monthKey, days]) => ({
        month: monthKey,
        monthName: new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        days: days.sort((a, b) => a.day - b.day)
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { months, maxCount };
  }, [dateDistribution]);

  const getIntensityColor = (count: number, maxCount: number) => {
    if (maxCount === 0) return 'bg-gray-100';
    const intensity = count / maxCount;
    if (intensity === 0) return 'bg-gray-100';
    if (intensity <= 0.25) return 'bg-blue-200';
    if (intensity <= 0.5) return 'bg-blue-400';
    if (intensity <= 0.75) return 'bg-blue-600';
    return 'bg-blue-800';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('calendar.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dateDistribution || dateDistribution.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('calendar.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            {t('calendar.noDateData')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('calendar.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {heatmapData.months.map(month => (
            <div key={month.month} className="space-y-2">
              <h4 className="font-medium text-gray-900">{month.monthName}</h4>
              <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <div key={index} className="text-xs text-gray-500 text-center p-1">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {month.days.map(dayData => {
                  const date = new Date(dayData.date);
                  const dayOfWeek = date.getDay();
                  const intensity = getIntensityColor(dayData.count, heatmapData.maxCount);
                  
                  return (
                    <div
                      key={dayData.date}
                      className={`h-8 w-8 ${intensity} rounded flex items-center justify-center text-xs text-white font-medium cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all`}
                      title={`${date.toLocaleDateString()}: ${dayData.count} selections`}
                      style={{ gridColumn: dayOfWeek + 1 }}
                    >
                      {dayData.day}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {t('calendar.intensityScale')}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">{t('calendar.less')}</span>
            <div className="flex gap-1">
              {['bg-gray-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600', 'bg-blue-800'].map((color, index) => (
                <div key={index} className={`w-3 h-3 ${color} rounded`} />
              ))}
            </div>
            <span className="text-xs text-gray-500">{t('calendar.more')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Seasonal Analysis Component
const SeasonalAnalysis: React.FC<{
  seasonalPatterns: Array<{ season: string; count: number; percentage: number }>;
  loading?: boolean;
}> = ({ seasonalPatterns, loading }) => {
  const { t } = useTranslation('dateFieldAnalytics');
  
  const getSeasonIcon = (season: string) => {
    switch (season.toLowerCase()) {
      case 'spring': return <Flower className="h-6 w-6 text-green-500" />;
      case 'summer': return <Sun className="h-6 w-6 text-yellow-500" />;
      case 'fall': case 'autumn': return <Leaf className="h-6 w-6 text-orange-500" />;
      case 'winter': return <Snowflake className="h-6 w-6 text-blue-500" />;
      default: return <Calendar className="h-6 w-6 text-gray-500" />;
    }
  };

  const getSeasonColor = (season: string) => {
    switch (season.toLowerCase()) {
      case 'spring': return 'bg-green-100 border-green-300';
      case 'summer': return 'bg-yellow-100 border-yellow-300';
      case 'fall': case 'autumn': return 'bg-orange-100 border-orange-300';
      case 'winter': return 'bg-blue-100 border-blue-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  if (loading || !seasonalPatterns || seasonalPatterns.length === 0) {
    return null;
  }

  const totalSeasonalResponses = seasonalPatterns.reduce((sum, season) => sum + season.count, 0);
  const topSeason = seasonalPatterns.reduce((max, season) => 
    season.count > max.count ? season : max, seasonalPatterns[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('seasonal.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {seasonalPatterns.map((season, _index) => {
            const isTopSeason = season.season === topSeason.season;
            return (
              <div 
                key={season.season}
                className={`border-2 rounded-lg p-4 transition-all ${
                  isTopSeason ? 'border-blue-400 bg-blue-50' : getSeasonColor(season.season)
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getSeasonIcon(season.season)}
                    <span className="font-medium text-gray-900">{season.season}</span>
                  </div>
                  {isTopSeason && (
                    <div className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                      {t('seasonal.peak')}
                    </div>
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {season.percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">
                  {season.count} {t('seasonal.selections')}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isTopSeason ? 'bg-blue-500' : 
                      season.season.toLowerCase() === 'spring' ? 'bg-green-500' :
                      season.season.toLowerCase() === 'summer' ? 'bg-yellow-500' :
                      season.season.toLowerCase() === 'fall' ? 'bg-orange-500' :
                      'bg-blue-400'
                    }`}
                    style={{ width: `${season.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-900">{t('seasonal.insightsTitle')}</span>
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            <p>• {t('seasonal.mostPopularSeason', { values: { season: topSeason.season, percentage: topSeason.percentage.toFixed(1) } })}</p>
            <p>• {t('seasonal.totalCoverage', { values: { count: totalSeasonalResponses } })}</p>
            {seasonalPatterns.length === 4 && (
              <p>• {t('seasonal.' + (
                Math.max(...seasonalPatterns.map(s => s.percentage)) - 
                Math.min(...seasonalPatterns.map(s => s.percentage)) < 15 ? 
                'evenDistribution' : 'somePreferences'
              ))}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Date Range Analysis
const DateRangeAnalysis: React.FC<{
  earliestDate: string;
  latestDate: string;
  mostCommonDate: string;
  totalResponses: number;
}> = ({ earliestDate, latestDate, mostCommonDate, totalResponses }) => {
  const { t } = useTranslation('dateFieldAnalytics');
  
  const dateRange = useMemo(() => {
    const earliest = new Date(earliestDate);
    const latest = new Date(latestDate);
    const common = new Date(mostCommonDate);
    
    const daysDifference = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      earliest: earliest.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      }),
      latest: latest.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      }),
      common: common.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      }),
      daysDifference
    };
  }, [earliestDate, latestDate, mostCommonDate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('rangeOverview.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-sm font-medium text-gray-600 mb-1">{t('rangeOverview.earliest')}</div>
              <div className="text-sm text-gray-900">{dateRange.earliest}</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Sunrise className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-sm font-medium text-gray-600 mb-1">{t('rangeOverview.mostCommon')}</div>
              <div className="text-sm text-gray-900">{dateRange.common}</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Clock className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="text-sm font-medium text-gray-600 mb-1">{t('rangeOverview.latest')}</div>
              <div className="text-sm text-gray-900">{dateRange.latest}</div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{t('rangeOverview.timeSpan')}:</span>
              <span className="font-medium text-gray-900">
                {dateRange.daysDifference} {t('rangeOverview.days')}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">Total Date Responses:</span>
              <span className="font-medium text-gray-900">{totalResponses}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const DateFieldAnalytics: React.FC<DateFieldAnalyticsProps> = ({
  data,
  fieldLabel: _fieldLabel,
  totalResponses,
  loading
}) => {
  const { t } = useTranslation('dateFieldAnalytics');
  
  const weekdayChartData = useMemo(() => {
    if (!data?.weekdayDistribution) return [];
    const weekdayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return weekdayOrder.map(weekday => {
      const found = data.weekdayDistribution.find(item => item.weekday === weekday);
      return {
        name: weekday.substring(0, 3), // Mon, Tue, etc.
        value: found ? found.count : 0,
        percentage: found ? found.percentage : 0,
        fullName: weekday
      };
    });
  }, [data?.weekdayDistribution]);

  const monthlyChartData = useMemo(() => {
    if (!data?.monthlyDistribution) return [];
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthOrder.map(month => {
      const found = data.monthlyDistribution.find(item => item.month === month);
      return {
        name: month.substring(0, 3), // Jan, Feb, etc.
        value: found ? found.count : 0,
        percentage: found ? found.percentage : 0,
        fullName: month
      };
    });
  }, [data?.monthlyDistribution]);

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

  if (!data || !data.dateDistribution || data.dateDistribution.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">{t('emptyState.title')}</p>
          <p className="text-sm">{t('emptyState.subtitle')}</p>
        </div>
      </div>
    );
  }

  const totalDateResponses = data.dateDistribution.reduce((sum, item) => sum + item.count, 0);
  const dateRange = Math.ceil(
    (new Date(data.latestDate).getTime() - new Date(data.earliestDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const mostPopularWeekday = data.weekdayDistribution.reduce((max, day) => 
    day.count > max.count ? day : max, data.weekdayDistribution[0]);
  const mostPopularMonth = data.monthlyDistribution.reduce((max, month) => 
    month.count > max.count ? month : max, data.monthlyDistribution[0]);

  return (
    <div className="space-y-6">
      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('stats.totalResponses')}
          value={totalDateResponses}
          subtitle={t('stats.dateSelectionsMade')}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.dateRange')}
          value={`${dateRange} ${t('rangeOverview.days')}`}
          subtitle={t('stats.fromEarliestToLatest')}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.popularDay')}
          value={mostPopularWeekday.weekday}
          subtitle={`${mostPopularWeekday.percentage.toFixed(1)}% of selections`}
          icon={<Sunrise className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.popularMonth')}
          value={mostPopularMonth.month.substring(0, 3)}
          subtitle={`${mostPopularMonth.count} ${t('seasonal.selections')}`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Date Range Overview */}
      <DateRangeAnalysis
        earliestDate={data.earliestDate}
        latestDate={data.latestDate}
        mostCommonDate={data.mostCommonDate}
        totalResponses={totalDateResponses}
      />

      {/* Calendar Heatmap */}
      <div className="space-y-4">
        <MetricHelper {...METRIC_HELPERS.DATE_DISTRIBUTION} compact />
        <CalendarHeatmap dateDistribution={data.dateDistribution} />
      </div>

      {/* Weekday and Monthly Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.WEEKDAY_PATTERNS} compact />
          <Card>
            <CardHeader>
              <CardTitle>{t('dayOfWeek.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={weekdayChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis 
                    label={{ value: t('dayOfWeek.selections'), angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ active, payload, label: _label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg border-gray-200">
                            <p className="font-medium text-gray-900 mb-2">
                              {data.fullName}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-3 h-3 rounded-full bg-blue-600" />
                              <span className="text-gray-700">
                                {t('dayOfWeek.selections')}: {data.value} ({data.percentage.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {weekdayChartData.map((_entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS.primary[1]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.MONTHLY_TRENDS} compact />
          <Card>
            <CardHeader>
              <CardTitle>{t('monthly.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis 
                    label={{ value: t('monthly.count'), angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ active, payload, label: _label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg border-gray-200">
                            <p className="font-medium text-gray-900 mb-2">
                              {data.fullName}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-3 h-3 rounded-full bg-green-600" />
                              <span className="text-gray-700">
                                {t('dayOfWeek.selections')}: {data.value} ({data.percentage.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {monthlyChartData.map((_entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS.primary[2]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seasonal Analysis */}
      <div className="space-y-4">
        <MetricHelper {...METRIC_HELPERS.SEASONAL_ANALYSIS} compact />
        <SeasonalAnalysis seasonalPatterns={data.seasonalPatterns} />
      </div>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>{t('summary.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.rangeTitle')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.span')}</span>
                  <span className="font-medium">{dateRange} {t('rangeOverview.days')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.earliest')}</span>
                  <span className="font-medium">{new Date(data.earliestDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.patternsTitle')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.popularDay')}</span>
                  <span className="font-medium">{mostPopularWeekday.weekday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.popularMonth')}</span>
                  <span className="font-medium">{mostPopularMonth.month}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.distributionTitle')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.responses')}</span>
                  <span className="font-medium">{data.dateDistribution.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.uniqueDates')}</span>
                  <span className="font-medium">{data.dateDistribution.filter(d => d.count > 0).length}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.dataQualityTitle')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.completeness')}</span>
                  <span className="font-medium">
                    {totalResponses > 0 ? ((totalDateResponses / totalResponses) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.temporalSpread')}</span>
                  <span className="font-medium">
                    {data.seasonalPatterns.length === 4 ? t('summary.allSeasons') : t('summary.partial')}
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