import { describe, it, expect, vi, beforeEach } from 'vitest';
import { constructCdnUrl } from '../cdn.js';

// Mock the env module
vi.mock('../../lib/env.js', () => ({
  s3Config: {
    cdnUrl: 'https://cdn.example.com',
  },
}));

describe('CDN Utils', () => {
  describe('constructCdnUrl', () => {
    it('should return null when s3Key is null', () => {
      const result = constructCdnUrl(null);
      expect(result).toBeNull();
    });

    it('should return null when s3Key is empty string', () => {
      const result = constructCdnUrl('');
      expect(result).toBeNull();
    });

    it('should construct CDN URL from s3Key', () => {
      const result = constructCdnUrl('images/photo.jpg');
      expect(result).toBe('https://cdn.example.com/images/photo.jpg');
    });

    it('should remove leading slash from s3Key', () => {
      const result = constructCdnUrl('/images/photo.jpg');
      expect(result).toBe('https://cdn.example.com/images/photo.jpg');
    });

    it('should handle CDN URL with trailing slash', () => {
      // Re-mock with trailing slash
      vi.doMock('../../lib/env.js', () => ({
        s3Config: {
          cdnUrl: 'https://cdn.example.com/',
        },
      }));

      const result = constructCdnUrl('images/photo.jpg');
      // The function should clean up the trailing slash
      expect(result).not.toContain('//images');
      expect(result).toContain('/images/photo.jpg');
    });

    it('should handle s3Key with multiple path segments', () => {
      const result = constructCdnUrl('uploads/2024/01/image.png');
      expect(result).toBe('https://cdn.example.com/uploads/2024/01/image.png');
    });

    it('should handle s3Key with special characters', () => {
      const result = constructCdnUrl('images/my-photo_2024.jpg');
      expect(result).toBe('https://cdn.example.com/images/my-photo_2024.jpg');
    });
  });
});
