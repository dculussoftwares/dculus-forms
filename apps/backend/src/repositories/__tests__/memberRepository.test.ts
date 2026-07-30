import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemberRepository } from '../memberRepository.js';

describe('Member Repository', () => {
  const mockPrisma = {
    member: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createMemberRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createMemberRepository(mockContext);
  });

  describe('generic passthroughs', () => {
    it('should proxy findMany', async () => {
      mockPrisma.member.findMany.mockResolvedValue([]);

      await repository.findMany({ where: { organizationId: 'org-123' } } as any);

      expect(mockPrisma.member.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
    });

    it('should proxy findFirst', async () => {
      const mockMember = { id: 'member-1', organizationId: 'org-123', role: 'owner' };
      mockPrisma.member.findFirst.mockResolvedValue(mockMember as any);

      const result = await repository.findFirst({ where: { organizationId: 'org-123' } });

      expect(result).toEqual(mockMember);
      expect(mockPrisma.member.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
    });

    it('should proxy findUnique', async () => {
      mockPrisma.member.findUnique.mockResolvedValue(null);

      await repository.findUnique({ where: { id: 'member-1' } });

      expect(mockPrisma.member.findUnique).toHaveBeenCalledWith({ where: { id: 'member-1' } });
    });

    it('should proxy create', async () => {
      mockPrisma.member.create.mockResolvedValue({} as any);

      await repository.create({ data: { organizationId: 'org-123', userId: 'user-1' } } as any);

      expect(mockPrisma.member.create).toHaveBeenCalledWith({
        data: { organizationId: 'org-123', userId: 'user-1' },
      });
    });

    it('should proxy update', async () => {
      mockPrisma.member.update.mockResolvedValue({} as any);

      await repository.update({ where: { id: 'member-1' }, data: { role: 'owner' } } as any);

      expect(mockPrisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { role: 'owner' },
      });
    });

    it('should proxy delete', async () => {
      mockPrisma.member.delete.mockResolvedValue({} as any);

      await repository.delete({ where: { id: 'member-1' } } as any);

      expect(mockPrisma.member.delete).toHaveBeenCalledWith({ where: { id: 'member-1' } });
    });

    it('should proxy count', async () => {
      mockPrisma.member.count.mockResolvedValue(2);

      const result = await repository.count();

      expect(result).toBe(2);
      expect(mockPrisma.member.count).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOwnerByOrganization', () => {
    it('should look up the owner member with the user relation included', async () => {
      const mockMember = {
        id: 'member-1',
        organizationId: 'org-123',
        role: 'owner',
        user: { id: 'user-1', email: 'owner@example.com' },
      };
      mockPrisma.member.findFirst.mockResolvedValue(mockMember as any);

      const result = await repository.findOwnerByOrganization('org-123');

      expect(result).toEqual(mockMember);
      expect(mockPrisma.member.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', role: 'owner' },
        include: { user: true },
      });
    });

    it('should return null when no owner exists', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);

      const result = await repository.findOwnerByOrganization('org-123');

      expect(result).toBeNull();
    });
  });
});
