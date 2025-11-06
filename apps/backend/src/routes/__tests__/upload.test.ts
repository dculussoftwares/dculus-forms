import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { uploadRouter } from '../upload.js';
import { uploadFile } from '../../services/fileUploadService.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('../../services/fileUploadService.js');
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    formFile: {
      create: vi.fn(),
    },
  },
}));
vi.mock('../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Upload Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/upload', uploadRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /upload', () => {
    it('should upload file successfully without formId', async () => {
      const mockResult = {
        key: 'files/form-background/test-file.jpg',
        type: 'FormBackground',
        url: 'https://cdn.example.com/test-file.jpg',
        originalName: 'test-file.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      };

      vi.mocked(uploadFile).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground')
        .attach('file', Buffer.from('test file content'), 'test-file.jpg');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(uploadFile).toHaveBeenCalledWith({
        file: expect.objectContaining({
          filename: 'test-file.jpg',
          mimetype: expect.stringContaining('image/'),
          encoding: 'binary',
        }),
        type: 'FormBackground',
      });
      expect(prisma.formFile.create).not.toHaveBeenCalled();
    });

    it('should upload file with formId and save to FormFile table', async () => {
      const mockResult = {
        key: 'files/form-background/test-bg.png',
        type: 'FormBackground',
        url: 'https://cdn.example.com/test-bg.png',
        originalName: 'test-bg.png',
        size: 2048,
        mimeType: 'image/png',
      };

      vi.mocked(uploadFile).mockResolvedValue(mockResult);
      vi.mocked(prisma.formFile.create).mockResolvedValue({
        id: 'file-123',
        key: mockResult.key,
        type: mockResult.type,
        formId: 'form-123',
        originalName: mockResult.originalName,
        url: mockResult.url,
        size: mockResult.size,
        mimeType: mockResult.mimeType,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground')
        .field('formId', 'form-123')
        .attach('file', Buffer.from('test file content'), 'test-bg.png');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(prisma.formFile.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          key: mockResult.key,
          type: mockResult.type,
          formId: 'form-123',
          originalName: mockResult.originalName,
          url: mockResult.url,
          size: mockResult.size,
          mimeType: mockResult.mimeType,
        },
      });
    });

    it('should not save to FormFile if type is not FormBackground', async () => {
      const mockResult = {
        key: 'files/user-avatar/avatar.jpg',
        type: 'UserAvatar',
        url: 'https://cdn.example.com/avatar.jpg',
        originalName: 'avatar.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      };

      vi.mocked(uploadFile).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'UserAvatar')
        .field('formId', 'form-123')
        .attach('file', Buffer.from('test file content'), 'avatar.jpg');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(prisma.formFile.create).not.toHaveBeenCalled();
    });

    it('should return 400 if no file provided', async () => {
      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'No file provided' });
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it('should return 400 if type is missing', async () => {
      const response = await request(app)
        .post('/api/upload/upload')
        .attach('file', Buffer.from('test file content'), 'test.jpg');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'File type is required' });
      expect(uploadFile).not.toHaveBeenCalled();
    });

    it('should handle file size limit exceeded (multer error)', async () => {
      // Multer will reject files exceeding the 5MB limit automatically
      // This test verifies the error handling
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground')
        .attach('file', largeBuffer, 'large-file.jpg');

      // Multer may return 413 or 500 depending on configuration
      expect([413, 500]).toContain(response.status);
    });

    it('should handle upload service errors', async () => {
      vi.mocked(uploadFile).mockRejectedValue(new Error('S3 upload failed'));

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground')
        .attach('file', Buffer.from('test file content'), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to upload file: S3 upload failed',
      });
      expect(logger.error).toHaveBeenCalledWith('Error uploading file:', expect.any(Error));
    });

    it('should handle FormFile creation errors', async () => {
      const mockResult = {
        key: 'files/form-background/test.jpg',
        type: 'FormBackground',
        url: 'https://cdn.example.com/test.jpg',
        originalName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      };

      vi.mocked(uploadFile).mockResolvedValue(mockResult);
      vi.mocked(prisma.formFile.create).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground')
        .field('formId', 'form-123')
        .attach('file', Buffer.from('test file content'), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle unknown errors gracefully', async () => {
      vi.mocked(uploadFile).mockRejectedValue('Unknown error string');

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground')
        .attach('file', Buffer.from('test file content'), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to upload file: Unknown error',
      });
    });

    it('should create readable stream correctly from buffer', async () => {
      const mockResult = {
        key: 'files/form-background/test.jpg',
        type: 'FormBackground',
        url: 'https://cdn.example.com/test.jpg',
        originalName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      };

      vi.mocked(uploadFile).mockImplementation(async ({ file }) => {
        // Verify the stream can be read
        const stream = file.createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
        return mockResult;
      });

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground')
        .attach('file', Buffer.from('test file content'), 'test.jpg');

      expect(response.status).toBe(200);
    });

    it('should handle multiple file types correctly', async () => {
      const types = [
        'FormBackground',
        'FormTemplate',
        'UserAvatar',
        'OrganizationLogo',
        'Other',
      ];

      for (const type of types) {
        const mockResult = {
          key: `files/${type.toLowerCase()}/test.jpg`,
          type,
          url: `https://cdn.example.com/${type}/test.jpg`,
          originalName: 'test.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
        };

        vi.mocked(uploadFile).mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/upload/upload')
          .field('type', type)
          .attach('file', Buffer.from('test'), 'test.jpg');

        expect(response.status).toBe(200);
        expect(response.body.type).toBe(type);
      }
    });

    it('should preserve original filename in upload', async () => {
      const mockResult = {
        key: 'files/form-background/my-custom-image.png',
        type: 'FormBackground',
        url: 'https://cdn.example.com/my-custom-image.png',
        originalName: 'my-custom-image.png',
        size: 1024,
        mimeType: 'image/png',
      };

      vi.mocked(uploadFile).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/upload/upload')
        .field('type', 'FormBackground')
        .attach('file', Buffer.from('test'), 'my-custom-image.png');

      expect(response.status).toBe(200);
      expect(response.body.originalName).toBe('my-custom-image.png');
      expect(uploadFile).toHaveBeenCalledWith({
        file: expect.objectContaining({
          filename: 'my-custom-image.png',
        }),
        type: 'FormBackground',
      });
    });
  });
});
