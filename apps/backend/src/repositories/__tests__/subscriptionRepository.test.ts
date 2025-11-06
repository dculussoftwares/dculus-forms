import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSubscriptionRepository } from '../subscriptionRepository.js';

describe('Subscription Repository', () => {
  const mockPrisma = {
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
