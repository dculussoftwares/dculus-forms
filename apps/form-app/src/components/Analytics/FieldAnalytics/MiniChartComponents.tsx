/**
 * Mini Chart Components
 *
 * Small preview charts for field analytics grid view.
 * Displays word clouds, bar charts, and pie charts for different field types.
 */

import React from 'react';
import { FileText, BarChart3, CircleDot } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ANALYTICS_COLORS } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { FieldAnalyticsData } from '../../../hooks/useFieldAnalytics';

// Mini Chart Colors - using centralized colors
const MINI_CHART_COLORS = ANALYTICS_COLORS.mini;

/**
 * Mini Word Cloud Component
 * Displays top words with size based on frequency
 */
export const MiniWordCloud: React.FC<{ words: Array<{ word: string; count: number }> }> = ({ words }) => {
  const { t } = useTranslation('fieldAnalyticsViewer');

  if (!words || words.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm">{t('miniCharts.noWordData')}</p>
        </div>
      </div>
    );
  }

  const topWords = words.slice(0, 10);
  const maxCount = Math.max(...topWords.map(w => w.count));

  return (
    <div className="flex flex-wrap gap-3 items-center justify-center h-full p-4">
      {topWords.map((word) => {
        const size = Math.max(16, Math.min(36, 16 + (word.count / maxCount) * 20));
        const opacity = Math.max(0.6, word.count / maxCount);
        return (
          <span
            key={word.word}
            className="px-2 py-1 text-blue-600 font-semibold hover:scale-110 transition-transform cursor-default"
            style={{
              fontSize: `${size}px`,
              opacity: opacity
            }}
            title={t('tooltips.wordAppears', { values: { word: word.word, count: word.count } })}
          >
            {word.word}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Mini Bar Chart Component
 * Displays distribution data as a bar chart
 */
export const MiniBarChart: React.FC<{ data: Array<{ name: string; value: number }> }> = ({ data }) => {
  const { t } = useTranslation('fieldAnalyticsViewer');

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm">{t('miniCharts.noChartData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 6)} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Bar
            dataKey="value"
            fill="#3B82F6"
            radius={[4, 4, 0, 0]}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Mini Pie Chart Component
 * Displays selection distribution as a pie chart with legend
 */
export const MiniPieChart: React.FC<{ data: Array<{ name: string; value: number }> }> = ({ data }) => {
  const { t } = useTranslation('fieldAnalyticsViewer');

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <CircleDot className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm">{t('miniCharts.noSelectionData')}</p>
        </div>
      </div>
    );
  }

  const chartData = data.slice(0, 5);

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex items-center gap-8">
        {/* Pie Chart */}
        <div className="flex-shrink-0">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
              >
                {chartData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={MINI_CHART_COLORS[index % MINI_CHART_COLORS.length]}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {chartData.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: MINI_CHART_COLORS[index % MINI_CHART_COLORS.length] }}
              />
              <span className="text-sm text-gray-700 font-medium">
                {item.name}: {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Mini Preview Chart Router
 * Determines which chart type to show based on field type and available data
 */
export const MiniPreviewChart: React.FC<{ field: FieldAnalyticsData }> = ({ field }) => {
  const { t: tCommon } = useTranslation('common');

  // Get real preview data from analytics data
  const getRealPreviewData = (field: FieldAnalyticsData) => {
    switch (field.fieldType) {
      case 'text_input_field':
      case 'text_area_field':
        if (field.textAnalytics?.wordCloud && field.textAnalytics.wordCloud.length > 0) {
          return {
            type: 'wordcloud' as const,
            data: field.textAnalytics.wordCloud.slice(0, 5).map(item => ({
              word: item.word,
              count: item.count
            }))
          };
        }
        break;

      case 'number_field':
        if (field.numberAnalytics?.distribution && field.numberAnalytics.distribution.length > 0) {
          return {
            type: 'bar' as const,
            data: field.numberAnalytics.distribution.slice(0, 5).map(item => ({
              name: item.range,
              value: item.count
            }))
          };
        }
        break;

      case 'email_field':
        if (field.emailAnalytics?.domains && field.emailAnalytics.domains.length > 0) {
          return {
            type: 'bar' as const,
            data: field.emailAnalytics.domains.slice(0, 5).map(item => ({
              name: item.domain.length > 10 ? `${item.domain.substring(0, 10)}...` : item.domain,
              value: item.count
            }))
          };
        }
        break;

      case 'date_field':
        if (field.dateAnalytics?.monthlyDistribution && field.dateAnalytics.monthlyDistribution.length > 0) {
          return {
            type: 'bar' as const,
            data: field.dateAnalytics.monthlyDistribution.slice(0, 5).map(item => ({
              name: item.month,
              value: item.count
            }))
          };
        }
        break;

      case 'select_field':
      case 'radio_field':
        if (field.selectionAnalytics?.options && field.selectionAnalytics.options.length > 0) {
          return {
            type: 'pie' as const,
            data: field.selectionAnalytics.options.slice(0, 4).map(item => ({
              name: item.option.length > 15 ? `${item.option.substring(0, 15)}...` : item.option,
              value: item.count
            }))
          };
        }
        break;

      case 'checkbox_field':
        if (field.checkboxAnalytics?.individualOptions && field.checkboxAnalytics.individualOptions.length > 0) {
          return {
            type: 'bar' as const,
            data: field.checkboxAnalytics.individualOptions.slice(0, 4).map(item => ({
              name: item.option.length > 12 ? `${item.option.substring(0, 12)}...` : item.option,
              value: item.count
            }))
          };
        }
        break;

      default:
        return null;
    }
    return null;
  };

  const previewData = getRealPreviewData(field);
  if (!previewData) {
    return (
      <div className="flex items-center justify-center h-16 text-gray-400 text-sm">
        {tCommon('noDataAvailable')}
      </div>
    );
  }

  switch (previewData.type) {
    case 'wordcloud':
      return <MiniWordCloud words={previewData.data as Array<{ word: string; count: number }>} />;
    case 'bar':
      return <MiniBarChart data={previewData.data as Array<{ name: string; value: number }>} />;
    case 'pie':
      return <MiniPieChart data={previewData.data as Array<{ name: string; value: number }>} />;
    default:
      return null;
  }
};
