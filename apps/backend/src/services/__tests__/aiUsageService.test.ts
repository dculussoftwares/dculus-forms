import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../lib/prisma.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    aIUsage: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
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

import { logger } from '../../lib/logger.js';
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

    it('increments creditsUsedMilli by the mini-tier weighted amount (default weight 3.75x) in both branches', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({} as any);

      await recordAITokenUsage('org-2', 2000, 'mini');

      const call = vi.mocked(prisma.aIUsage.upsert).mock.calls[0][0] as any;
      expect(call.update.tokensUsed).toEqual({ increment: 2000 });
      expect(call.update.creditsUsedMilli).toEqual({ increment: 7500 });
      expect(call.create.tokensUsed).toBe(2000);
      expect(call.create.creditsUsedMilli).toBe(7500);
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

    it('logs a warning when the write pushes the org over its limit (post-hoc overage detection)', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'free',
        aiCreditsLimit: null,
        status: 'active',
      } as any);
      // Free limit is 200 credits (200,000 milli). This write's post-increment total exceeds it.
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 205_000 } as any);

      await recordAITokenUsage('org-over', 41_000, 'nano');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-over', creditsUsedMilli: 205_000, overageMilli: 5_000 }),
        expect.stringContaining('AI credit budget exceeded')
      );
    });

    it('does not log an overage warning when the write stays within the limit', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'free',
        aiCreditsLimit: null,
        status: 'active',
      } as any);
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 100_000 } as any);

      await recordAITokenUsage('org-under', 10_000, 'nano');

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('invalidates the cache so a check immediately after reflects the just-recorded usage', async () => {
      // Seed the cache with an "allowed" result via a normal check.
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'free',
        aiCreditsLimit: null,
        status: 'active',
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);
      const seeded = await checkAITokenBudget('org-invalidate');
      expect(seeded.allowed).toBe(true);

      // Record usage that would push the org over budget.
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 250_000 } as any);
      await recordAITokenUsage('org-invalidate', 250_000, 'nano');

      // The next check must not be served from the stale pre-increment cache entry.
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 250_000 } as any);
      const rechecked = await checkAITokenBudget('org-invalidate');
      expect(rechecked.allowed).toBe(false);
      // seed check + recordAITokenUsage's internal previous-usage lookup + recheck — none
      // served from a stale cache entry.
      expect(prisma.aIUsage.findFirst).toHaveBeenCalledTimes(3);
    });

    it('does not cache a stale result from a check whose read overlapped a concurrent write', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'free',
        aiCreditsLimit: null,
        status: 'active',
      } as any);

      // A check starts and its DB read is deliberately left pending so a concurrent
      // recordAITokenUsage write can run to completion (including both of its cache
      // invalidations) while the check's read is still in flight.
      let resolveFindFirst!: (value: unknown) => void;
      vi.mocked(prisma.aIUsage.findFirst).mockReturnValueOnce(
        new Promise((resolve) => { resolveFindFirst = resolve; }) as any
      );
      const overlappingCheck = checkAITokenBudget('org-overlap');

      vi.mocked(prisma.aIUsage.upsert).mockResolvedValueOnce({ creditsUsedMilli: 50_000 } as any);
      await recordAITokenUsage('org-overlap', 50_000, 'nano');

      // Now let the check's stale (pre-write) read resolve.
      resolveFindFirst({ creditsUsedMilli: 0 });
      const staleResult = await overlappingCheck;
      expect(staleResult.used).toBe(0); // reflects what it read, not a bug in the read itself

      // The bug this guards against: without the write-generation check, the line above would
      // have cached { used: 0, allowed: true } *after* recordAITokenUsage's post-write
      // invalidation already ran, re-introducing a stale cache entry. Assert a subsequent
      // check is not served from any such entry and hits the DB for fresh data instead.
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValueOnce({ creditsUsedMilli: 50_000 } as any);
      const freshCheck = await checkAITokenBudget('org-overlap');
      expect(freshCheck.used).toBe(50);
      // overlapping check + recordAITokenUsage's internal previous-usage lookup + fresh
      // check — no cache hit.
      expect(prisma.aIUsage.findFirst).toHaveBeenCalledTimes(3);
    });
  });

  describe('check-then-record race (issue #83)', () => {
    it('bounds concurrent overage to at most one in-flight request worth of credits, and surfaces it via a warning', async () => {
      // Two concurrent requests near the 200-credit free limit. Org is at 180 credits used;
      // each request costs 15 credits (nano, 15,000 raw tokens = 15,000 milli-credits).
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'free',
        aiCreditsLimit: null,
        status: 'active',
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 180_000 } as any);

      // Both requests' pre-flight checks race and read the same pre-increment state — this
      // is the accepted, documented race: it is not eliminated, only bounded (see design
      // decision in aiUsageService.ts).
      const checkA = await checkAITokenBudget('org-race');
      invalidateAIBudgetCache('org-race'); // simulate the second request's check missing the cache too
      const checkB = await checkAITokenBudget('org-race');
      expect(checkA.allowed).toBe(true);
      expect(checkB.allowed).toBe(true);

      // Both requests complete and record their usage. The first keeps the org within budget
      // (180 + 15 = 195 <= 200); the second is the one that tips it over and must be flagged.
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValueOnce({ creditsUsedMilli: 195_000 } as any);
      await recordAITokenUsage('org-race', 15_000, 'nano');
      expect(logger.warn).not.toHaveBeenCalled();

      vi.mocked(prisma.aIUsage.upsert).mockResolvedValueOnce({ creditsUsedMilli: 210_000 } as any);
      await recordAITokenUsage('org-race', 15_000, 'nano');

      // Overage is bounded to exactly one request's worth of credits (15,000 milli), not
      // unbounded — this is the explicit, accepted bound from the design decision.
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-race', creditsUsedMilli: 210_000, overageMilli: 10_000 }),
        expect.stringContaining('AI credit budget exceeded')
      );
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

    it('serves a cached allowed result within the TTL when comfortably under the limit, until invalidated', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 200,
      } as any);
      // 50/200 credits used — well under the 90% near-limit bypass threshold.
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 50_000 } as any);

      const first = await checkAITokenBudget('org-cache-hit');
      expect(first.allowed).toBe(true);

      // DB now shows the org over budget, but the cached (far-from-limit) result should
      // still be served within the TTL — this is the caching behaviour the TTL exists for.
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 200_000 } as any);
      const stillCached = await checkAITokenBudget('org-cache-hit');
      expect(stillCached.allowed).toBe(true);
      expect(prisma.aIUsage.findFirst).toHaveBeenCalledTimes(1);

      invalidateAIBudgetCache('org-cache-hit');
      const fresh = await checkAITokenBudget('org-cache-hit');
      expect(fresh.allowed).toBe(false);
    });

    it('never serves a stale result from cache once usage is near the limit (bypasses cache automatically)', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 200,
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 200_000 } as any);

      const blocked = await checkAITokenBudget('org-near-limit');
      expect(blocked.allowed).toBe(false);

      // Simulate an admin reset zeroing the DB row. Unlike the comfortably-under-limit case,
      // a near-limit (or over-limit) cached result is never trusted — every call re-fetches,
      // so the reset takes effect immediately with no manual invalidateAIBudgetCache call.
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);
      const afterReset = await checkAITokenBudget('org-near-limit');
      expect(afterReset.allowed).toBe(true);
      expect(prisma.aIUsage.findFirst).toHaveBeenCalledTimes(2); // both calls hit the DB
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

  describe('legacy calendar-month AIUsage migration (issue #77)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('rolls a same-month legacy calendar-key row onto the billing-cycle key and deletes the legacy row', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0)); // "now": 2026-07-20

      const currentPeriodStart = new Date(2026, 6, 5); // billing term started 2026-07-05
      const currentPeriodEnd = new Date(2026, 7, 4, 23, 59, 59, 999);
      const legacyStart = new Date(2026, 6, 1); // pre-deploy calendar-month key

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        currentPeriodStart,
        currentPeriodEnd,
      } as any);

      (prisma.aIUsage.findFirst as any).mockImplementation(async ({ where }: any) => {
        if (where.periodStart.getTime() === legacyStart.getTime()) {
          return { id: 'legacy-row', tokensUsed: 3000, creditsUsedMilli: 450_000 } as any;
        }
        return null; // nothing yet under the new billing-cycle key
      });
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.aIUsage.delete).mockResolvedValue({} as any);

      await checkAITokenBudget('org-migrate');

      expect(prisma.aIUsage.upsert).toHaveBeenCalledWith({
        where: { organizationId_periodStart: { organizationId: 'org-migrate', periodStart: currentPeriodStart } },
        update: { tokensUsed: { increment: 3000 }, creditsUsedMilli: { increment: 450_000 } },
        create: {
          organizationId: 'org-migrate',
          periodStart: currentPeriodStart,
          periodEnd: currentPeriodEnd,
          tokensUsed: 3000,
          creditsUsedMilli: 450_000,
        },
      });
      expect(prisma.aIUsage.delete).toHaveBeenCalledWith({ where: { id: 'legacy-row' } });
    });

    it('does nothing when there is no legacy row to migrate', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));

      const currentPeriodStart = new Date(2026, 6, 5);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        currentPeriodStart,
        currentPeriodEnd: new Date(2026, 7, 4, 23, 59, 59, 999),
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue(null);

      await checkAITokenBudget('org-no-legacy');

      expect(prisma.aIUsage.upsert).not.toHaveBeenCalled();
      expect(prisma.aIUsage.delete).not.toHaveBeenCalled();
    });

    it('does nothing when the billing-cycle key already has a row (already migrated or genuinely fresh)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));

      const currentPeriodStart = new Date(2026, 6, 5);
      const legacyStart = new Date(2026, 6, 1);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        currentPeriodStart,
        currentPeriodEnd: new Date(2026, 7, 4, 23, 59, 59, 999),
      } as any);
      (prisma.aIUsage.findFirst as any).mockImplementation(async ({ where }: any) => {
        if (where.periodStart.getTime() === currentPeriodStart.getTime()) {
          return { id: 'new-row', tokensUsed: 10, creditsUsedMilli: 10_000 } as any;
        }
        if (where.periodStart.getTime() === legacyStart.getTime()) {
          return { id: 'legacy-row', tokensUsed: 3000, creditsUsedMilli: 450_000 } as any;
        }
        return null;
      });

      await checkAITokenBudget('org-already-migrated');

      expect(prisma.aIUsage.upsert).not.toHaveBeenCalled();
      expect(prisma.aIUsage.delete).not.toHaveBeenCalled();
    });

    it('skips migration when the billing term started in an earlier calendar month', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0)); // "now": July 2026

      // Term started in June — a July-keyed legacy row (if any) can't be safely attributed
      // to this term without splitting usage at the month boundary (out of scope).
      const currentPeriodStart = new Date(2026, 5, 15);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        currentPeriodStart,
        currentPeriodEnd: new Date(2026, 6, 14, 23, 59, 59, 999),
      } as any);
      vi.mocked(prisma.aIUsage.findFirst).mockResolvedValue({ creditsUsedMilli: 0 } as any);

      await checkAITokenBudget('org-earlier-term');

      // Only the main lookup runs — no legacy-row probe.
      expect(prisma.aIUsage.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.aIUsage.upsert).not.toHaveBeenCalled();
    });

    it('carries migrated usage forward through recordAITokenUsage so it is not lost on the first post-deploy write', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));

      const currentPeriodStart = new Date(2026, 6, 5);
      const currentPeriodEnd = new Date(2026, 7, 4, 23, 59, 59, 999);
      const legacyStart = new Date(2026, 6, 1);

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        planId: 'starter',
        aiCreditsLimit: 2_000,
        currentPeriodStart,
        currentPeriodEnd,
      } as any);

      // First findFirst call (inside migration, for the legacy key) returns the legacy row;
      // all other findFirst calls (new-key probes) return null until the migration upsert lands.
      (prisma.aIUsage.findFirst as any).mockImplementation(async ({ where }: any) => {
        if (where.periodStart.getTime() === legacyStart.getTime()) {
          return { id: 'legacy-row', tokensUsed: 3000, creditsUsedMilli: 450_000 } as any;
        }
        return null;
      });
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({ creditsUsedMilli: 451_000 } as any);
      vi.mocked(prisma.aIUsage.delete).mockResolvedValue({} as any);

      await recordAITokenUsage('org-migrate-record', 1000, 'nano');

      // Migration upsert (rolling the legacy 450,000 forward) plus the normal record upsert.
      expect(prisma.aIUsage.upsert).toHaveBeenCalledTimes(2);
      const migrationCall = vi.mocked(prisma.aIUsage.upsert).mock.calls[0][0] as any;
      expect(migrationCall.update.creditsUsedMilli).toEqual({ increment: 450_000 });
      expect(prisma.aIUsage.delete).toHaveBeenCalledWith({ where: { id: 'legacy-row' } });
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
