import { FieldType } from '@dculus/types';
import { prisma } from '../lib/prisma.js';
import { createHash } from 'crypto';

// Cache configuration
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds
const CACHE_PREFIX = 'field_analytics:';
const FORM_CACHE_PREFIX = 'form_responses:';

// Simple in-memory cache (could be replaced with Redis in production)
const cache = new Map<string, { data: any; expires: number }>();

// Cache utilities
const getCacheKey = (type: string, ...keys: string[]): string => {
  const keyString = keys.join(':');
  return `${type}${createHash('md5').update(keyString).digest('hex')}`;
};

const getFromCache = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }
  if (cached) {
    cache.delete(key); // Clean up expired entries
  }
  return null;
};

const setCache = <T>(key: string, data: T, ttl: number = CACHE_TTL): void => {
  cache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
};

const invalidateFormCache = (formId: string): void => {
  const formCachePattern = getCacheKey(FORM_CACHE_PREFIX, formId);
  const fieldCachePattern = getCacheKey(CACHE_PREFIX, formId);
  
  // Remove all cache entries for this form
  for (const [key] of cache) {
    if (key.includes(formId)) {
      cache.delete(key);
    }
  }
};

export interface FieldResponse {
  value: any;
  submittedAt: Date;
  responseId: string;
}

export interface TextFieldAnalytics {
  totalResponses: number;
  averageLength: number;
  minLength: number;
  maxLength: number;
  wordCloud: Array<{ word: string; count: number; weight: number }>;
  lengthDistribution: Array<{ range: string; count: number }>;
  commonPhrases: Array<{ phrase: string; count: number }>;
  recentResponses: Array<{ value: string; submittedAt: Date; responseId: string }>;
}

export interface NumberFieldAnalytics {
  totalResponses: number;
  min: number;
  max: number;
  average: number;
  median: number;
  standardDeviation: number;
  distribution: Array<{ range: string; count: number; percentage: number }>;
  trend: Array<{ date: string; average: number; count: number }>;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
}

export interface SelectionFieldAnalytics {
  totalResponses: number;
  options: Array<{
    option: string;
    count: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    options: Array<{ option: string; count: number }>;
  }>;
  topOption: string;
  responseDistribution: 'even' | 'concentrated' | 'polarized';
}

export interface CheckboxFieldAnalytics {
  totalResponses: number;
  individualOptions: Array<{
    option: string;
    count: number;
    percentage: number;
  }>;
  combinations: Array<{
    combination: string[];
    count: number;
    percentage: number;
  }>;
  averageSelections: number;
  selectionDistribution: Array<{
    selectionCount: number;
    responseCount: number;
    percentage: number;
  }>;
  correlations: Array<{
    option1: string;
    option2: string;
    correlation: number;
  }>;
}

export interface DateFieldAnalytics {
  totalResponses: number;
  earliestDate: Date;
  latestDate: Date;
  mostCommonDate: Date;
  dateDistribution: Array<{
    date: string;
    count: number;
  }>;
  weekdayDistribution: Array<{
    weekday: string;
    count: number;
    percentage: number;
  }>;
  monthlyDistribution: Array<{
    month: string;
    count: number;
    percentage: number;
  }>;
  seasonalPatterns: Array<{
    season: string;
    count: number;
    percentage: number;
  }>;
}

export interface EmailFieldAnalytics {
  totalResponses: number;
  validEmails: number;
  invalidEmails: number;
  validationRate: number;
  domains: Array<{
    domain: string;
    count: number;
    percentage: number;
  }>;
  topLevelDomains: Array<{
    tld: string;
    count: number;
    percentage: number;
  }>;
  corporateVsPersonal: {
    corporate: number;
    personal: number;
    unknown: number;
  };
  popularProviders: Array<{
    provider: string;
    count: number;
    percentage: number;
  }>;
}

export interface FieldAnalyticsBase {
  fieldId: string;
  fieldType: FieldType;
  fieldLabel: string;
  totalResponses: number;
  responseRate: number; // percentage of total form submissions
  lastUpdated: Date;
}

export type FieldAnalytics = FieldAnalyticsBase & (
  | ({ fieldType: FieldType.TEXT_INPUT_FIELD | FieldType.TEXT_AREA_FIELD } & TextFieldAnalytics)
  | ({ fieldType: FieldType.NUMBER_FIELD } & NumberFieldAnalytics)
  | ({ fieldType: FieldType.SELECT_FIELD | FieldType.RADIO_FIELD } & SelectionFieldAnalytics)
  | ({ fieldType: FieldType.CHECKBOX_FIELD } & CheckboxFieldAnalytics)
  | ({ fieldType: FieldType.DATE_FIELD } & DateFieldAnalytics)
  | ({ fieldType: FieldType.EMAIL_FIELD } & EmailFieldAnalytics)
);

/**
 * Get all responses for a specific form and extract field values (with caching)
 */
export const getFormResponses = async (formId: string): Promise<Array<{
  responseId: string;
  data: Record<string, any>;
  submittedAt: Date;
}>> => {
  const cacheKey = getCacheKey(FORM_CACHE_PREFIX, formId);
  
  // Check cache first
  const cached = getFromCache<Array<{
    responseId: string;
    data: Record<string, any>;
    submittedAt: Date;
  }>>(cacheKey);
  
  if (cached) {
    return cached;
  }

  // If not cached, fetch from database
  const responses = await prisma.response.findMany({
    where: { formId },
    select: {
      id: true,
      data: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: 'desc' },
  });

  const result = responses.map(response => ({
    responseId: response.id,
    data: response.data as Record<string, any>,
    submittedAt: response.submittedAt,
  }));

  // Cache the result
  setCache(cacheKey, result);
  
  return result;
};

/**
 * Extract field values from form responses
 */
export const extractFieldValues = (
  responses: Array<{ responseId: string; data: Record<string, any>; submittedAt: Date }>,
  fieldId: string
): FieldResponse[] => {
  return responses
    .map(response => ({
      value: response.data[fieldId],
      submittedAt: response.submittedAt,
      responseId: response.responseId,
    }))
    .filter(item => item.value !== undefined && item.value !== null && item.value !== '');
};

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

/**
 * Process email field analytics
 */
export const processEmailFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number
): FieldAnalyticsBase & EmailFieldAnalytics => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails = fieldResponses.map(r => String(r.value || '').trim().toLowerCase()).filter(e => e.length > 0);
  const totalResponses = emails.length;

  // Validation
  const validEmails = emails.filter(email => emailPattern.test(email));
  const invalidEmails = totalResponses - validEmails.length;
  const validationRate = totalResponses > 0 ? (validEmails.length / totalResponses) * 100 : 0;

  // Domain analysis
  const domainCounts = new Map<string, number>();
  const tldCounts = new Map<string, number>();
  
  validEmails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      
      const tld = domain.split('.').pop();
      if (tld) {
        tldCounts.set(tld, (tldCounts.get(tld) || 0) + 1);
      }
    }
  });

  const domains = Array.from(domainCounts.entries())
    .map(([domain, count]) => ({
      domain,
      count,
      percentage: (count / validEmails.length) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topLevelDomains = Array.from(tldCounts.entries())
    .map(([tld, count]) => ({
      tld,
      count,
      percentage: (count / validEmails.length) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // Popular email providers
  const popularProviderDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com'
  ];

  const providerCounts = new Map<string, number>();
  validEmails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain && popularProviderDomains.includes(domain)) {
      const provider = domain.replace('.com', '').replace('.', '');
      providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
    }
  });

  const popularProviders = Array.from(providerCounts.entries())
    .map(([provider, count]) => ({
      provider,
      count,
      percentage: (count / validEmails.length) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // Corporate vs Personal analysis
  const corporateDomains = new Set();
  const personalDomains = new Set(popularProviderDomains);
  
  let corporate = 0;
  let personal = 0;
  let unknown = 0;

  validEmails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain) {
      if (personalDomains.has(domain)) {
        personal++;
      } else if (corporateDomains.has(domain)) {
        corporate++;
      } else {
        // Heuristic: if domain appears only once or twice, likely personal
        // If appears multiple times, likely corporate
        const domainCount = domainCounts.get(domain) || 0;
        if (domainCount >= 3) {
          corporate++;
          corporateDomains.add(domain);
        } else {
          unknown++;
        }
      }
    }
  });

  return {
    fieldId,
    fieldType: FieldType.EMAIL_FIELD,
    fieldLabel,
    totalResponses,
    responseRate: totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0,
    lastUpdated: new Date(),
    validEmails: validEmails.length,
    invalidEmails,
    validationRate: Math.round(validationRate * 100) / 100,
    domains,
    topLevelDomains,
    corporateVsPersonal: { corporate, personal, unknown },
    popularProviders,
  };
};

/**
 * Main function to get field analytics for any field type (with caching)
 */
export const getFieldAnalytics = async (
  formId: string,
  fieldId: string,
  fieldType: FieldType,
  fieldLabel: string
): Promise<FieldAnalytics> => {
  const cacheKey = getCacheKey(CACHE_PREFIX, formId, fieldId, fieldType.toString());
  
  // Check cache first
  const cached = getFromCache<FieldAnalytics>(cacheKey);
  if (cached) {
    return cached;
  }

  // Get all form responses
  const responses = await getFormResponses(formId);
  const totalFormResponses = responses.length;
  
  // Extract field values
  const fieldResponses = extractFieldValues(responses, fieldId);

  let result: FieldAnalytics;

  // Process based on field type
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
      result = {
        ...processTextFieldAnalytics(fieldResponses, fieldId, fieldLabel, totalFormResponses),
        fieldType,
      } as FieldAnalytics;
      break;

    case FieldType.NUMBER_FIELD:
      result = processNumberFieldAnalytics(fieldResponses, fieldId, fieldLabel, totalFormResponses) as FieldAnalytics;
      break;

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
      result = {
        ...processSelectionFieldAnalytics(fieldResponses, fieldId, fieldLabel, totalFormResponses),
        fieldType,
      } as FieldAnalytics;
      break;

    case FieldType.CHECKBOX_FIELD:
      result = processCheckboxFieldAnalytics(fieldResponses, fieldId, fieldLabel, totalFormResponses) as FieldAnalytics;
      break;

    case FieldType.DATE_FIELD:
      result = processDateFieldAnalytics(fieldResponses, fieldId, fieldLabel, totalFormResponses) as FieldAnalytics;
      break;

    case FieldType.EMAIL_FIELD:
      result = processEmailFieldAnalytics(fieldResponses, fieldId, fieldLabel, totalFormResponses) as FieldAnalytics;
      break;

    default:
      throw new Error(`Unsupported field type: ${fieldType}`);
  }

  // Cache the result
  setCache(cacheKey, result);
  
  return result;
};

/**
 * Get form schema from collaborative document if main schema is empty
 */
const getFormSchemaFromCollaborative = async (formId: string): Promise<any> => {
  try {
    // Query the collaborative_document collection directly
    const result = await prisma.$runCommandRaw({
      find: 'collaborative_document',
      filter: { _id: `collab-${formId}` }
    });

    if (result.cursor.firstBatch.length === 0) {
      return null;
    }

    const doc = result.cursor.firstBatch[0];
    
    // For now, we can't easily decode YJS binary data in Node.js without additional libraries
    // But we can check if the document exists and has data
    if (doc.state && doc.state.$binary) {
      console.log(`Found collaborative document for form ${formId}, but YJS binary decoding not implemented yet`);
      // TODO: Implement YJS binary state decoding to extract form schema
      // This would require importing YJS and decoding the binary state
      return null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching collaborative document for form ${formId}:`, error);
    return null;
  }
};

/**
 * Get analytics for all fields in a form (with caching and optimizations)
 */
export const getAllFieldsAnalytics = async (formId: string): Promise<{
  formId: string;
  totalResponses: number;
  fields: FieldAnalytics[];
}> => {
  const cacheKey = getCacheKey(CACHE_PREFIX, formId, 'all_fields');
  
  // Check cache first
  const cached = getFromCache<{
    formId: string;
    totalResponses: number;
    fields: FieldAnalytics[];
  }>(cacheKey);
  
  if (cached) {
    return cached;
  }

  // First, get the form to extract field information
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { formSchema: true },
  });

  if (!form) {
    throw new Error(`Form not found: ${formId}`);
  }

  let formSchema = form.formSchema as any;
  
  // If the form schema is empty, try to get it from collaborative document
  if (!formSchema || Object.keys(formSchema).length === 0) {
    console.log(`Form ${formId} has empty schema, checking collaborative document...`);
    const collaborativeSchema = await getFormSchemaFromCollaborative(formId);
    if (collaborativeSchema) {
      formSchema = collaborativeSchema;
    } else {
      // For now, return empty result with a helpful message
      console.log(`No schema found in collaborative document for form ${formId}. This form may not have been edited yet.`);
      return {
        formId,
        totalResponses: 0,
        fields: [],
      };
    }
  }
  
  const responses = await getFormResponses(formId); // This is cached
  const totalResponses = responses.length;

  // Extract all fields from all pages
  const allFields: Array<{ id: string; type: FieldType; label: string }> = [];
  
  if (formSchema.pages) {
    formSchema.pages.forEach((page: any) => {
      if (page.fields) {
        page.fields.forEach((field: any) => {
          // Only process fillable fields
          if (field.type !== FieldType.RICH_TEXT_FIELD && field.type !== FieldType.FORM_FIELD) {
            allFields.push({
              id: field.id,
              type: field.type,
              label: field.label || `Field ${field.id}`,
            });
          }
        });
      }
    });
  }

  // Process fields in batches to avoid overwhelming the system
  const batchSize = 5;
  const fieldAnalytics: FieldAnalytics[] = [];
  
  for (let i = 0; i < allFields.length; i += batchSize) {
    const batch = allFields.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(field =>
        getFieldAnalytics(formId, field.id, field.type, field.label)
      )
    );
    fieldAnalytics.push(...batchResults);
  }

  const result = {
    formId,
    totalResponses,
    fields: fieldAnalytics,
  };

  // Cache the result
  setCache(cacheKey, result);

  return result;
};

/**
 * Invalidate all cache entries for a specific form
 * Call this when form responses are updated
 */
export const invalidateFieldAnalyticsCache = (formId: string): void => {
  invalidateFormCache(formId);
};

/**
 * Get cache statistics for monitoring
 */
export const getCacheStats = (): {
  totalEntries: number;
  expiredEntries: number;
  totalMemoryUsage: number;
} => {
  const now = Date.now();
  let expiredEntries = 0;
  let totalMemoryUsage = 0;
  
  for (const [key, value] of cache) {
    if (value.expires <= now) {
      expiredEntries++;
    }
    // Rough estimate of memory usage
    totalMemoryUsage += JSON.stringify(value).length;
  }
  
  return {
    totalEntries: cache.size,
    expiredEntries,
    totalMemoryUsage,
  };
};

/**
 * Clear expired cache entries (run periodically)
 */
export const cleanupCache = (): number => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, value] of cache) {
    if (value.expires <= now) {
      cache.delete(key);
      cleanedCount++;
    }
  }
  
  return cleanedCount;
};

// Set up periodic cache cleanup (every 10 minutes)
setInterval(cleanupCache, 10 * 60 * 1000);