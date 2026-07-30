import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrganizationRepository } from '../organizationRepository.js';

describe('Organization Repository', () => {
  const mockPrisma = {
    organization: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createOrganizationRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createOrganizationRepository(mockContext);
  });

  describe('generic passthroughs', () => {
    it('should proxy findMany', async () => {
      const args = { where: { name: 'Acme' } };
      mockPrisma.organization.findMany.mockResolvedValue([]);

      await repository.findMany(args as any);

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(args);
    });

    it('should proxy findUnique', async () => {
      const mockOrg = { id: 'org-123', name: 'Acme' };
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg as any);

      const result = await repository.findUnique({ where: { id: 'org-123' } });

      expect(result).toEqual(mockOrg);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      });
    });

    it('should proxy create', async () => {
      const data = { id: 'org-123', name: 'Acme', slug: 'acme' };
      mockPrisma.organization.create.mockResolvedValue(data as any);

      await repository.create({ data } as any);

      expect(mockPrisma.organization.create).toHaveBeenCalledWith({ data });
    });

    it('should proxy update', async () => {
      mockPrisma.organization.update.mockResolvedValue({} as any);

      await repository.update({ where: { id: 'org-123' }, data: { name: 'New' } } as any);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { name: 'New' },
      });
    });

    it('should proxy delete', async () => {
      mockPrisma.organization.delete.mockResolvedValue({} as any);

      await repository.delete({ where: { id: 'org-123' } } as any);

      expect(mockPrisma.organization.delete).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      });
    });

    it('should proxy count', async () => {
      mockPrisma.organization.count.mockResolvedValue(3);

      const result = await repository.count();

      expect(result).toBe(3);
      expect(mockPrisma.organization.count).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findById', () => {
    it('should look up an organization by id', async () => {
      const mockOrg = { id: 'org-123', name: 'Acme' };
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg as any);

      const result = await repository.findById('org-123');

      expect(result).toEqual(mockOrg);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      });
    });

    it('should return null when the organization does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const result = await repository.findById('missing-org');

      expect(result).toBeNull();
    });
  });
});
