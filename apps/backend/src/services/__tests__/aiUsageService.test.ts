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

import {
  checkAITokenBudget,
  recordAITokenUsage,
  getAITokenUsage,
} from '../aiUsageService.js';

describe('aiUsageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordAITokenUsage', () => {
    it('increments both tokensUsed and creditsUsedMilli on the update branch (nano tier: 1:1 weight)', async () => {
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
      vi.mocked(prisma.aIUsage.upsert).mockResolvedValue({} as any);

      await recordAITokenUsage('org-2', 2000, 'mini');

      const call = vi.mocked(prisma.aIUsage.upsert).mock.calls[0][0] as any;
      expect(call.update.tokensUsed).toEqual({ increment: 2000 });
      expect(call.update.creditsUsedMilli).toEqual({ increment: 10000 });
      expect(call.create.tokensUsed).toBe(2000);
      expect(call.create.creditsUsedMilli).toBe(10000);
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
  });
});
