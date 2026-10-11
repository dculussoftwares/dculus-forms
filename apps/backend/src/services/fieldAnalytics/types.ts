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
  recentResponses: Array<{
    value: string;
    submittedAt: Date;
    responseId: string;
  }>;
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

export type FileCategory =
  | 'image'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'audio'
  | 'video'
  | 'text'
  | 'other';

export type FileSizeBucket = 'lt100kb' | 'lt1mb' | 'lt5mb' | 'lt25mb' | 'gte25mb';

export interface UploadedFileSummary {
  key: string;
  responseId: string;
  submittedAt: Date;
  originalName: string;
  size: number | null;
  mimeType: string | null;
}

export interface FileUploadFieldAnalytics {
  totalResponses: number;
  totalFilesUploaded: number;
  averageFilesPerResponse: number;
  extensionDistribution: Array<{
    extension: string;
    count: number;
    percentage: number;
  }>;
  responsesWithFiles: number;
  responsesWithoutFiles: number;
  /** Sum of known file sizes in bytes (files with no recorded size are skipped). */
  totalBytes: number;
  averageFileSize: number;
  filesWithKnownSize: number;
  largestFile: UploadedFileSummary | null;
  sizeDistribution: Array<{
    bucket: FileSizeBucket;
    count: number;
    percentage: number;
  }>;
  categoryDistribution: Array<{
    category: FileCategory;
    count: number;
    bytes: number;
    percentage: number;
  }>;
  filesPerResponseDistribution: Array<{
    fileCount: number;
    responseCount: number;
    percentage: number;
  }>;
  /** Daily uploads, oldest first, capped to the most recent 90 days with uploads. */
  uploadTrend: Array<{ date: string; files: number; bytes: number }>;
  recentFiles: UploadedFileSummary[];
  limits: {
    maxFileSizeMb: number;
    maxFiles: number;
    allowedMimeTypes: string[];
    maxFilesInSingleResponse: number;
    filesNearSizeLimit: number;
    responsesAtFileLimit: number;
    filesOutsideAllowedTypes: number;
  };
}

export interface FileUploadFieldConfig {
  maxFileSizeMb?: number;
  maxFiles?: number;
  allowedMimeTypes?: string[];
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

export type FieldAnalytics = FieldAnalyticsBase &
  (
    | ({
        fieldType:
          | FieldType.TEXT_INPUT_FIELD
          | FieldType.TEXT_AREA_FIELD
          | FieldType.PHONE_NUMBER_FIELD;
      } & TextFieldAnalytics)
    | ({ fieldType: FieldType.NUMBER_FIELD } & NumberFieldAnalytics)
    | ({
        fieldType: FieldType.SELECT_FIELD | FieldType.RADIO_FIELD;
      } & SelectionFieldAnalytics)
    | ({ fieldType: FieldType.CHECKBOX_FIELD } & CheckboxFieldAnalytics)
    | ({ fieldType: FieldType.DATE_FIELD } & DateFieldAnalytics)
    | ({ fieldType: FieldType.EMAIL_FIELD } & EmailFieldAnalytics)
    | ({ fieldType: FieldType.FILE_UPLOAD_FIELD } & FileUploadFieldAnalytics)
  );
