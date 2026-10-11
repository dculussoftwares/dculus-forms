import { describe, it, expect, vi } from 'vitest';
import { FieldType } from '@dculus/types';

vi.mock('../../responseFiles/responseFileCatalog.js', () => ({
  fileNameFromKey: (key: string) => key.split('/').pop() ?? key,
}));

import { processFileUploadFieldAnalytics } from '../fileUploadFieldAnalytics.js';

const MB = 1024 * 1024;

const response = (responseId: string, value: unknown, submittedAt: string) => ({
  responseId,
  value,
  submittedAt: new Date(submittedAt),
});

const record = (originalName: string, size: number, mimeType: string) => ({ originalName, size, mimeType });

describe('processFileUploadFieldAnalytics', () => {
  const fieldResponses = [
    response('r1', ['k/a.pdf', 'k/b.png'], '2026-01-01T10:00:00Z'),
    response('r2', ['k/c.pdf'], '2026-01-01T12:00:00Z'),
    response('r3', ['k/d.zip'], '2026-01-03T09:00:00Z'),
    response('r4', [], '2026-01-04T09:00:00Z'),
  ];
  const records = new Map([
    ['k/a.pdf', record('a.pdf', 50 * 1024, 'application/pdf')],
    ['k/b.png', record('b.png', 2 * MB, 'image/png')],
    ['k/c.pdf', record('c.pdf', 4.8 * MB, 'application/pdf')],
    ['k/d.zip', record('d.zip', 30 * MB, 'application/zip')],
  ]);

  const run = (config = {}, totalFormResponses = 5) =>
    processFileUploadFieldAnalytics(fieldResponses, 'f1', 'Upload', totalFormResponses, records, config);

  it('keeps the base counts', () => {
    const result = run();

    expect(result.fieldType).toBe(FieldType.FILE_UPLOAD_FIELD);
    expect(result.totalFilesUploaded).toBe(4);
    expect(result.responsesWithFiles).toBe(3);
    expect(result.responsesWithoutFiles).toBe(1);
    expect(result.extensionDistribution.find((e) => e.extension === 'pdf')?.count).toBe(2);
  });

  it('computes size totals, average and largest file', () => {
    const result = run();

    expect(result.filesWithKnownSize).toBe(4);
    expect(result.totalBytes).toBeCloseTo(50 * 1024 + 2 * MB + 4.8 * MB + 30 * MB);
    expect(result.averageFileSize).toBeCloseTo(result.totalBytes / 4);
    expect(result.largestFile).toMatchObject({ key: 'k/d.zip', originalName: 'd.zip', responseId: 'r3' });
  });

  it('buckets files by size', () => {
    const buckets = Object.fromEntries(run().sizeDistribution.map((b) => [b.bucket, b.count]));

    expect(buckets).toEqual({ lt100kb: 1, lt1mb: 0, lt5mb: 2, lt25mb: 0, gte25mb: 1 });
  });

  it('groups files by category using mime type first', () => {
    const categories = Object.fromEntries(run().categoryDistribution.map((c) => [c.category, c.count]));

    expect(categories).toEqual({ pdf: 2, image: 1, archive: 1 });
  });

  it('counts the 0-file bucket from form responses that skipped the question', () => {
    const distribution = run().filesPerResponseDistribution;

    expect(distribution).toEqual([
      { fileCount: 0, responseCount: 2, percentage: 40 },
      { fileCount: 1, responseCount: 2, percentage: 40 },
      { fileCount: 2, responseCount: 1, percentage: 20 },
    ]);
  });

  it('builds a daily upload trend, oldest first', () => {
    const trend = run().uploadTrend;

    expect(trend.map((p) => [p.date, p.files])).toEqual([
      ['2026-01-01', 3],
      ['2026-01-03', 1],
    ]);
  });

  it('lists the most recent files first', () => {
    const recent = run().recentFiles;

    expect(recent[0].key).toBe('k/d.zip');
    expect(recent).toHaveLength(4);
  });

  it('reports usage against the field limits', () => {
    const { limits } = run({ maxFileSizeMb: 5, maxFiles: 2, allowedMimeTypes: ['application/pdf', 'image/*'] });

    expect(limits.maxFilesInSingleResponse).toBe(2);
    expect(limits.responsesAtFileLimit).toBe(1);
    // Only the 4.8MB file is within 10% of the 5MB limit; the 30MB zip is over it, not near it
    expect(limits.filesNearSizeLimit).toBe(1);
    expect(limits.filesOutsideAllowedTypes).toBe(1);
  });

  it('falls back to the limits respondents face when the field sets none', () => {
    const { limits } = run();

    expect(limits).toMatchObject({
      maxFileSizeMb: 5,
      maxFiles: 1,
      filesNearSizeLimit: 1,
      responsesAtFileLimit: 3,
      filesOutsideAllowedTypes: 0,
    });
  });

  it('handles a very large number of responses', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => response(`r${i}`, ['k/a.pdf'], '2026-01-01T10:00:00Z'));

    const result = processFileUploadFieldAnalytics(many, 'f1', 'Upload', many.length, records);

    expect(result.limits.maxFilesInSingleResponse).toBe(1);
  });

  it('excludes files without a recorded size from size statistics', () => {
    const result = processFileUploadFieldAnalytics(
      [response('r1', ['k/x.pdf', 'k/y.pdf'], '2026-01-01T10:00:00Z')],
      'f1',
      'Upload',
      1,
      new Map([['k/x.pdf', record('x.pdf', MB, 'application/pdf')]])
    );

    expect(result.totalFilesUploaded).toBe(2);
    expect(result.filesWithKnownSize).toBe(1);
    expect(result.averageFileSize).toBe(MB);
    expect(result.recentFiles.find((f) => f.key === 'k/y.pdf')).toMatchObject({ size: null, originalName: 'y.pdf' });
  });

  it('returns empty stats when nothing was uploaded', () => {
    const result = processFileUploadFieldAnalytics([], 'f1', 'Upload', 0);

    expect(result.totalFilesUploaded).toBe(0);
    expect(result.largestFile).toBeNull();
    expect(result.filesPerResponseDistribution).toEqual([]);
    expect(result.uploadTrend).toEqual([]);
    expect(result.recentFiles).toEqual([]);
  });
});
