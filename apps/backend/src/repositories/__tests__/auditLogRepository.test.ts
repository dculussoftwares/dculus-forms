import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAuditLogRepository } from '../auditLogRepository.js';

describe('AuditLog Repository', () => {
  const mockPrisma = {
    auditLog: {
      create: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createAuditLogRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createAuditLogRepository(mockContext);
  });

  describe('generic passthroughs', () => {
    it('should proxy create', async () => {
      const args = {
        data: {
          action: 'plan_created',
          actorId: 'admin-1',
          resourceType: 'Plan',
          resourceId: 'pro',
          metadata: { changedBy: 'admin@example.com' },
        },
      };
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' } as any);

      const result = await repository.create(args as any);

      expect(result).toEqual({ id: 'log-1' });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(args);
    });
  });

  describe('logAction', () => {
    it('should write a single audit log entry', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' } as any);

      const data = {
        action: 'usage_reset',
        actorId: 'admin-1',
        resourceType: 'Organization',
        resourceId: 'org-1',
        metadata: { resetBy: 'admin@example.com' },
      };

      await repository.logAction(data as any);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({ data });
    });

    it('should propagate errors instead of swallowing them', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(
        repository.logAction({
          action: 'plan_archived',
          actorId: 'admin-1',
          resourceType: 'Plan',
          resourceId: 'pro',
        } as any)
      ).rejects.toThrow('db down');
    });
  });
});
