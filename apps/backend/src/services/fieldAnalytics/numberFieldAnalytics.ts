/**
 * Number Field Analytics Processor
 *
 * Processes analytics for NUMBER_FIELD type.
 */

import { FieldType } from '@dculus/types';
import { FieldResponse, FieldAnalyticsBase, NumberFieldAnalytics } from './types.js';

/**
 * Process number field analytics
 */
export const processNumberFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number
): FieldAnalyticsBase & NumberFieldAnalytics => {
  const values = fieldResponses
    .map(r => parseFloat(String(r.value)))
    .filter(v => !isNaN(v))
    .sort((a, b) => a - b);

  const totalResponses = values.length;

  if (totalResponses === 0) {
    return {
      fieldId,
      fieldType: FieldType.NUMBER_FIELD,
      fieldLabel,
      totalResponses: 0,
      responseRate: 0,
      lastUpdated: new Date(),
      min: 0,
      max: 0,
      average: 0,
      median: 0,
      standardDeviation: 0,
      distribution: [],
      trend: [],
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 },
    };
  }

  // Basic statistics
  const min = values[0];
  const max = values[values.length - 1];
  const average = values.reduce((a, b) => a + b, 0) / totalResponses;
  const median = values[Math.floor(totalResponses / 2)];

  // Standard deviation
  const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / totalResponses;
  const standardDeviation = Math.sqrt(variance);

  // Percentiles
  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * totalResponses) - 1;
    return values[Math.max(0, Math.min(index, totalResponses - 1))];
  };

  const percentiles = {
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90),
    p95: getPercentile(95),
  };

  // Distribution (create 10 buckets)
  const bucketCount = Math.min(10, totalResponses);
  const bucketSize = (max - min) / bucketCount;
  const distribution = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketMin = min + i * bucketSize;
    const bucketMax = min + (i + 1) * bucketSize;
    const count = values.filter(v => v >= bucketMin && (i === bucketCount - 1 ? v <= bucketMax : v < bucketMax)).length;

    distribution.push({
      range: `${bucketMin.toFixed(1)}-${bucketMax.toFixed(1)}`,
      count,
      percentage: (count / totalResponses) * 100,
    });
  }

  // Trend analysis (group by date)
  const trendMap = new Map<string, { sum: number; count: number }>();
  fieldResponses.forEach(response => {
    const value = parseFloat(String(response.value));
    if (!isNaN(value)) {
      const dateKey = response.submittedAt.toISOString().split('T')[0];
      const existing = trendMap.get(dateKey) || { sum: 0, count: 0 };
      trendMap.set(dateKey, { sum: existing.sum + value, count: existing.count + 1 });
    }
  });

  const trend = Array.from(trendMap.entries())
    .map(([date, data]) => ({
      date,
      average: data.sum / data.count,
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    fieldId,
    fieldType: FieldType.NUMBER_FIELD,
    fieldLabel,
    totalResponses,
    responseRate: totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0,
    lastUpdated: new Date(),
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    average: Math.round(average * 100) / 100,
    median: Math.round(median * 100) / 100,
    standardDeviation: Math.round(standardDeviation * 100) / 100,
    distribution,
    trend,
    percentiles: {
      p25: Math.round(percentiles.p25 * 100) / 100,
      p50: Math.round(percentiles.p50 * 100) / 100,
      p75: Math.round(percentiles.p75 * 100) / 100,
      p90: Math.round(percentiles.p90 * 100) / 100,
      p95: Math.round(percentiles.p95 * 100) / 100,
    },
  };
};
