import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSubscriptionRepository } from '../subscriptionRepository.js';

describe('Subscription Repository', () => {
  const mockPrisma = {
    subscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createSubscriptionRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createSubscriptionRepository(mockContext);
  });

  describe('findUnique', () => {
    it('should find unique subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        organizationId: 'org-123',
        status: 'active',
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription as any);

      const result = await repository.findUnique({
        where: { id: 'sub-123' },
      });

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
      });
    });
  });

  describe('upsert', () => {
    it('should upsert subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        organizationId: 'org-123',
        status: 'active',
      };

      mockPrisma.subscription.upsert.mockResolvedValue(mockSubscription as any);

      const result = await repository.upsert({
        where: { organizationId: 'org-123' },
        update: { status: 'active' },
        create: {
          organizationId: 'org-123',
          status: 'active',
          chargebeeSubscriptionId: 'cb-123',
          planId: 'plan-123',
        } as any,
      });

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create subscription', async () => {
      const subscriptionData = {
        id: 'sub-123',
        organizationId: 'org-123',
        chargebeeSubscriptionId: 'cb-123',
        planId: 'plan-123',
        status: 'active',
      };

      mockPrisma.subscription.create.mockResolvedValue(subscriptionData as any);

      const result = await repository.create({
        data: subscriptionData as any,
      });

      expect(result).toEqual(subscriptionData);
      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: subscriptionData,
      });
    });
  });

  describe('update', () => {
    it('should update subscription', async () => {
      const updatedSubscription = {
        id: 'sub-123',
        status: 'cancelled',
      };

      mockPrisma.subscription.update.mockResolvedValue(updatedSubscription as any);

      const result = await repository.update({
        where: { id: 'sub-123' },
        data: { status: 'cancelled' },
      });

      expect(result).toEqual(updatedSubscription);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
        data: { status: 'cancelled' },
      });
    });
  });

  describe('createSubscription', () => {
    it('should create subscription with data', async () => {
      const subscriptionData = {
        organizationId: 'org-123',
        chargebeeSubscriptionId: 'cb-123',
        planId: 'plan-123',
        status: 'active',
      };

      mockPrisma.subscription.create.mockResolvedValue(subscriptionData as any);

      const result = await repository.createSubscription(subscriptionData as any);

      expect(result).toEqual(subscriptionData);
      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: subscriptionData,
      });
    });
  });

  describe('findMany', () => {
    it('should proxy findMany', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const args = { where: { planId: 'free' } };
      await repository.findMany(args as any);

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(args);
    });
  });

  describe('count', () => {
    it('should proxy count', async () => {
      mockPrisma.subscription.count.mockResolvedValue(2);

      const result = await repository.count({ where: { planId: 'starter' } });

      expect(result).toBe(2);
      expect(mockPrisma.subscription.count).toHaveBeenCalledWith({
        where: { planId: 'starter' },
      });
    });
  });

  describe('groupByPlan', () => {
    it('should group subscription counts by planId', async () => {
      const grouped = [{ planId: 'starter', _count: { _all: 7 } }];
      mockPrisma.subscription.groupBy.mockResolvedValue(grouped as any);

      const result = await repository.groupByPlan();

      expect(result).toEqual(grouped);
      expect(mockPrisma.subscription.groupBy).toHaveBeenCalledWith({
        by: ['planId'],
        _count: { _all: true },
      });
    });
  });

  describe('findManyWithLimits', () => {
    it('should find subscriptions with an explicit submissions cap, org included', async () => {
      const subs = [{ organizationId: 'org-1', submissionsLimit: 1000, organization: { id: 'org-1', name: 'Acme' } }];
      mockPrisma.subscription.findMany.mockResolvedValue(subs as any);

      const result = await repository.findManyWithLimits();

      expect(result).toEqual(subs);
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: { submissionsLimit: { not: null } },
        include: { organization: { select: { id: true, name: true } } },
      });
    });
  });

  describe('upsertForOrganization', () => {
    it('should upsert subscription for organization', async () => {
      const updateData = {
        status: 'active',
        planId: 'plan-456',
      };

      const createData = {
        organizationId: 'org-123',
        chargebeeSubscriptionId: 'cb-123',
        planId: 'plan-456',
        status: 'active',
      };

      const mockSubscription = {
        id: 'sub-123',
        ...createData,
      };

      mockPrisma.subscription.upsert.mockResolvedValue(mockSubscription as any);

      const result = await repository.upsertForOrganization(
        'org-123',
        updateData as any,
        createData as any
      );

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        update: updateData,
        create: createData,
      });
    });
  });
});
