import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSystemRepository } from '../systemRepository.js';

describe('System Repository', () => {
  const mockPrisma = {
    $queryRaw: vi.fn(),
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createSystemRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createSystemRepository(mockContext);
  });

  describe('getDatabaseSizePretty', () => {
    it('should return the formatted database size', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ size: '128 MB' }]);

      const result = await repository.getDatabaseSizePretty();

      expect(result).toBe('128 MB');
    });

    it('should fall back to "0 B" when the query returns no rows', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await repository.getDatabaseSizePretty();

      expect(result).toBe('0 B');
    });
  });

  describe('getPublicTableCount', () => {
    it('should return the table count as a number', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ count: 42n }]);

      const result = await repository.getPublicTableCount();

      expect(result).toBe(42);
    });

    it('should fall back to 0 when the query returns no rows', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await repository.getPublicTableCount();

      expect(result).toBe(0);
    });
  });

  describe('ping', () => {
    it('should issue a liveness query', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(repository.ping()).resolves.toBeUndefined();
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should propagate errors', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      await expect(repository.ping()).rejects.toThrow('connection refused');
    });
  });
});
