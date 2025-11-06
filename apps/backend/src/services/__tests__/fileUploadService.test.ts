import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadFile, deleteFile, copyFileForForm } from '../fileUploadService.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { s3Config } from '../../lib/env.js';
import { constructCdnUrl } from '../../utils/cdn.js';
import { logger } from '../../lib/logger.js';
import { Readable } from 'stream';

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
    CopyObjectCommand: vi.fn(function(params) {
      this.input = params;
    }),
    __mockSend: mockSend, // Export mockSend so we can access it
  };
});
vi.mock('../../lib/env.js');
vi.mock('../../utils/cdn.js');

const { __mockSend: mockSend } = await import('@aws-sdk/client-s3') as any;

describe('File Upload Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
    vi.mocked(s3Config).endpoint = 'https://test.r2.cloudflarestorage.com';
    vi.mocked(s3Config).accessKey = 'test-access-key';
    vi.mocked(s3Config).secretKey = 'test-secret-key';
    vi.mocked(s3Config).publicBucketName = 'test-bucket';
    vi.mocked(constructCdnUrl).mockReturnValue('https://cdn.example.com/test-file.jpg');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    const createMockFile = (filename: string, mimetype: string, size: number) => {
      const buffer = Buffer.alloc(size);
      const stream = Readable.from(buffer);

      return {
        filename,
        mimetype,
        encoding: 'utf-8',
        createReadStream: () => stream,
      };
    };

    it('should upload file successfully', async () => {
      mockSend.mockResolvedValue({});
      const mockFile = createMockFile('test-image.jpg', 'image/jpeg', 1024);

      const result = await uploadFile({
        file: mockFile,
        type: 'FormBackground',
      });

      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result).toMatchObject({
        type: 'FormBackground',
        url: 'https://cdn.example.com/test-file.jpg',
        originalName: 'test-image.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });
      expect(result.key).toContain('files/form-background/');
      expect(result.key).toContain('test-image.jpg');
    });

    it('should upload with formId in path', async () => {
      mockSend.mockResolvedValue({});
      const mockFile = createMockFile('background.png', 'image/png', 2048);

      const result = await uploadFile({
        file: mockFile,
        type: 'FormBackground',
      });

      expect(result.key).toContain('files/form-background/');
    });

    it('should sanitize filename with special characters', async () => {
      mockSend.mockResolvedValue({});
      const mockFile = createMockFile('test image (1).jpg', 'image/jpeg', 1024);

      const result = await uploadFile({
        file: mockFile,
        type: 'UserAvatar',
      });

      expect(result.key).toMatch(/files\/user-avatar\/.*-test-image--1-\.jpg$/);
    });

    it('should throw error when filename is missing', async () => {
      const mockFile = createMockFile('', 'image/jpeg', 1024);

      await expect(
        uploadFile({
          file: mockFile,
          type: 'FormBackground',
        })
      ).rejects.toThrow('Filename is required');
    });

    it('should throw error for invalid file type', async () => {
      const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);

      await expect(
        uploadFile({
          file: mockFile,
          type: 'FormBackground',
        })
      ).rejects.toThrow('File type application/pdf is not allowed');
    });

    it('should accept all valid image types', async () => {
      mockSend.mockResolvedValue({});

      const imageTypes = [
        { ext: 'jpg', mime: 'image/jpeg' },
        { ext: 'jpeg', mime: 'image/jpeg' },
        { ext: 'png', mime: 'image/png' },
        { ext: 'webp', mime: 'image/webp' },
        { ext: 'gif', mime: 'image/gif' },
      ];

      for (const { ext, mime } of imageTypes) {
        mockSend.mockClear();
        const mockFile = createMockFile(`test.${ext}`, mime, 1024);

        const result = await uploadFile({
          file: mockFile,
          type: 'FormTemplate',
        });

        expect(result.mimeType).toBe(mime);
      }
    });

    it('should fallback to extension-based mimetype detection', async () => {
      mockSend.mockResolvedValue({});
      const mockFile = createMockFile('test.jpg', '', 1024);

      const result = await uploadFile({
        file: mockFile,
        type: 'FormBackground',
      });

      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should throw error when file exceeds max size', async () => {
      const largeSize = 6 * 1024 * 1024; // 6MB
      const mockFile = createMockFile('large.jpg', 'image/jpeg', largeSize);

      await expect(
        uploadFile({
          file: mockFile,
          type: 'FormBackground',
        })
      ).rejects.toThrow('File size');
    });

    it('should generate correct S3 key for different types', async () => {
      mockSend.mockResolvedValue({});

      const types = [
        { type: 'FormTemplate', expectedPath: 'files/form-template/' },
        { type: 'FormBackground', expectedPath: 'files/form-background/' },
        { type: 'UserAvatar', expectedPath: 'files/user-avatar/' },
        { type: 'OrganizationLogo', expectedPath: 'files/organization-logo/' },
        { type: 'Other', expectedPath: 'files/misc/' },
      ];

      for (const { type, expectedPath } of types) {
        mockSend.mockClear();
        const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);

        const result = await uploadFile({
          file: mockFile,
          type,
        });

        expect(result.key).toContain(expectedPath);
      }
    });

    it('should set correct S3 object parameters', async () => {
      mockSend.mockResolvedValue({});
      const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);

      await uploadFile({
        file: mockFile,
        type: 'FormBackground',
      });

      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        ContentType: 'image/jpeg',
        ContentLength: 1024,
        ACL: 'public-read',
      });
    });

    it('should handle S3 upload errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('S3 upload failed'));
      const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);

      await expect(
        uploadFile({
          file: mockFile,
          type: 'FormBackground',
        })
      ).rejects.toThrow('Failed to upload file: S3 upload failed');

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      mockSend.mockResolvedValue({});

      const result = await deleteFile('files/form-background/test.jpg');

      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
      expect(result).toBe(true);
    });

    it('should handle deletion errors gracefully', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('Delete failed'));

      const result = await deleteFile('files/form-background/test.jpg');

      expect(result).toBe(false);
      expect(loggerError).toHaveBeenCalledWith(
        'Error deleting file from Cloudflare R2:',
        expect.any(Error)
      );
      loggerError.mockRestore();
    });

    it('should call DeleteObjectCommand with correct parameters', async () => {
      mockSend.mockResolvedValue({});
      const s3Key = 'files/user-avatar/avatar123.png';

      await deleteFile(s3Key);

      const deleteCommand = mockSend.mock.calls[0][0];
      expect(deleteCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: s3Key,
      });
    });
  });

  describe('copyFileForForm', () => {
    it('should copy file successfully', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(constructCdnUrl).mockReturnValue('https://cdn.example.com/new-file.jpg');

      const result = await copyFileForForm(
        'files/form-background/source.jpg',
        'form-123'
      );

      expect(mockSend).toHaveBeenCalledWith(expect.any(CopyObjectCommand));
      expect(result).toMatchObject({
        type: 'FormBackground',
        url: 'https://cdn.example.com/new-file.jpg',
        originalName: 'source.jpg',
        size: 0,
        mimeType: 'image/jpeg',
      });
      expect(result.key).toContain('files/form-background/form-123/');
    });

    it('should extract filename from source key', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(constructCdnUrl).mockReturnValue('https://cdn.example.com/file.jpg');

      const result = await copyFileForForm(
        'files/form-background/old-form/complex-name.png',
        'new-form-456'
      );

      expect(result.originalName).toBe('complex-name.png');
      expect(result.key).toContain('new-form-456');
    });

    it('should handle source key without path separators', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(constructCdnUrl).mockReturnValue('https://cdn.example.com/file.jpg');

      const result = await copyFileForForm('simple-filename.jpg', 'form-789');

      expect(result.originalName).toBe('simple-filename.jpg');
    });

    it('should set correct CopyObjectCommand parameters', async () => {
      mockSend.mockResolvedValue({});

      await copyFileForForm('files/source/image.jpg', 'form-abc');

      const copyCommand = mockSend.mock.calls[0][0];
      expect(copyCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        CopySource: 'test-bucket/files/source/image.jpg',
        ACL: 'public-read',
      });
      expect(copyCommand.input.Key).toContain('files/form-background/form-abc/');
    });

    it('should handle copy errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValue(new Error('Copy failed'));

      await expect(
        copyFileForForm('files/source/test.jpg', 'form-123')
      ).rejects.toThrow('Failed to copy file: Copy failed');

      expect(loggerError).toHaveBeenCalledWith(
        'Error copying file in Cloudflare R2:',
        expect.any(Error)
      );
      loggerError.mockRestore();
    });

    it('should handle null CDN URL', async () => {
      mockSend.mockResolvedValue({});
      vi.mocked(constructCdnUrl).mockReturnValue(null);

      const result = await copyFileForForm('files/source/test.jpg', 'form-123');

      expect(result.url).toBe('');
    });
  });
});
