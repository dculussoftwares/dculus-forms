import { prisma } from '../lib/prisma.js';
import { AI_CREDIT_LIMITS_FALLBACK, tokensToMilliCredits, type AIModelTier } from '../lib/ai.js';
import { logger } from '../lib/logger.js';
import { emitUsageLimitReached, emitUsageLimitExceeded } from '../subscriptions/events.js';

/**
 * Design decision (issue #83 — check-then-record race on AI credit budget):
 *
 * `checkAITokenBudget` (read) and `recordAITokenUsage` (increment) are not, and cannot
 * cheaply be made, a single atomic operation: the AI credit cost of a turn is only known
 * once the (potentially long-running, streaming, minutes-long) model call completes, so
 * there is an unavoidable gap between "check" and "record". A full atomic fix requires
 * reserving a conservative cost ceiling up front and refunding the difference afterwards —
 * which in turn requires guaranteed refund-on-every-error/disconnect path through the
 * streaming chat route. That's real, but disproportionate, risk for the realistic
 * concurrency this guards against (a handful of simultaneous requests from one org).
 *
 * Chosen mitigation — bounded overage, remove the false precision from the cache:
 *   1. `checkAITokenBudget` is a soft pre-check, not a hard gate — document it as such.
 *   2. The 30s `budgetCache` is the biggest amplifier of the race (it can serve a stale
 *      `allowed: true` long after the real usage crossed the limit), so it is bypassed
 *      entirely once an org's last-known usage is near its limit (`NEAR_LIMIT_CACHE_BYPASS_RATIO`)
 *      — far from the limit, a stale cached read can never cause an overshoot.
 *   3. `recordAITokenUsage` invalidates the cache both before AND after its write, closing
 *      the window where a concurrent check could repopulate the cache with a pre-increment
 *      value while the write is in flight. A per-org write-generation counter closes the
 *      remaining sliver of that window: a check whose DB read overlaps a record's
 *      read-modify-write can still finish and call `budgetCache.set` *after* the record's
 *      post-write delete — the generation guard makes `checkAITokenBudget` skip caching
 *      (still returning its answer for that one call) whenever a write started or finished
 *      anywhere between the read beginning and the cache write.
 *   4. `recordAITokenUsage` logs a structured warning when a write pushes an org over its
 *      limit, so overage from genuinely concurrent requests is observable instead of silent.
 *      It cannot un-spend tokens already consumed by an in-flight call — this is a post-hoc
 *      detector, not a preventer — but it guarantees the *next* request is blocked immediately.
 *
 * Net effect: the residual race window is bounded to the wall-clock overlap of concurrent
 * in-flight requests for the same org (inherent to "concurrent" by definition), not amplified
 * by the cache. Full atomic reservation remains an option for a future, dedicated pass if
 * real-world overage from this residual window turns out to matter in practice.
 */
const budgetCache = new Map<string, { result: { allowed: boolean; used: number; limit: number }; cachedAt: number }>();
const BUDGET_CACHE_TTL_MS = 30_000;

// Once an org's last-known usage is within this fraction of its limit, cached reads are
// bypassed entirely — see design decision above.
const NEAR_LIMIT_CACHE_BYPASS_RATIO = 0.9;

function isNearLimit(used: number, limit: number): boolean {
  return limit > 0 && used >= limit * NEAR_LIMIT_CACHE_BYPASS_RATIO;
}

// Per-org write-generation counter — see point 3 of the design decision above. Bumped both
// before and after every `recordAITokenUsage` write. `checkAITokenBudget` only populates the
// cache if the generation is unchanged between when its DB read started and when it's about
// to write to the cache; any bump in between means a write may have raced it, so the result
// is still returned but not cached.
const writeGeneration = new Map<string, number>();

function bumpWriteGeneration(organizationId: string): void {
  writeGeneration.set(organizationId, (writeGeneration.get(organizationId) ?? 0) + 1);
}

function currentWriteGeneration(organizationId: string): number {
  return writeGeneration.get(organizationId) ?? 0;
}

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
 * One-time bridge from the old calendar-month-keyed `AIUsage` rows to the new
 * Chargebee-billing-cycle key (issue #77 acceptance criteria: existing rows must be
 * migrated or handled without breaking `checkAITokenBudget` for orgs mid-transition).
 *
 * Without this, an org whose billing term started earlier in the current calendar
 * month would have usage from before this deploy sitting under the old calendar-month
 * key — invisible to lookups against the new billing-cycle key, effectively granting a
 * fresh AI budget mid-cycle until the next Chargebee renewal. Rolls that legacy row's
 * totals onto the new key and deletes it so it isn't matched again.
 *
 * Deliberately narrow: only migrates when the billing term started in the *current*
 * calendar month, so the legacy row can be safely attributed to the current term.
 * Terms that started in an earlier calendar month would need to reconcile usage split
 * across multiple legacy rows at a month boundary — that's the historical reconciliation
 * the issue explicitly scoped out. Best-effort: failures are logged and swallowed, since
 * a missed migration only loses one month's carryover usage, not a hard failure.
 */
async function migrateLegacyPeriodUsage(
  organizationId: string,
  newStart: Date,
  newEnd: Date,
  subscription: SubscriptionPeriod
): Promise<void> {
  if (!subscription?.currentPeriodStart) return; // already on the calendar-month key

  const now = new Date();
  const legacyStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (legacyStart.getTime() === newStart.getTime()) return; // no key change to migrate from

  const sameCalendarMonth =
    subscription.currentPeriodStart.getFullYear() === legacyStart.getFullYear() &&
    subscription.currentPeriodStart.getMonth() === legacyStart.getMonth();
  if (!sameCalendarMonth) return; // legacy row (if any) predates this billing term

  try {
    const [existingNew, legacy] = await Promise.all([
      prisma.aIUsage.findFirst({ where: { organizationId, periodStart: newStart } }),
      prisma.aIUsage.findFirst({ where: { organizationId, periodStart: legacyStart } }),
    ]);
    if (existingNew || !legacy) return;

    await prisma.aIUsage.upsert({
      where: { organizationId_periodStart: { organizationId, periodStart: newStart } },
      update: {
        tokensUsed: { increment: legacy.tokensUsed },
        creditsUsedMilli: { increment: legacy.creditsUsedMilli },
      },
      create: {
        organizationId,
        periodStart: newStart,
        periodEnd: newEnd,
        tokensUsed: legacy.tokensUsed,
        creditsUsedMilli: legacy.creditsUsedMilli,
      },
    });
    await prisma.aIUsage.delete({ where: { id: legacy.id } });
  } catch {
    logger.warn(
      { organizationId },
      'Failed to migrate legacy calendar-month AI usage onto the billing-cycle period key'
    );
  }
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
 *
 * This is a soft pre-check, not an atomic guarantee: it can race with concurrent requests
 * from the same org that are simultaneously in flight (see design decision above). Treat
 * an `allowed: true` result as "very likely fine right now", not "guaranteed under budget".
 */
export async function checkAITokenBudget(organizationId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const hit = budgetCache.get(organizationId);
  if (
    hit &&
    Date.now() - hit.cachedAt < BUDGET_CACHE_TTL_MS &&
    !isNearLimit(hit.result.used, hit.result.limit)
  ) {
    return hit.result;
  }

  const generationAtStart = currentWriteGeneration(organizationId);

  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  const { start, end } = currentPeriod(subscription);
  await migrateLegacyPeriodUsage(organizationId, start, end, subscription);

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

  // Only cache if no recordAITokenUsage write started or finished while this read was in
  // flight — otherwise `usage` may already be stale by the time we're about to cache it.
  if (currentWriteGeneration(organizationId) === generationAtStart) {
    budgetCache.set(organizationId, { result, cachedAt: Date.now() });
  }
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
 *
 * Invalidates the budget cache both before and after the write (see design decision
 * above) and logs a warning if this write pushes the org over its limit — concurrent
 * requests can each have passed `checkAITokenBudget` before either recorded usage, so
 * this is the point where that bounded overage becomes observable.
 */
export async function recordAITokenUsage(
  organizationId: string,
  tokensUsed: number,
  tier: AIModelTier
): Promise<void> {
  bumpWriteGeneration(organizationId);
  budgetCache.delete(organizationId); // invalidate before the write starts
  // Fetched once (not select-limited): currentPeriod() needs currentPeriodStart/End,
  // and effectiveCreditLimit() below needs planId/aiCreditsLimit/status from the same row.
  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  const { start, end } = currentPeriod(subscription);
  await migrateLegacyPeriodUsage(organizationId, start, end, subscription);
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

    const limitCredits = effectiveCreditLimit(subscription);
    checkAICreditLimits(organizationId, previousMilli, updated.creditsUsedMilli, limitCredits);

    const overageMilli = updated.creditsUsedMilli - limitCredits * 1000;
    if (overageMilli > 0) {
      logger.warn(
        { organizationId, creditsUsedMilli: updated.creditsUsedMilli, limitMilli: limitCredits * 1000, overageMilli },
        'AI credit budget exceeded — likely concurrent requests raced the budget check'
      );
    }
  } catch {
    logger.warn({ organizationId, tokensUsed, tier }, 'Failed to record AI token usage');
  } finally {
    bumpWriteGeneration(organizationId);
    budgetCache.delete(organizationId); // invalidate again in case a concurrent check repopulated it mid-write
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
  await migrateLegacyPeriodUsage(organizationId, start, end, subscription);

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
