import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    aIUsage: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../subscriptions/events.js', () => ({
  emitUsageLimitReached: vi.fn(),
  emitUsageLimitExceeded: vi.fn(),
}));

import {
  checkAITokenBudget,
  recordAITokenUsage,
  getAITokenUsage,
  invalidateAIBudgetCache,
} from '../aiUsageService.js';
import { emitUsageLimitReached, emitUsageLimitExceeded } from '../../subscriptions/events.js';

describe('aiUsageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordAITokenUsage', () => {
    it('increments both tokensUsed and creditsUsedMilli on the update branch (nano tier: 1:1 weight)', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({} as any);

      await recordAITokenUsage('org-1', 2000, 'nano');

      expect(prisma.aIUsage.upsert).toHaveBeenCalledTimes(1);
      const call = vi.mocked(prisma.aIUsage.upsert).mock.calls[0][0] as any;
      expect(call.update.tokensUsed).toEqual({ increment: 2000 });
      expect(call.update.creditsUsedMilli).toEqual({ increment: 2000 });
      expect(call.create.tokensUsed).toBe(2000);
      expect(call.create.creditsUsedMilli).toBe(2000);
    });

    it('increments creditsUsedMilli by the mini-tier weighted amount (default weight 5x) in both branches', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({} as any);

      await recordAITokenUsage('org-2', 2000, 'mini');

      const call = vi.mocked(prisma.aIUsage.upsert).mock.calls[0][0] as any;
      expect(call.update.tokensUsed).toEqual({ increment: 2000 });
      expect(call.update.creditsUsedMilli).toEqual({ increment: 10000 });
      expect(call.create.tokensUsed).toBe(2000);
      expect(call.create.creditsUsedMilli).toBe(10000);
    });

    it('does not emit any usage-limit event while usage stays below the 80% warning threshold', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 100,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 1000 } as any);
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 2000 } as any);

      await recordAITokenUsage('org-below-threshold', 1000, 'nano');

      expect(emitUsageLimitReached).not.toHaveBeenCalled();
      expect(emitUsageLimitExceeded).not.toHaveBeenCalled();
    });

    it('emits USAGE_LIMIT_REACHED exactly once when this request crosses the 80% threshold', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 100, // limit = 100,000 milli-credits
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 79_000 } as any); // 79%
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 81_000 } as any); // 81%

      await recordAITokenUsage('org-crossing-80', 2000, 'nano');

      expect(emitUsageLimitReached).toHaveBeenCalledTimes(1);
      expect(emitUsageLimitReached).toHaveBeenCalledWith(
        'org-crossing-80',
        undefined,
        'ai_credits',
        81,
        100,
        81
      );
      expect(emitUsageLimitExceeded).not.toHaveBeenCalled();
    });

    it('does not re-emit USAGE_LIMIT_REACHED when usage was already past 80% before this request', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 100,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 85_000 } as any); // 85%
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 90_000 } as any); // 90%

      await recordAITokenUsage('org-already-warned', 5000, 'nano');

      expect(emitUsageLimitReached).not.toHaveBeenCalled();
      expect(emitUsageLimitExceeded).not.toHaveBeenCalled();
    });

    it('emits USAGE_LIMIT_EXCEEDED exactly once when this request crosses 100%, not USAGE_LIMIT_REACHED', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 100, // limit = 100,000 milli-credits
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 95_000 } as any); // 95%
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 105_000 } as any); // 105%

      await recordAITokenUsage('org-crossing-100', 10_000, 'nano');

      expect(emitUsageLimitExceeded).toHaveBeenCalledTimes(1);
      expect(emitUsageLimitExceeded).toHaveBeenCalledWith(
        'org-crossing-100',
        undefined,
        'ai_credits',
        105,
        100
      );
      expect(emitUsageLimitReached).not.toHaveBeenCalled();
    });

    it('does not re-emit USAGE_LIMIT_EXCEEDED when usage was already over the limit before this request', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 100,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 110_000 } as any); // already over
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 120_000 } as any);

      await recordAITokenUsage('org-already-exceeded', 10_000, 'nano');

      expect(emitUsageLimitExceeded).not.toHaveBeenCalled();
      expect(emitUsageLimitReached).not.toHaveBeenCalled();
    });

    it('treats a first-usage org (no prior AIUsage row) as starting from zero for threshold crossing', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'free',
        aiCreditsLimit: null, // falls back to AI_CREDIT_LIMITS_FALLBACK.free (200 credits)
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 250_000 } as any); // 250 credits > 200 limit

      await recordAITokenUsage('org-first-usage', 250_000, 'nano');

      expect(emitUsageLimitExceeded).toHaveBeenCalledTimes(1);
      expect(emitUsageLimitExceeded).toHaveBeenCalledWith(
        'org-first-usage',
        undefined,
        'ai_credits',
        250,
        200
      );
    });

    it('keys the upsert to the org billing-cycle periodStart/periodEnd from Subscription, not the calendar month', async () => {
      const currentPeriodStart = new Date('2024-03-15T00:00:00.000Z');
      const currentPeriodEnd = new Date('2024-04-14T23:59:59.999Z');
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        currentPeriodStart,
        currentPeriodEnd,
      } as any);
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({} as any);

      await recordAITokenUsage('org-billing-cycle', 1000, 'nano');

      const call = vi.mocked(prisma.aIUsage.upsert).mock.calls[0][0] as any;
      expect(call.where.organizationId_periodStart).toEqual({
        organizationId: 'org-billing-cycle',
        periodStart: currentPeriodStart,
      });
      expect(call.create.periodStart).toBe(currentPeriodStart);
      expect(call.create.periodEnd).toBe(currentPeriodEnd);
    });
  });

  describe('checkAITokenBudget', () => {
    it('allows usage below the explicit aiCreditsLimit and blocks at/above it', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 200,
      } as any);

      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValueOnce({
        creditsUsedMilli: 199_999,
      } as any);
      const allowedResult = await checkAITokenBudget('org-allowed');
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.limit).toBe(200);
      expect(allowedResult.used).toBeCloseTo(199.999, 3);

      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValueOnce({
        creditsUsedMilli: 200_000,
      } as any);
      const blockedResult = await checkAITokenBudget('org-blocked');
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.limit).toBe(200);
    });

    it('falls back to the plan default when aiCreditsLimit is null (not yet synced from Chargebee)', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: null,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);

      const result = await checkAITokenBudget('org-null-limit');
      expect(result.limit).toBe(2000); // starter fallback, NOT unlimited
      expect(result.allowed).toBe(true);
    });

    it('falls back to the free plan default when there is no subscription row', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue(null);

      const result = await checkAITokenBudget('org-no-sub');
      expect(result.limit).toBe(200);
      expect(result.used).toBe(0);
      expect(result.allowed).toBe(true);
    });

    it('serves a cached blocked result within the TTL, then re-fetches after invalidateAIBudgetCache', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 200,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 200_000 } as any);

      const blocked = await checkAITokenBudget('org-reset');
      expect(blocked.allowed).toBe(false);

      // Simulate an admin reset zeroing the DB row without a cache-aware call.
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);
      const stillCached = await checkAITokenBudget('org-reset');
      expect(stillCached.allowed).toBe(false); // stale cache still in effect

      invalidateAIBudgetCache('org-reset');
      const fresh = await checkAITokenBudget('org-reset');
      expect(fresh.allowed).toBe(true);
    });

    it('blocks a past_due org regardless of remaining credits', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'advanced',
        aiCreditsLimit: 20_000,
        status: 'past_due',
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);

      const result = await checkAITokenBudget('org-past-due');
      expect(result.allowed).toBe(false);
    });

    it('falls back to the free allowance for a cancelled org instead of its last-synced paid limit', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'advanced',
        aiCreditsLimit: 20_000,
        status: 'cancelled',
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);

      const result = await checkAITokenBudget('org-cancelled');
      expect(result.limit).toBe(200); // free fallback, not the retained 20,000 advanced limit
      expect(result.allowed).toBe(true);
    });

    it('falls back to the free allowance for an expired org', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        status: 'expired',
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 250_000 } as any);

      const result = await checkAITokenBudget('org-expired');
      expect(result.limit).toBe(200);
      expect(result.allowed).toBe(false); // 250 credits used already exceeds the free 200 limit
    });

    it('leaves an active paid org unaffected', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'advanced',
        aiCreditsLimit: 20_000,
        status: 'active',
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 5_000_000 } as any);

      const result = await checkAITokenBudget('org-active');
      expect(result.limit).toBe(20_000);
      expect(result.allowed).toBe(true);
    });

    it('looks up AIUsage by the org billing-cycle periodStart from Subscription, not the calendar month', async () => {
      const currentPeriodStart = new Date('2024-03-15T00:00:00.000Z');
      const currentPeriodEnd = new Date('2024-04-14T23:59:59.999Z');
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        currentPeriodStart,
        currentPeriodEnd,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);

      await checkAITokenBudget('org-mid-cycle');

      expect(prisma.aIUsage.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-mid-cycle', periodStart: currentPeriodStart },
      });
    });

    it('a mid-cycle plan upgrade raises the limit without resetting usage already accrued this period', async () => {
      const currentPeriodStart = new Date('2024-03-15T00:00:00.000Z');
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        currentPeriodStart,
        currentPeriodEnd: new Date('2024-04-14T23:59:59.999Z'),
      } as any);
      // 1,500 of the 2,000 starter credits already used earlier this period.
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 1_500_000 } as any);

      const beforeUpgrade = await checkAITokenBudget('org-upgrade');
      expect(beforeUpgrade.used).toBe(1500);
      expect(beforeUpgrade.limit).toBe(2000);
      expect(beforeUpgrade.allowed).toBe(true);

      invalidateAIBudgetCache('org-upgrade');

      // Upgrade to advanced mid-period: aiCreditsLimit jumps, periodStart/currentPeriodEnd
      // is untouched by syncSubscriptionFromWebhook on a plan-change event (only a real
      // renewal moves the period), and the AIUsage row is untouched too.
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'advanced',
        aiCreditsLimit: 20_000,
        currentPeriodStart,
        currentPeriodEnd: new Date('2024-04-14T23:59:59.999Z'),
      } as any);

      const afterUpgrade = await checkAITokenBudget('org-upgrade');
      expect(afterUpgrade.used).toBe(1500); // usage carries over, unchanged
      expect(afterUpgrade.limit).toBe(20_000); // limit raised immediately
      expect(afterUpgrade.allowed).toBe(true);
    });

    it('falls back to calendar-month boundaries when the subscription row is missing period fields', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-20T12:00:00.000Z'));
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        // currentPeriodStart/currentPeriodEnd absent — e.g. pre-backfill org
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);

      await checkAITokenBudget('org-pre-backfill');

      const call = vi.mocked(prisma.aIUsage.findFirst).mock.calls[0][0] as any;
      expect(call.where.periodStart).toEqual(new Date(2024, 2, 1));

      vi.useRealTimers();
    });
  });

  describe('getAITokenUsage', () => {
    it('returns creditsUsed rounded to 1dp, creditsLimit, and a token-equivalent limit shim', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: null,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({
        tokensUsed: 5000,
        creditsUsedMilli: 12_345,
      } as any);

      const result = await getAITokenUsage('org-3');

      expect(result.used).toBe(5000); // raw tokens, unchanged
      expect(result.creditsUsed).toBeCloseTo(12.3, 5);
      expect(result.creditsLimit).toBe(2000); // starter fallback
      expect(result.limit).toBe(result.creditsLimit * 1000);
      expect(typeof result.resetAt).toBe('string');
    });

    it('reports resetAt as the org billing-cycle currentPeriodEnd, not the calendar month end', async () => {
      const currentPeriodStart = new Date('2024-03-15T00:00:00.000Z');
      const currentPeriodEnd = new Date('2024-04-14T23:59:59.999Z');
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        currentPeriodStart,
        currentPeriodEnd,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({
        tokensUsed: 0,
        creditsUsedMilli: 0,
      } as any);

      const result = await getAITokenUsage('org-mid-cycle-reset');

      expect(result.resetAt).toBe(currentPeriodEnd.toISOString());
    });
  });
});
