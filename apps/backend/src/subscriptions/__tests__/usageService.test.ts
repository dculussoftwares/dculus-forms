import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initializeUsageService,
  trackFormView,
  trackFormSubmission,
  checkUsageExceeded,
  getUsage,
  resetUsageCounters,
} from '../usageService.js';
import { PrismaClient } from '@prisma/client';
import {
  emitUsageLimitReached,
  emitUsageLimitExceeded,
  getSubscriptionEventEmitter,
} from '../events.js';
import { SubscriptionEventType } from '../types.js';
import { logger } from '../../lib/logger.js';

// Create mock subscription object
const mockSubscription = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

// Mock dependencies
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: class {
      subscription = mockSubscription;
    },
  };
});

vi.mock('../events.js', () => ({
  emitUsageLimitReached: vi.fn(),
  emitUsageLimitExceeded: vi.fn(),
  getSubscriptionEventEmitter: vi.fn(() => ({
    on: vi.fn(),
  })),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('usageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initializeUsageService', () => {
    it('should initialize usage service and set up event listeners', () => {
      const mockEventEmitter = {
        on: vi.fn(),
      };
      vi.mocked(getSubscriptionEventEmitter).mockReturnValue(mockEventEmitter as any);

      initializeUsageService();

      expect(logger.info).toHaveBeenCalledWith(
        '[Usage Service] Initializing subscription usage service...'
      );
      expect(getSubscriptionEventEmitter).toHaveBeenCalled();
      expect(mockEventEmitter.on).toHaveBeenCalledWith(
        SubscriptionEventType.FORM_VIEWED,
        expect.any(Function)
      );
      expect(mockEventEmitter.on).toHaveBeenCalledWith(
        SubscriptionEventType.FORM_SUBMITTED,
        expect.any(Function)
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[Usage Service] Subscription usage service initialized successfully'
      );
    });

    it('should handle form view events', async () => {
      const mockEventEmitter = {
        on: vi.fn(),
      };
      vi.mocked(getSubscriptionEventEmitter).mockReturnValue(mockEventEmitter as any);

      initializeUsageService();

      const formViewedHandler = mockEventEmitter.on.mock.calls.find(
        call => call[0] === SubscriptionEventType.FORM_VIEWED
      )?.[1];

      expect(formViewedHandler).toBeDefined();

      // Mock trackFormView
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 0,
        viewsLimit: 100,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 1,
        viewsLimit: 100,
      });

      const event = {
        type: SubscriptionEventType.FORM_VIEWED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: new Date(),
        data: { sessionId: 'session-1' },
      };

      await formViewedHandler(event);

      // Handler should not throw
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle form submission events', async () => {
      const mockEventEmitter = {
        on: vi.fn(),
      };
      vi.mocked(getSubscriptionEventEmitter).mockReturnValue(mockEventEmitter as any);

      initializeUsageService();

      const formSubmittedHandler = mockEventEmitter.on.mock.calls.find(
        call => call[0] === SubscriptionEventType.FORM_SUBMITTED
      )?.[1];

      expect(formSubmittedHandler).toBeDefined();

      // Mock trackFormSubmission
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 0,
        submissionsLimit: 50,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 1,
        submissionsLimit: 50,
      });

      const event = {
        type: SubscriptionEventType.FORM_SUBMITTED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: new Date(),
        data: { responseId: 'response-1' },
      };

      await formSubmittedHandler(event);

      // Handler should not throw
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should log errors when event handlers fail', async () => {
      const mockEventEmitter = {
        on: vi.fn(),
      };
      vi.mocked(getSubscriptionEventEmitter).mockReturnValue(mockEventEmitter as any);

      initializeUsageService();

      const formViewedHandler = mockEventEmitter.on.mock.calls.find(
        call => call[0] === SubscriptionEventType.FORM_VIEWED
      )?.[1];

      mockSubscription.findUnique.mockRejectedValue(new Error('Database error'));

      const event = {
        type: SubscriptionEventType.FORM_VIEWED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: new Date(),
        data: { sessionId: 'session-1' },
      };

      await formViewedHandler(event);

      expect(logger.error).toHaveBeenCalledWith(
        '[Usage Service] Error tracking form view:',
        expect.any(Error)
      );
    });
  });

  describe('trackFormView', () => {
    it('should increment views counter and check limits', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 10,
        viewsLimit: 100,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 11,
        viewsLimit: 100,
      });

      await trackFormView('org-1', 'form-1');

      expect(mockSubscription.findUnique).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
      });
      expect(mockSubscription.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: {
          viewsUsed: {
            increment: 1,
          },
        },
      });
      expect(emitUsageLimitReached).not.toHaveBeenCalled();
      expect(emitUsageLimitExceeded).not.toHaveBeenCalled();
    });

    it('should emit warning event when approaching limit (80%)', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 79,
        viewsLimit: 100,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 80,
        viewsLimit: 100,
      });

      await trackFormView('org-1', 'form-1');

      expect(emitUsageLimitReached).toHaveBeenCalledWith(
        'org-1',
        'form-1',
        'views',
        80,
        100,
        80
      );
      expect(emitUsageLimitExceeded).not.toHaveBeenCalled();
    });

    it('should emit exceeded event when over limit', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 100,
        viewsLimit: 100,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 101,
        viewsLimit: 100,
      });

      await trackFormView('org-1', 'form-1');

      expect(emitUsageLimitExceeded).toHaveBeenCalledWith('org-1', 'form-1', 'views', 101, 100);
      expect(emitUsageLimitReached).not.toHaveBeenCalled();
    });

    it('should not check limits when viewsLimit is null (unlimited)', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 1000,
        viewsLimit: null,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 1001,
        viewsLimit: null,
      });

      await trackFormView('org-1', 'form-1');

      expect(emitUsageLimitReached).not.toHaveBeenCalled();
      expect(emitUsageLimitExceeded).not.toHaveBeenCalled();
    });

    it('should log warning and return early when subscription not found', async () => {
      mockSubscription.findUnique.mockResolvedValue(null);

      await trackFormView('org-1', 'form-1');

      expect(logger.warn).toHaveBeenCalledWith(
        '[Usage Service] No subscription found for organization:',
        'org-1'
      );
      expect(mockSubscription.update).not.toHaveBeenCalled();
    });

    it('should emit warning at exactly 80% usage', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 39,
        viewsLimit: 50,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 40,
        viewsLimit: 50,
      });

      await trackFormView('org-1', 'form-1');

      expect(emitUsageLimitReached).toHaveBeenCalledWith('org-1', 'form-1', 'views', 40, 50, 80);
    });

    it('should emit warning above 80% usage', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 89,
        viewsLimit: 100,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 90,
        viewsLimit: 100,
      });

      await trackFormView('org-1', 'form-1');

      expect(emitUsageLimitReached).toHaveBeenCalledWith('org-1', 'form-1', 'views', 90, 100, 90);
    });
  });

  describe('trackFormSubmission', () => {
    it('should increment submissions counter and check limits', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 5,
        submissionsLimit: 50,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 6,
        submissionsLimit: 50,
      });

      await trackFormSubmission('org-1', 'form-1');

      expect(mockSubscription.findUnique).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
      });
      expect(mockSubscription.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: {
          submissionsUsed: {
            increment: 1,
          },
        },
      });
    });

    it('should emit warning when approaching submissions limit', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 39,
        submissionsLimit: 50,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 40,
        submissionsLimit: 50,
      });

      await trackFormSubmission('org-1', 'form-1');

      expect(emitUsageLimitReached).toHaveBeenCalledWith(
        'org-1',
        'form-1',
        'submissions',
        40,
        50,
        80
      );
    });

    it('should emit exceeded event when over submissions limit', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 50,
        submissionsLimit: 50,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 51,
        submissionsLimit: 50,
      });

      await trackFormSubmission('org-1', 'form-1');

      expect(emitUsageLimitExceeded).toHaveBeenCalledWith(
        'org-1',
        'form-1',
        'submissions',
        51,
        50
      );
    });

    it('should not check limits when submissionsLimit is null', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 500,
        submissionsLimit: null,
      });
      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        submissionsUsed: 501,
        submissionsLimit: null,
      });

      await trackFormSubmission('org-1', 'form-1');

      expect(emitUsageLimitReached).not.toHaveBeenCalled();
      expect(emitUsageLimitExceeded).not.toHaveBeenCalled();
    });

    it('should log warning and return early when subscription not found', async () => {
      mockSubscription.findUnique.mockResolvedValue(null);

      await trackFormSubmission('org-1', 'form-1');

      expect(logger.warn).toHaveBeenCalledWith(
        '[Usage Service] No subscription found for organization:',
        'org-1'
      );
      expect(mockSubscription.update).not.toHaveBeenCalled();
    });
  });

  describe('checkUsageExceeded', () => {
    it('should return false for both when no subscription exists', async () => {
      mockSubscription.findUnique.mockResolvedValue(null);

      const result = await checkUsageExceeded('org-1');

      expect(result).toEqual({
        viewsExceeded: false,
        submissionsExceeded: false,
      });
    });

    it('should return false when usage is within limits', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 50,
        viewsLimit: 100,
        submissionsUsed: 20,
        submissionsLimit: 50,
      });

      const result = await checkUsageExceeded('org-1');

      expect(result).toEqual({
        viewsExceeded: false,
        submissionsExceeded: false,
      });
    });

    it('should return true for views when at limit', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 100,
        viewsLimit: 100,
        submissionsUsed: 20,
        submissionsLimit: 50,
      });

      const result = await checkUsageExceeded('org-1');

      expect(result).toEqual({
        viewsExceeded: true,
        submissionsExceeded: false,
      });
    });

    it('should return true for views when exceeded', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 101,
        viewsLimit: 100,
        submissionsUsed: 20,
        submissionsLimit: 50,
      });

      const result = await checkUsageExceeded('org-1');

      expect(result).toEqual({
        viewsExceeded: true,
        submissionsExceeded: false,
      });
    });

    it('should return true for submissions when at limit', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 50,
        viewsLimit: 100,
        submissionsUsed: 50,
        submissionsLimit: 50,
      });

      const result = await checkUsageExceeded('org-1');

      expect(result).toEqual({
        viewsExceeded: false,
        submissionsExceeded: true,
      });
    });

    it('should return true for both when both exceeded', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 150,
        viewsLimit: 100,
        submissionsUsed: 75,
        submissionsLimit: 50,
      });

      const result = await checkUsageExceeded('org-1');

      expect(result).toEqual({
        viewsExceeded: true,
        submissionsExceeded: true,
      });
    });

    it('should return false when limits are null (unlimited)', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 1000,
        viewsLimit: null,
        submissionsUsed: 500,
        submissionsLimit: null,
      });

      const result = await checkUsageExceeded('org-1');

      expect(result).toEqual({
        viewsExceeded: false,
        submissionsExceeded: false,
      });
    });

    it('should handle mixed null and numeric limits', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 1000,
        viewsLimit: null,
        submissionsUsed: 60,
        submissionsLimit: 50,
      });

      const result = await checkUsageExceeded('org-1');

      expect(result).toEqual({
        viewsExceeded: false,
        submissionsExceeded: true,
      });
    });
  });

  describe('getUsage', () => {
    it('should return null when subscription not found', async () => {
      mockSubscription.findUnique.mockResolvedValue(null);

      const result = await getUsage('org-1');

      expect(result).toBeNull();
    });

    it('should return usage details with numeric limits', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 75,
        viewsLimit: 100,
        submissionsUsed: 30,
        submissionsLimit: 50,
        planId: 'plan-standard',
        status: 'active',
      });

      const result = await getUsage('org-1');

      expect(result).toEqual({
        views: {
          used: 75,
          limit: 100,
          unlimited: false,
        },
        submissions: {
          used: 30,
          limit: 50,
          unlimited: false,
        },
        planId: 'plan-standard',
        status: 'active',
      });
    });

    it('should return usage details with unlimited views', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 1000,
        viewsLimit: null,
        submissionsUsed: 30,
        submissionsLimit: 50,
        planId: 'plan-premium',
        status: 'active',
      });

      const result = await getUsage('org-1');

      expect(result).toEqual({
        views: {
          used: 1000,
          limit: null,
          unlimited: true,
        },
        submissions: {
          used: 30,
          limit: 50,
          unlimited: false,
        },
        planId: 'plan-premium',
        status: 'active',
      });
    });

    it('should return usage details with unlimited submissions', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 75,
        viewsLimit: 100,
        submissionsUsed: 500,
        submissionsLimit: null,
        planId: 'plan-premium',
        status: 'active',
      });

      const result = await getUsage('org-1');

      expect(result).toEqual({
        views: {
          used: 75,
          limit: 100,
          unlimited: false,
        },
        submissions: {
          used: 500,
          limit: null,
          unlimited: true,
        },
        planId: 'plan-premium',
        status: 'active',
      });
    });

    it('should return usage details with both unlimited', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 5000,
        viewsLimit: null,
        submissionsUsed: 2000,
        submissionsLimit: null,
        planId: 'plan-enterprise',
        status: 'active',
      });

      const result = await getUsage('org-1');

      expect(result).toEqual({
        views: {
          used: 5000,
          limit: null,
          unlimited: true,
        },
        submissions: {
          used: 2000,
          limit: null,
          unlimited: true,
        },
        planId: 'plan-enterprise',
        status: 'active',
      });
    });

    it('should handle zero usage', async () => {
      mockSubscription.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 0,
        viewsLimit: 100,
        submissionsUsed: 0,
        submissionsLimit: 50,
        planId: 'plan-free',
        status: 'active',
      });

      const result = await getUsage('org-1');

      expect(result).toEqual({
        views: {
          used: 0,
          limit: 100,
          unlimited: false,
        },
        submissions: {
          used: 0,
          limit: 50,
          unlimited: false,
        },
        planId: 'plan-free',
        status: 'active',
      });
    });
  });

  describe('resetUsageCounters', () => {
    it('should reset usage counters and update billing period', async () => {
      const periodStart = new Date('2024-04-01T00:00:00Z');
      const periodEnd = new Date('2024-05-01T00:00:00Z');

      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 0,
        submissionsUsed: 0,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      await resetUsageCounters('org-1', periodStart, periodEnd);

      expect(mockSubscription.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: {
          viewsUsed: 0,
          submissionsUsed: 0,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });
      expect(logger.info).toHaveBeenCalledWith(
        '[Usage Service] Usage counters reset for organization:',
        'org-1'
      );
    });

    it('should reset counters for multiple organizations independently', async () => {
      const periodStart = new Date('2024-04-01T00:00:00Z');
      const periodEnd = new Date('2024-05-01T00:00:00Z');

      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 0,
        submissionsUsed: 0,
      });

      await resetUsageCounters('org-1', periodStart, periodEnd);
      await resetUsageCounters('org-2', periodStart, periodEnd);

      expect(mockSubscription.update).toHaveBeenCalledTimes(2);
      expect(mockSubscription.update).toHaveBeenNthCalledWith(1, {
        where: { organizationId: 'org-1' },
        data: expect.any(Object),
      });
      expect(mockSubscription.update).toHaveBeenNthCalledWith(2, {
        where: { organizationId: 'org-2' },
        data: expect.any(Object),
      });
    });

    it('should handle different billing period dates', async () => {
      const periodStart = new Date('2024-06-15T00:00:00Z');
      const periodEnd = new Date('2024-07-15T00:00:00Z');

      mockSubscription.update.mockResolvedValue({
        organizationId: 'org-1',
        viewsUsed: 0,
        submissionsUsed: 0,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      await resetUsageCounters('org-1', periodStart, periodEnd);

      expect(mockSubscription.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: {
          viewsUsed: 0,
          submissionsUsed: 0,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });
    });
  });
});
