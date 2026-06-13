import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
import {
  uploadTemporaryFile,
  deleteTemporaryFile,
  cleanupExpiredFiles,
  startPeriodicCleanup,
} from '../temporaryFileService.js';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Config } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();
  const mockS3Client = {
    send: mockSend,
  };
  return {
    S3Client: vi.fn(function() {
      return mockS3Client;
    }),
    PutObjectCommand: vi.fn(function(this: any, params: any) {
      this.input = params;
    }),
    DeleteObjectCommand: vi.fn(function(this: any, params: any) {
      this.input = params;
    }),
    GetObjectCommand: vi.fn(function(this: any, params: any) {
      this.input = params;
    }),
    ListObjectsV2Command: vi.fn(function(this: any, params: any) {
      this.input = params;
    }),
    __mockSend: mockSend, // Export mockSend so we can access it
  };
});
vi.mock('@aws-sdk/s3-request-presigner');
vi.mock('../../lib/env.js');

const { __mockSend: mockSend } = await import('@aws-sdk/client-s3') as any;

describe('Temporary File Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSend.mockReset();
    vi.mocked(s3Config).endpoint = 'https://test.r2.cloudflarestorage.com';
    vi.mocked(s3Config).accessKey = 'test-access-key';
    vi.mocked(s3Config).secretKey = 'test-secret-key';
    vi.mocked(s3Config).privateBucketName = 'test-private-bucket';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('uploadTemporaryFile', () => {
    it('should upload file and return signed URL', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('test data');
      const result = await uploadTemporaryFile(buffer, 'report.xlsx');

      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 5 * 60 * 60 }
      );
      expect(result).toMatchObject({
        downloadUrl: 'https://signed-url.example.com/file.xlsx',
        expiresAt: expect.any(Date),
      });
      expect(result.fileKey).toContain('temp-exports/');
      expect(result.fileKey).toContain('report.xlsx');
    });

    it('should use custom content type', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.pdf');

      const buffer = Buffer.from('pdf data');
      await uploadTemporaryFile(buffer, 'document.pdf', 'application/pdf');

      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input.ContentType).toBe('application/pdf');
    });

    it('should use default content type for Excel files', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('excel data');
      await uploadTemporaryFile(buffer, 'report.xlsx');

      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input.ContentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });

    it('should set expiration to 5 hours from now', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const now = Date.now();
      vi.setSystemTime(now);

      const buffer = Buffer.from('test data');
      const result = await uploadTemporaryFile(buffer, 'report.xlsx');

      const expectedExpiry = new Date(now + 5 * 60 * 60 * 1000);
      expect(result.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });

    it('should set correct S3 metadata', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('test data');
      await uploadTemporaryFile(buffer, 'report.xlsx');

      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input.Metadata).toMatchObject({
        'export-type': 'excel-report',
        'auto-cleanup': 'true',
      });
      expect(putCommand.input.Metadata['expires-at']).toBeDefined();
    });

    it('should set content disposition with filename', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('test data');
      await uploadTemporaryFile(buffer, 'my-report.xlsx');

      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input.ContentDisposition).toBe('attachment; filename="my-report.xlsx"');
    });

    it('should use private bucket', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('test data');
      await uploadTemporaryFile(buffer, 'report.xlsx');

      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input.Bucket).toBe('test-private-bucket');
    });

    it('should not schedule a per-upload cleanup timer (P3-06: periodic cleanup replaces per-upload timers)', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('test data');
      await uploadTemporaryFile(buffer, 'report.xlsx');

      // Fast-forward 5 hours — no individual timer should fire a DeleteObjectCommand
      vi.advanceTimersByTime(5 * 60 * 60 * 1000);
      await vi.runAllTimersAsync();

      // Only PutObjectCommand and GetObjectCommand should have been called, no DeleteObjectCommand
      expect(mockSend).not.toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('should handle upload errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('S3 upload failed'));

      const buffer = Buffer.from('test data');

      await expect(uploadTemporaryFile(buffer, 'report.xlsx')).rejects.toThrow(
        'Failed to upload temporary file: S3 upload failed'
      );

      expect(loggerError).toHaveBeenCalledWith('Error uploading temporary file:', expect.any(Error));
      loggerError.mockRestore();
    });

    it('should handle signed URL generation errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockRejectedValue(new Error('Signed URL failed'));

      const buffer = Buffer.from('test data');

      await expect(uploadTemporaryFile(buffer, 'report.xlsx')).rejects.toThrow(
        'Failed to upload temporary file: Signed URL failed'
      );

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('deleteTemporaryFile', () => {
    it('should delete file successfully', async () => {
      mockSend.mockResolvedValue({});

      const result = await deleteTemporaryFile('temp-exports/file.xlsx');

      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
      expect(result).toBe(true);
    });

    it('should use correct bucket and key', async () => {
      mockSend.mockResolvedValue({});

      await deleteTemporaryFile('temp-exports/report.xlsx');

      const deleteCommand = mockSend.mock.calls[0][0];
      expect(deleteCommand.input).toMatchObject({
        Bucket: 'test-private-bucket',
        Key: 'temp-exports/report.xlsx',
      });
    });

    it('should log success message', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});
      mockSend.mockResolvedValue({});

      await deleteTemporaryFile('temp-exports/file.xlsx');

      expect(loggerInfo).toHaveBeenCalledWith('Temporary file deleted: temp-exports/file.xlsx');
      loggerInfo.mockRestore();
    });

    it('should handle deletion errors gracefully', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('Delete failed'));

      const result = await deleteTemporaryFile('temp-exports/file.xlsx');

      expect(result).toBe(false);
      expect(loggerError).toHaveBeenCalledWith(
        'Error deleting temporary file temp-exports/file.xlsx:',
        expect.any(Error)
      );
      loggerError.mockRestore();
    });
  });

  describe('startPeriodicCleanup (P3-06)', () => {
    it('should run cleanup immediately on startup', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});
      // ListObjectsV2Command returns empty list
      mockSend.mockResolvedValue({ Contents: [], IsTruncated: false });

      startPeriodicCleanup();

      // Advance just enough time to let the immediate cleanup promise resolve
      // without triggering the 30-minute interval
      await vi.advanceTimersByTimeAsync(100);

      expect(loggerInfo).toHaveBeenCalledWith(
        'Temp-file cleanup complete: 0 deleted, 0 errors'
      );
      loggerInfo.mockRestore();
    });

    it('should run cleanup again after 30 minutes', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});
      mockSend.mockResolvedValue({ Contents: [], IsTruncated: false });

      startPeriodicCleanup();

      // Flush the startup cleanup (small advance to avoid triggering 30-min interval)
      await vi.advanceTimersByTimeAsync(100);

      // Advance 30 minutes to trigger interval
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      // cleanup complete logged at least twice (startup + interval)
      const calls = vi.mocked(loggerInfo).mock.calls.filter(
        (call) => call[0] === 'Temp-file cleanup complete: 0 deleted, 0 errors'
      );
      expect(calls.length).toBeGreaterThanOrEqual(2);
      loggerInfo.mockRestore();
    });
  });

  describe('cleanupExpiredFiles', () => {
    it('should log cleanup task message', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});
      mockSend.mockResolvedValue({ Contents: [], IsTruncated: false });

      await cleanupExpiredFiles();

      expect(loggerInfo).toHaveBeenCalledWith(
        'Temp-file cleanup complete: 0 deleted, 0 errors'
      );
      loggerInfo.mockRestore();
    });

    it('should complete without errors', async () => {
      mockSend.mockResolvedValue({ Contents: [], IsTruncated: false });
      await expect(cleanupExpiredFiles()).resolves.toEqual({ deleted: 0, errors: 0 });
    });

    it('should delete expired files and increment deleted count', async () => {
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);
      const expiredTs = now - 6 * 60 * 60 * 1000;
      const expiredKey = `temp-exports/${expiredTs}-uuid-report.xlsx`;

      // First call: ListObjectsV2Command returns expired file
      mockSend.mockResolvedValueOnce({ Contents: [{ Key: expiredKey }], IsTruncated: false });
      // Second call: DeleteObjectCommand from deleteTemporaryFile
      mockSend.mockResolvedValueOnce({});

      const result = await cleanupExpiredFiles();

      expect(result.deleted).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should skip non-expired files', async () => {
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);
      const freshTs = now - 1 * 60 * 60 * 1000; // only 1 hour old
      const freshKey = `temp-exports/${freshTs}-uuid-recent.xlsx`;

      mockSend.mockResolvedValue({ Contents: [{ Key: freshKey }], IsTruncated: false });

      const result = await cleanupExpiredFiles();

      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should skip objects with no Key', async () => {
      mockSend.mockResolvedValue({ Contents: [{}], IsTruncated: false });

      const result = await cleanupExpiredFiles();

      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should increment errors when deleteTemporaryFile fails', async () => {
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);
      const expiredTs = now - 6 * 60 * 60 * 1000;
      const expiredKey = `temp-exports/${expiredTs}-uuid-report.xlsx`;

      mockSend.mockResolvedValueOnce({ Contents: [{ Key: expiredKey }], IsTruncated: false });
      // DeleteObjectCommand fails
      mockSend.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await cleanupExpiredFiles();

      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(1);
    });

    it('should follow pagination via NextContinuationToken', async () => {
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);
      const expiredTs = now - 6 * 60 * 60 * 1000;

      // Page 1: one expired file, truncated
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: `temp-exports/${expiredTs}-uuid-page1.xlsx` }],
        IsTruncated: true,
        NextContinuationToken: 'token1',
      });
      // DeleteObjectCommand for page-1 file
      mockSend.mockResolvedValueOnce({});
      // Page 2: one expired file, not truncated
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: `temp-exports/${expiredTs}-uuid-page2.xlsx` }],
        IsTruncated: false,
      });
      // DeleteObjectCommand for page-2 file
      mockSend.mockResolvedValueOnce({});

      const result = await cleanupExpiredFiles();

      expect(result.deleted).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should capture exception via Sentry when list command throws', async () => {
      const { captureException } = await import('@sentry/node');
      mockSend.mockRejectedValue(new Error('S3 list error'));

      const result = await cleanupExpiredFiles();

      expect(captureException).toHaveBeenCalledWith(expect.any(Error));
      // Still returns counts even on error
      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(0);
    });
  });
});
