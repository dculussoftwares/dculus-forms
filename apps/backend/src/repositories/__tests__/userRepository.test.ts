import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createUserRepository } from '../userRepository.js';

describe('User Repository', () => {
  const mockPrisma = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createUserRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createUserRepository(mockContext);
  });

  describe('generic passthroughs', () => {
    it('should proxy findMany', async () => {
      const args = { where: { name: { contains: 'Alice' } } };
      mockPrisma.user.findMany.mockResolvedValue([]);

      await repository.findMany(args as any);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(args);
    });

    it('should proxy findUnique', async () => {
      const mockUser = { id: 'user-123', name: 'Alice' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await repository.findUnique({ where: { id: 'user-123' } });

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should proxy findFirst', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await repository.findFirst({ where: { email: 'a@example.com' } });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'a@example.com' },
      });
    });

    it('should proxy count', async () => {
      mockPrisma.user.count.mockResolvedValue(5);

      const result = await repository.count();

      expect(result).toBe(5);
      expect(mockPrisma.user.count).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findByImageKey', () => {
    it('should look up a user by their avatar S3 key', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-123' } as any);

      const result = await repository.findByImageKey('uploads/avatar-key');

      expect(result).toEqual({ id: 'user-123' });
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { image: 'uploads/avatar-key' },
        select: { id: true },
      });
    });

    it('should return null when no user owns the key', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await repository.findByImageKey('uploads/missing-key');

      expect(result).toBeNull();
    });
  });
});
