import { prisma } from '../lib/prisma.js';
import { AI_CREDIT_LIMITS_FALLBACK, tokensToMilliCredits, type AIModelTier } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

const budgetCache = new Map<string, { result: { allowed: boolean; used: number; limit: number }; cachedAt: number }>();
const BUDGET_CACHE_TTL_MS = 30_000;

function currentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Effective monthly AI-credit limit for an org.
 *
 * `Subscription.aiCreditsLimit` is populated by a Chargebee webhook sync (a later task).
 * `null`/missing means "not yet synced from Chargebee" — it is NOT unlimited — so we fall
 * back to the plan's default allowance in AI_CREDIT_LIMITS_FALLBACK, defaulting to `free`
 * if the plan itself is unrecognized.
 *
 * A cancelled/expired subscription keeps whatever `planId`/`aiCreditsLimit` it last synced
 * from Chargebee (cancellation doesn't change which plan item was on the subscription), so
 * without this check the org would retain paid-tier AI credits indefinitely. Fall back to
 * the free allowance instead — mirrors the views/submissions enforcement in usageService.ts.
 */
function effectiveCreditLimit(
  subscription: { planId: string; aiCreditsLimit: number | null; status: string } | null
): number {
  if (subscription && (subscription.status === 'cancelled' || subscription.status === 'expired')) {
    return AI_CREDIT_LIMITS_FALLBACK.free;
  }

  const planId = subscription?.planId ?? 'free';
  return (
    subscription?.aiCreditsLimit ??
    AI_CREDIT_LIMITS_FALLBACK[planId] ??
    AI_CREDIT_LIMITS_FALLBACK.free
  );
}

/**
 * Invalidates the in-memory budget cache for an org, forcing the next
 * `checkAITokenBudget` call to read fresh data instead of a stale cached result.
 */
export function invalidateAIBudgetCache(organizationId: string): void {
  budgetCache.delete(organizationId);
}

/**
 * Checks whether an org is within its monthly AI-credit budget.
 * `used`/`limit` are both in **credits** (not raw tokens) — 1 credit = 1,000 milli-credits.
 */
export async function checkAITokenBudget(organizationId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const hit = budgetCache.get(organizationId);
  if (hit && Date.now() - hit.cachedAt < BUDGET_CACHE_TTL_MS) return hit.result;

  const { start } = currentPeriod();

  const [usage, subscription] = await Promise.all([
    prisma.aIUsage.findFirst({
      where: { organizationId, periodStart: start },
    }),
    prisma.subscription.findUnique({ where: { organizationId } }),
  ]);

  const limit = effectiveCreditLimit(subscription);
  const creditsUsedMilli = usage?.creditsUsedMilli ?? 0;
  const used = creditsUsedMilli / 1000;

  // A past_due subscription means the last payment failed. Block AI credits until
  // payment recovers, regardless of remaining budget — consistent with how
  // checkUsageExceeded blocks views/submissions for the same status.
  const isPastDue = subscription?.status === 'past_due';
  const result = { allowed: !isPastDue && creditsUsedMilli < limit * 1000, used, limit };

  budgetCache.set(organizationId, { result, cachedAt: Date.now() });
  return result;
}

/**
 * Records AI usage for an org's current billing period. Increments both the raw
 * `tokensUsed` (kept as an audit trail) and `creditsUsedMilli` (the model-weighted
 * amount actually charged against the org's credit budget, per `tier`).
 */
export async function recordAITokenUsage(
  organizationId: string,
  tokensUsed: number,
  tier: AIModelTier
): Promise<void> {
  budgetCache.delete(organizationId); // invalidate so next check is fresh
  const { start, end } = currentPeriod();
  const creditsUsedMilli = tokensToMilliCredits(tokensUsed, tier);

  try {
    await prisma.aIUsage.upsert({
      where: { organizationId_periodStart: { organizationId, periodStart: start } },
      update: {
        tokensUsed: { increment: tokensUsed },
        creditsUsedMilli: { increment: creditsUsedMilli },
      },
      create: {
        organizationId,
        tokensUsed,
        creditsUsedMilli,
        periodStart: start,
        periodEnd: end,
      },
    });
  } catch {
    logger.warn({ organizationId, tokensUsed, tier }, 'Failed to record AI token usage');
  }
}

export async function getAITokenUsage(organizationId: string): Promise<{
  used: number;
  limit: number;
  resetAt: string;
  creditsUsed: number;
  creditsLimit: number;
}> {
  const { start, end } = currentPeriod();

  const [usage, subscription] = await Promise.all([
    prisma.aIUsage.findFirst({ where: { organizationId, periodStart: start } }),
    prisma.subscription.findUnique({ where: { organizationId } }),
  ]);

  const creditsLimit = effectiveCreditLimit(subscription);
  const creditsUsedMilli = usage?.creditsUsedMilli ?? 0;

  return {
    used: usage?.tokensUsed ?? 0, // raw tokens, unchanged (transition: existing GraphQL still reads this)
    // TRANSITION SHIM: nano-token-equivalent so the existing tokens-based UI meter still
    // renders sensibly until Task 6 switches it to credits.
    limit: creditsLimit * 1000,
    resetAt: end.toISOString(),
    creditsUsed: Math.round((creditsUsedMilli / 1000) * 10) / 10,
    creditsLimit,
  };
}
