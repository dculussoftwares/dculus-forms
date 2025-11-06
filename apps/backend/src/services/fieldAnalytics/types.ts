/**
 * Field Analytics Type Definitions
 *
 * Common types and interfaces used across field analytics services.
 */

import { FieldType } from '@dculus/types';

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
