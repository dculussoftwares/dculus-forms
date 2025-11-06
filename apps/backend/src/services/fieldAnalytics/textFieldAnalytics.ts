/**
 * Text Field Analytics Processor
 *
 * Processes analytics for TEXT_INPUT_FIELD and TEXT_AREA_FIELD types.
 */

import { FieldType } from '@dculus/types';
import { FieldResponse, FieldAnalyticsBase, TextFieldAnalytics } from './types.js';

/**
 * Process text field analytics (TextInput, TextArea)
 */
export const processTextFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number
): FieldAnalyticsBase & TextFieldAnalytics => {
  const values = fieldResponses.map(r => String(r.value || ''));
  const lengths = values.map(v => v.length);

  // Basic statistics
  const totalResponses = fieldResponses.length;
  const averageLength = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const minLength = lengths.length > 0 ? Math.min(...lengths) : 0;
  const maxLength = lengths.length > 0 ? Math.max(...lengths) : 0;

  // Word frequency analysis
  const wordMap = new Map<string, number>();
  const phraseMap = new Map<string, number>();

  values.forEach(text => {
    // Word analysis (split by spaces, remove punctuation, convert to lowercase)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2); // Filter out short words

    words.forEach(word => {
      wordMap.set(word, (wordMap.get(word) || 0) + 1);
    });

    // Phrase analysis (2-3 word combinations)
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words.slice(i, i + 2).join(' ');
      if (phrase.length > 5) {
        phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
      }
    }
  });

  // Sort and limit word cloud
  const wordCloud = Array.from(wordMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({
      word,
      count,
      weight: count / Math.max(...wordMap.values()),
    }));

  const commonPhrases = Array.from(phraseMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase, count]) => ({ phrase, count }));

  // Length distribution
  const lengthRanges = [
    { min: 0, max: 10, label: '0-10' },
    { min: 11, max: 25, label: '11-25' },
    { min: 26, max: 50, label: '26-50' },
    { min: 51, max: 100, label: '51-100' },
    { min: 101, max: 200, label: '101-200' },
    { min: 201, max: Infinity, label: '200+' },
  ];

  const lengthDistribution = lengthRanges.map(range => ({
    range: range.label,
    count: lengths.filter(len => len >= range.min && len <= range.max).length,
  }));

  // Recent responses (last 10)
  const recentResponses = fieldResponses
    .slice(0, 10)
    .map(r => ({
      value: String(r.value),
      submittedAt: r.submittedAt,
      responseId: r.responseId,
    }));

  return {
    fieldId,
    fieldType: FieldType.TEXT_INPUT_FIELD, // Will be overridden by caller
    fieldLabel,
    totalResponses,
    responseRate: totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0,
    lastUpdated: new Date(),
    averageLength: Math.round(averageLength * 100) / 100,
    minLength,
    maxLength,
    wordCloud,
    lengthDistribution,
    commonPhrases,
    recentResponses,
  };
};
