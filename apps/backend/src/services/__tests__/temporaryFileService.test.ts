import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadTemporaryFile,
  deleteTemporaryFile,
  cleanupExpiredFiles,
} from '../temporaryFileService.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
    PutObjectCommand: vi.fn(function(params) {
      this.input = params;
    }),
    DeleteObjectCommand: vi.fn(function(params) {
      this.input = params;
    }),
    GetObjectCommand: vi.fn(function(params) {
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

    it('should schedule cleanup after 5 hours', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('test data');
      const result = await uploadTemporaryFile(buffer, 'report.xlsx');

      // Fast-forward time by 5 hours
      vi.advanceTimersByTime(5 * 60 * 60 * 1000);

      // The cleanup should have been scheduled and executed
      await vi.runAllTimersAsync();

      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
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

  describe('scheduled cleanup', () => {
    it('should cleanup file after scheduled delay', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('test data');
      const result = await uploadTemporaryFile(buffer, 'report.xlsx');

      // Clear previous calls
      mockSend.mockClear();

      // Fast-forward to trigger cleanup
      vi.advanceTimersByTime(5 * 60 * 60 * 1000);
      await vi.runAllTimersAsync();

      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
      const deleteCommand = mockSend.mock.calls[0][0];
      expect(deleteCommand.input.Key).toBe(result.fileKey);

      loggerError.mockRestore();
    });

    it('should handle cleanup errors gracefully', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSend.mockResolvedValue({});
      vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.example.com/file.xlsx');

      const buffer = Buffer.from('test data');
      await uploadTemporaryFile(buffer, 'report.xlsx');

      // Make delete fail
      mockSend.mockRejectedValue(new Error('Delete failed'));

      // Fast-forward to trigger cleanup
      vi.advanceTimersByTime(5 * 60 * 60 * 1000);
      await vi.runAllTimersAsync();

      // The scheduleFileCleanup function calls deleteTemporaryFile which logs "Error deleting temporary file"
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting temporary file'),
        expect.any(Error)
      );

      loggerError.mockRestore();
    });
  });

  describe('cleanupExpiredFiles', () => {
    it('should log cleanup task message', async () => {
      const loggerInfo = vi.spyOn(logger, 'info').mockImplementation(() => {});

      await cleanupExpiredFiles();

      expect(loggerInfo).toHaveBeenCalledWith(
        'Cleanup expired files task - implement with S3 listing if needed'
      );
      loggerInfo.mockRestore();
    });

    it('should complete without errors', async () => {
      await expect(cleanupExpiredFiles()).resolves.toBeUndefined();
    });
  });
});
