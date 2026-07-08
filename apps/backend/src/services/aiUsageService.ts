import { prisma } from '../lib/prisma.js';
import { AI_CREDIT_LIMITS_FALLBACK, tokensToMilliCredits, type AIModelTier } from '../lib/ai.js';
import { logger } from '../lib/logger.js';
import { emitUsageLimitReached, emitUsageLimitExceeded } from '../subscriptions/events.js';

const budgetCache = new Map<string, { result: { allowed: boolean; used: number; limit: number }; cachedAt: number }>();
const BUDGET_CACHE_TTL_MS = 30_000;

// Mirrors WARNING_THRESHOLD in subscriptions/usageService.ts — kept as a separate constant
// since AI credits are enforced from this service, not usageService.ts.
const AI_CREDITS_WARNING_THRESHOLD = 80;

type SubscriptionPeriod = { currentPeriodStart: Date; currentPeriodEnd: Date } | null | undefined;

/**
 * AI credit periods follow the org's actual Chargebee billing cycle
 * (`Subscription.currentPeriodStart`/`currentPeriodEnd`) — the same source of
 * truth `viewsUsed`/`submissionsUsed` reset against. This keeps a mid-month
 * billing date from producing two different reset dates for the same org.
 *
 * Falls back to calendar-month boundaries when there's no synced subscription
 * yet (e.g. a pre-backfill org, or a subscription row missing period fields).
 */
function currentPeriod(subscription: SubscriptionPeriod): { start: Date; end: Date } {
  if (subscription?.currentPeriodStart && subscription?.currentPeriodEnd) {
    return { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd };
  }

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

  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  const { start } = currentPeriod(subscription);

  const usage = await prisma.aIUsage.findFirst({
    where: { organizationId, periodStart: start },
  });

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
 * Emits `USAGE_LIMIT_REACHED`/`USAGE_LIMIT_EXCEEDED` for `ai_credits` exactly once per
 * threshold crossing, mirroring `checkUsageLimits` in `subscriptions/usageService.ts`.
 * Unlike views/submissions (incremented one at a time), AI credit increments can jump by
 * an arbitrary amount in one request, so crossing is detected by comparing the
 * pre-increment and post-increment values rather than assuming a fixed step of 1.
 */
function checkAICreditLimits(
  organizationId: string,
  previousMilli: number,
  currentMilli: number,
  limitCredits: number
): void {
  const limitMilli = limitCredits * 1000;
  if (limitMilli <= 0) return;

  // Already over the limit before this request — the exceeded event already fired then.
  if (previousMilli > limitMilli) return;

  if (currentMilli > limitMilli) {
    const currentCredits = currentMilli / 1000;
    emitUsageLimitExceeded(organizationId, undefined, 'ai_credits', currentCredits, limitCredits);
    return;
  }

  const previousPercentage = (previousMilli / limitMilli) * 100;
  const currentPercentage = (currentMilli / limitMilli) * 100;

  if (currentPercentage >= AI_CREDITS_WARNING_THRESHOLD && previousPercentage < AI_CREDITS_WARNING_THRESHOLD) {
    const currentCredits = currentMilli / 1000;
    emitUsageLimitReached(organizationId, undefined, 'ai_credits', currentCredits, limitCredits, currentPercentage);
  }
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
  // Fetched once (not select-limited): currentPeriod() needs currentPeriodStart/End,
  // and effectiveCreditLimit() below needs planId/aiCreditsLimit/status from the same row.
  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  const { start, end } = currentPeriod(subscription);
  const creditsUsedMilli = tokensToMilliCredits(tokensUsed, tier);

  try {
    const existing = await prisma.aIUsage.findFirst({ where: { organizationId, periodStart: start } });
    const previousMilli = existing?.creditsUsedMilli ?? 0;

    const updated = await prisma.aIUsage.upsert({
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

    checkAICreditLimits(organizationId, previousMilli, updated.creditsUsedMilli, effectiveCreditLimit(subscription));
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
  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  const { start, end } = currentPeriod(subscription);

  const usage = await prisma.aIUsage.findFirst({ where: { organizationId, periodStart: start } });

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
