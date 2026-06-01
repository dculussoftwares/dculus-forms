import { prisma } from '../lib/prisma.js';
import { AI_TOKEN_LIMITS } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

const budgetCache = new Map<string, { result: { allowed: boolean; used: number; limit: number }; cachedAt: number }>();
const BUDGET_CACHE_TTL_MS = 30_000;

function currentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

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

  const planId = subscription?.planId ?? 'free';
  const limit = AI_TOKEN_LIMITS[planId] ?? AI_TOKEN_LIMITS.free;
  const used = usage?.tokensUsed ?? 0;
  const result = { allowed: used < limit, used, limit };

  budgetCache.set(organizationId, { result, cachedAt: Date.now() });
  return result;
}

export async function recordAITokenUsage(
  organizationId: string,
  tokensUsed: number
): Promise<void> {
  budgetCache.delete(organizationId); // invalidate so next check is fresh
  const { start, end } = currentPeriod();

  try {
    await prisma.aIUsage.upsert({
      where: { organizationId_periodStart: { organizationId, periodStart: start } },
      update: { tokensUsed: { increment: tokensUsed } },
      create: { organizationId, tokensUsed, periodStart: start, periodEnd: end },
    });
  } catch {
    logger.warn({ organizationId, tokensUsed }, 'Failed to record AI token usage');
  }
}

export async function getAITokenUsage(organizationId: string): Promise<{
  used: number;
  limit: number;
  resetAt: string;
}> {
  const { start, end } = currentPeriod();

  const [usage, subscription] = await Promise.all([
    prisma.aIUsage.findFirst({ where: { organizationId, periodStart: start } }),
    prisma.subscription.findUnique({ where: { organizationId } }),
  ]);

  const planId = subscription?.planId ?? 'free';
  return {
    used: usage?.tokensUsed ?? 0,
    limit: AI_TOKEN_LIMITS[planId] ?? AI_TOKEN_LIMITS.free,
    resetAt: end.toISOString(),
  };
}
