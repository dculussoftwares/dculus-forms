/**
 * Checkbox Field Analytics Processor
 *
 * Processes analytics for CHECKBOX_FIELD type.
 */

import { FieldType } from '@dculus/types';
import { FieldResponse, FieldAnalyticsBase, CheckboxFieldAnalytics } from './types.js';

/**
 * Process checkbox field analytics
 */
export const processCheckboxFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number
): FieldAnalyticsBase & CheckboxFieldAnalytics => {
  // Parse checkbox responses (can be arrays or comma-separated strings)
  const parsedResponses = fieldResponses.map(response => {
    let selections: string[] = [];

    if (Array.isArray(response.value)) {
      selections = response.value.map(v => String(v).trim()).filter(v => v.length > 0);
    } else if (typeof response.value === 'string') {
      selections = response.value.split(',').map(v => v.trim()).filter(v => v.length > 0);
    }

    return { ...response, selections };
  }).filter(r => r.selections.length > 0);

  const totalResponses = parsedResponses.length;

  // Individual option analysis
  const optionCounts = new Map<string, number>();
  parsedResponses.forEach(response => {
    response.selections.forEach(option => {
      optionCounts.set(option, (optionCounts.get(option) || 0) + 1);
    });
  });

  const individualOptions = Array.from(optionCounts.entries())
    .map(([option, count]) => ({
      option,
      count,
      percentage: (count / totalResponses) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // Combination analysis
  const combinationCounts = new Map<string, number>();
  parsedResponses.forEach(response => {
    const sortedSelections = response.selections.sort();
    const combinationKey = sortedSelections.join(' + ');
    combinationCounts.set(combinationKey, (combinationCounts.get(combinationKey) || 0) + 1);
  });

  const combinations = Array.from(combinationCounts.entries())
    .map(([combinationStr, count]) => ({
      combination: combinationStr.split(' + '),
      count,
      percentage: (count / totalResponses) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20 combinations

  // Selection count distribution
  const selectionCounts = new Map<number, number>();
  parsedResponses.forEach(response => {
    const count = response.selections.length;
    selectionCounts.set(count, (selectionCounts.get(count) || 0) + 1);
  });

  const selectionDistribution = Array.from(selectionCounts.entries())
    .map(([selectionCount, responseCount]) => ({
      selectionCount,
      responseCount,
      percentage: (responseCount / totalResponses) * 100,
    }))
    .sort((a, b) => a.selectionCount - b.selectionCount);

  // Average selections
  const totalSelections = parsedResponses.reduce((sum, r) => sum + r.selections.length, 0);
  const averageSelections = totalResponses > 0 ? totalSelections / totalResponses : 0;

  // Correlation analysis (co-occurrence)
  const correlations: Array<{ option1: string; option2: string; correlation: number }> = [];
  const uniqueOptions = Array.from(optionCounts.keys());

  for (let i = 0; i < uniqueOptions.length; i++) {
    for (let j = i + 1; j < uniqueOptions.length; j++) {
      const option1 = uniqueOptions[i];
      const option2 = uniqueOptions[j];

      let coOccurrence = 0;
      parsedResponses.forEach(response => {
        if (response.selections.includes(option1) && response.selections.includes(option2)) {
          coOccurrence++;
        }
      });

      const option1Count = optionCounts.get(option1) || 0;
      const option2Count = optionCounts.get(option2) || 0;

      // Calculate correlation coefficient (simplified)
      const expectedCoOccurrence = (option1Count * option2Count) / totalResponses;
      const correlation = expectedCoOccurrence > 0 ? coOccurrence / expectedCoOccurrence : 0;

      if (correlation > 1.2) { // Only include strong correlations
        correlations.push({ option1, option2, correlation });
      }
    }
  }

  correlations.sort((a, b) => b.correlation - a.correlation);

  return {
    fieldId,
    fieldType: FieldType.CHECKBOX_FIELD,
    fieldLabel,
    totalResponses,
    responseRate: totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0,
    lastUpdated: new Date(),
    individualOptions,
    combinations,
    averageSelections: Math.round(averageSelections * 100) / 100,
    selectionDistribution,
    correlations: correlations.slice(0, 10),
  };
};
