/**
 * Date Field Analytics Processor
 *
 * Processes analytics for DATE_FIELD type.
 */

import { FieldType } from '@dculus/types';
import { FieldResponse, FieldAnalyticsBase, DateFieldAnalytics } from './types.js';

/**
 * Process date field analytics
 */
export const processDateFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number
): FieldAnalyticsBase & DateFieldAnalytics => {
  const validDates = fieldResponses
    .map(r => new Date(String(r.value)))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const totalResponses = validDates.length;

  if (totalResponses === 0) {
    return {
      fieldId,
      fieldType: FieldType.DATE_FIELD,
      fieldLabel,
      totalResponses: 0,
      responseRate: 0,
      lastUpdated: new Date(),
      earliestDate: new Date(),
      latestDate: new Date(),
      mostCommonDate: new Date(),
      dateDistribution: [],
      weekdayDistribution: [],
      monthlyDistribution: [],
      seasonalPatterns: [],
    };
  }

  const earliestDate = validDates[0];
  const latestDate = validDates[validDates.length - 1];

  // Find most common date
  const dateCounts = new Map<string, number>();
  validDates.forEach(date => {
    const dateStr = date.toISOString().split('T')[0];
    dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
  });

  const mostCommonDateStr = Array.from(dateCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostCommonDate = mostCommonDateStr ? new Date(mostCommonDateStr) : earliestDate;

  // Date distribution
  const dateDistribution = Array.from(dateCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Weekday distribution
  const weekdayCounts = new Map<string, number>();
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  validDates.forEach(date => {
    const weekday = weekdays[date.getDay()];
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) || 0) + 1);
  });

  const weekdayDistribution = weekdays.map(weekday => ({
    weekday,
    count: weekdayCounts.get(weekday) || 0,
    percentage: ((weekdayCounts.get(weekday) || 0) / totalResponses) * 100,
  }));

  // Monthly distribution
  const monthCounts = new Map<string, number>();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  validDates.forEach(date => {
    const month = months[date.getMonth()];
    monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
  });

  const monthlyDistribution = months.map(month => ({
    month,
    count: monthCounts.get(month) || 0,
    percentage: ((monthCounts.get(month) || 0) / totalResponses) * 100,
  }));

  // Seasonal patterns
  const seasonCounts = new Map<string, number>();
  validDates.forEach(date => {
    const month = date.getMonth();
    let season: string;
    if (month >= 2 && month <= 4) season = 'Spring';
    else if (month >= 5 && month <= 7) season = 'Summer';
    else if (month >= 8 && month <= 10) season = 'Fall';
    else season = 'Winter';

    seasonCounts.set(season, (seasonCounts.get(season) || 0) + 1);
  });

  const seasonalPatterns = ['Spring', 'Summer', 'Fall', 'Winter'].map(season => ({
    season,
    count: seasonCounts.get(season) || 0,
    percentage: ((seasonCounts.get(season) || 0) / totalResponses) * 100,
  }));

  return {
    fieldId,
    fieldType: FieldType.DATE_FIELD,
    fieldLabel,
    totalResponses,
    responseRate: totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0,
    lastUpdated: new Date(),
    earliestDate,
    latestDate,
    mostCommonDate,
    dateDistribution,
    weekdayDistribution,
    monthlyDistribution,
    seasonalPatterns,
  };
};
