/**
 * Selection Field Analytics Processor
 *
 * Processes analytics for SELECT_FIELD and RADIO_FIELD types.
 */

import { FieldType } from '@dculus/types';
import { FieldResponse, FieldAnalyticsBase, SelectionFieldAnalytics } from './types.js';

/**
 * Process selection field analytics (Select, Radio)
 */
export const processSelectionFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number
): FieldAnalyticsBase & SelectionFieldAnalytics => {
  const values = fieldResponses.map(r => String(r.value || '').trim()).filter(v => v.length > 0);
  const totalResponses = values.length;

  // Count option frequencies
  const optionCounts = new Map<string, number>();
  values.forEach(value => {
    optionCounts.set(value, (optionCounts.get(value) || 0) + 1);
  });

  // Create options array
  const options = Array.from(optionCounts.entries())
    .map(([option, count]) => ({
      option,
      count,
      percentage: (count / totalResponses) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // Top option
  const topOption = options.length > 0 ? options[0].option : '';

  // Response distribution analysis
  const getDistributionType = (): 'even' | 'concentrated' | 'polarized' => {
    if (options.length <= 1) return 'concentrated';

    const maxPercentage = options[0]?.percentage || 0;
    const averagePercentage = 100 / options.length;

    if (maxPercentage > 70) return 'concentrated';
    if (maxPercentage < averagePercentage * 1.5) return 'even';
    return 'polarized';
  };

  // Trend analysis (group by date)
  const trendMap = new Map<string, Map<string, number>>();
  fieldResponses.forEach(response => {
    const value = String(response.value || '').trim();
    if (value.length > 0) {
      const dateKey = response.submittedAt.toISOString().split('T')[0];
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, new Map());
      }
      const dayMap = trendMap.get(dateKey)!;
      dayMap.set(value, (dayMap.get(value) || 0) + 1);
    }
  });

  const trend = Array.from(trendMap.entries())
    .map(([date, optionMap]) => ({
      date,
      options: Array.from(optionMap.entries()).map(([option, count]) => ({ option, count })),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    fieldId,
    fieldType: FieldType.SELECT_FIELD, // Will be overridden by caller
    fieldLabel,
    totalResponses,
    responseRate: totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0,
    lastUpdated: new Date(),
    options,
    trend,
    topOption,
    responseDistribution: getDistributionType(),
  };
};
