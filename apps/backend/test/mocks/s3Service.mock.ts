import { vi } from 'vitest';

export const mockS3Service = {
  generatePresignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/file'),
  uploadFile: vi.fn().mockResolvedValue({ key: 'test-file-key' }),
  copyFile: vi.fn().mockResolvedValue({ success: true }),
  deleteFile: vi.fn().mockResolvedValue({ success: true }),
};
