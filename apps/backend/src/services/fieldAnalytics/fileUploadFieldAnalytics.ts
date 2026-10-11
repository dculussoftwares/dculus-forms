/**
 * File Upload Field Analytics Processor
 *
 * Values are arrays of R2 file keys; size, type and original name come from the
 * FormFile records (see responseFileCatalog.loadFileRecords).
 */

import {
  FieldType,
  FILE_UPLOAD_DEFAULT_MAX_FILES,
  FILE_UPLOAD_DEFAULT_MAX_FILE_SIZE_MB,
} from '@dculus/types';
import { fileNameFromKey } from '../responseFiles/responseFileCatalog.js';
import type { FileRecord } from '../responseFiles/responseFileCatalog.js';
import {
  FieldAnalyticsBase,
  FieldResponse,
  FileCategory,
  FileSizeBucket,
  FileUploadFieldAnalytics,
  FileUploadFieldConfig,
  UploadedFileSummary,
} from './types.js';

const KB = 1024;
const MB = 1024 * KB;
const RECENT_FILES_LIMIT = 10;
const TREND_MAX_DAYS = 90;
const NEAR_LIMIT_RATIO = 0.9;

const SIZE_BUCKETS: Array<{ bucket: FileSizeBucket; max: number }> = [
  { bucket: 'lt100kb', max: 100 * KB },
  { bucket: 'lt1mb', max: MB },
  { bucket: 'lt5mb', max: 5 * MB },
  { bucket: 'lt25mb', max: 25 * MB },
  { bucket: 'gte25mb', max: Infinity },
];

const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', heic: 'image', svg: 'image',
  pdf: 'pdf',
  doc: 'document', docx: 'document', odt: 'document', rtf: 'document', pages: 'document',
  xls: 'spreadsheet', xlsx: 'spreadsheet', ods: 'spreadsheet', csv: 'spreadsheet', numbers: 'spreadsheet',
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation', key: 'presentation',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio',
  mp4: 'video', mov: 'video', webm: 'video', avi: 'video',
  txt: 'text', md: 'text', json: 'text',
};

const categorize = (extension: string, mimeType: string | null): FileCategory => {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType?.startsWith('audio/')) return 'audio';
  if (mimeType?.startsWith('video/')) return 'video';
  return EXTENSION_CATEGORIES[extension] ?? 'other';
};

const matchesAllowedType = (mimeType: string, allowed: string[]): boolean =>
  allowed.some((pattern) =>
    pattern.endsWith('/*') ? mimeType.startsWith(pattern.slice(0, -1)) : mimeType === pattern
  );

const extensionOf = (key: string): string => {
  const filename = key.split('/').pop() || '';
  const dotIdx = filename.lastIndexOf('.');
  return dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : 'unknown';
};

const percentOf = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);

interface UploadedFile extends UploadedFileSummary {
  extension: string;
}

export const processFileUploadFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number,
  fileRecords: Map<string, FileRecord> = new Map(),
  config: FileUploadFieldConfig = {}
): FieldAnalyticsBase & FileUploadFieldAnalytics => {
  const totalResponses = fieldResponses.length;

  const files: UploadedFile[] = [];
  const filesPerResponse: number[] = [];
  for (const response of fieldResponses) {
    const keys = Array.isArray(response.value)
      ? (response.value as unknown[]).filter((key): key is string => typeof key === 'string')
      : [];
    filesPerResponse.push(keys.length);
    for (const key of keys) {
      const record = fileRecords.get(key);
      files.push({
        key,
        responseId: response.responseId,
        submittedAt: response.submittedAt,
        originalName: record?.originalName || fileNameFromKey(key),
        size: record?.size ?? null,
        mimeType: record?.mimeType ?? null,
        extension: extensionOf(key),
      });
    }
  }

  const totalFilesUploaded = files.length;
  const responsesWithFiles = filesPerResponse.filter((count) => count > 0).length;
  const responsesWithoutFiles = totalResponses - responsesWithFiles;
  const averageFilesPerResponse = totalResponses > 0 ? totalFilesUploaded / totalResponses : 0;

  const extCounts = new Map<string, number>();
  files.forEach(({ extension }) => extCounts.set(extension, (extCounts.get(extension) || 0) + 1));
  const extensionDistribution = Array.from(extCounts.entries())
    .map(([extension, count]) => ({ extension, count, percentage: percentOf(count, totalFilesUploaded) }))
    .sort((a, b) => b.count - a.count);

  // Size statistics only cover files with a recorded size.
  const sized = files.filter((file): file is UploadedFile & { size: number } => file.size !== null);
  const totalBytes = sized.reduce((sum, file) => sum + file.size, 0);
  const averageFileSize = sized.length > 0 ? totalBytes / sized.length : 0;
  const largest = sized.reduce<(UploadedFile & { size: number }) | null>(
    (max, file) => (!max || file.size > max.size ? file : max),
    null
  );

  const sizeCounts = new Map<FileSizeBucket, number>();
  sized.forEach((file) => {
    const { bucket } = SIZE_BUCKETS.find(({ max }) => file.size < max)!;
    sizeCounts.set(bucket, (sizeCounts.get(bucket) || 0) + 1);
  });
  const sizeDistribution = SIZE_BUCKETS.map(({ bucket }) => ({
    bucket,
    count: sizeCounts.get(bucket) || 0,
    percentage: percentOf(sizeCounts.get(bucket) || 0, sized.length),
  }));

  const categoryStats = new Map<FileCategory, { count: number; bytes: number }>();
  files.forEach((file) => {
    const category = categorize(file.extension, file.mimeType);
    const stats = categoryStats.get(category) ?? { count: 0, bytes: 0 };
    stats.count += 1;
    stats.bytes += file.size ?? 0;
    categoryStats.set(category, stats);
  });
  const categoryDistribution = Array.from(categoryStats.entries())
    .map(([category, { count, bytes }]) => ({
      category,
      count,
      bytes,
      percentage: percentOf(count, totalFilesUploaded),
    }))
    .sort((a, b) => b.count - a.count);

  // Responses that skipped the question entirely land in the 0-file bucket.
  const countFrequency = new Map<number, number>();
  filesPerResponse.filter((count) => count > 0).forEach((count) =>
    countFrequency.set(count, (countFrequency.get(count) || 0) + 1)
  );
  const withoutAnyFiles = Math.max(0, totalFormResponses - responsesWithFiles);
  if (withoutAnyFiles > 0) countFrequency.set(0, withoutAnyFiles);
  const filesPerResponseDistribution = Array.from(countFrequency.entries())
    .map(([fileCount, responseCount]) => ({
      fileCount,
      responseCount,
      percentage: percentOf(responseCount, totalFormResponses),
    }))
    .sort((a, b) => a.fileCount - b.fileCount);

  const dailyUploads = new Map<string, { files: number; bytes: number }>();
  files.forEach((file) => {
    const date = new Date(file.submittedAt).toISOString().slice(0, 10);
    const day = dailyUploads.get(date) ?? { files: 0, bytes: 0 };
    day.files += 1;
    day.bytes += file.size ?? 0;
    dailyUploads.set(date, day);
  });
  const uploadTrend = Array.from(dailyUploads.entries())
    .map(([date, day]) => ({ date, ...day }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-TREND_MAX_DAYS);

  const toSummary = ({ extension: _extension, ...summary }: UploadedFile): UploadedFileSummary => summary;
  const recentFiles = [...files]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, RECENT_FILES_LIMIT)
    .map(toSummary);

  const maxFileSizeMb = config.maxFileSizeMb || FILE_UPLOAD_DEFAULT_MAX_FILE_SIZE_MB;
  const maxFiles = config.maxFiles || FILE_UPLOAD_DEFAULT_MAX_FILES;
  const allowedMimeTypes = config.allowedMimeTypes ?? [];
  const maxBytes = maxFileSizeMb * MB;

  return {
    fieldId,
    fieldType: FieldType.FILE_UPLOAD_FIELD,
    fieldLabel,
    totalResponses,
    responseRate: percentOf(totalResponses, totalFormResponses),
    lastUpdated: new Date(),
    totalFilesUploaded,
    averageFilesPerResponse,
    extensionDistribution,
    responsesWithFiles,
    responsesWithoutFiles,
    totalBytes,
    averageFileSize,
    filesWithKnownSize: sized.length,
    largestFile: largest ? toSummary(largest) : null,
    sizeDistribution,
    categoryDistribution,
    filesPerResponseDistribution,
    uploadTrend,
    recentFiles,
    limits: {
      maxFileSizeMb,
      maxFiles,
      allowedMimeTypes,
      maxFilesInSingleResponse: filesPerResponse.reduce((max, count) => Math.max(max, count), 0),
      // Files above the limit predate a lowered limit, so they are not "near" it.
      filesNearSizeLimit: sized.filter(
        (file) => file.size >= maxBytes * NEAR_LIMIT_RATIO && file.size <= maxBytes
      ).length,
      responsesAtFileLimit: filesPerResponse.filter((count) => count >= maxFiles).length,
      filesOutsideAllowedTypes:
        allowedMimeTypes.length > 0
          ? files.filter((file) => file.mimeType && !matchesAllowedType(file.mimeType, allowedMimeTypes)).length
          : 0,
    },
  };
};
