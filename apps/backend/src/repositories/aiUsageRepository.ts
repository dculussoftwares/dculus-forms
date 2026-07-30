import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for all AIUsage data access.
 * Note: the Prisma client accessor is `prisma.aIUsage` (capital I, from the
 * `AIUsage` model name), not `prisma.aiUsage`.
 */
export const createAiUsageRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findFirst = <T extends Prisma.AIUsageFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AIUsageFindFirstArgs>
  ) => prisma.aIUsage.findFirst(args);

  const upsert = <T extends Prisma.AIUsageUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIUsageUpsertArgs>
  ) => prisma.aIUsage.upsert(args);

  const remove = <T extends Prisma.AIUsageDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIUsageDeleteArgs>
  ) => prisma.aIUsage.delete(args);

  const aggregate = <T extends Prisma.AIUsageAggregateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIUsageAggregateArgs>
  ) => prisma.aIUsage.aggregate(args);

  const updateMany = <T extends Prisma.AIUsageUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIUsageUpdateManyArgs>
  ) => prisma.aIUsage.updateMany(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * Find the usage row for an org's given billing/calendar period, if any.
   */
  const findByOrganizationAndPeriod = async (
    organizationId: string,
    periodStart: Date
  ) => prisma.aIUsage.findFirst({ where: { organizationId, periodStart } });

  /**
   * Upsert the usage row for an org's current period, incrementing
   * `tokensUsed`/`creditsUsedMilli` on an existing row or creating a fresh one.
   */
  const upsertPeriodUsage = async (
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
    tokensUsed: number,
    creditsUsedMilli: number
  ) =>
    prisma.aIUsage.upsert({
      where: { organizationId_periodStart: { organizationId, periodStart } },
      update: {
        tokensUsed: { increment: tokensUsed },
        creditsUsedMilli: { increment: creditsUsedMilli },
      },
      create: {
        organizationId,
        periodStart,
        periodEnd,
        tokensUsed,
        creditsUsedMilli,
      },
    });

  /**
   * Merge a legacy calendar-month-keyed row's totals onto the new billing-cycle
   * key and delete the legacy row.
   */
  const migratePeriodUsage = async (
    organizationId: string,
    fromPeriodStart: Date,
    toPeriodStart: Date,
    toPeriodEnd: Date,
    legacyUsageId: string,
    tokensUsed: number,
    creditsUsedMilli: number
  ) => {
    await prisma.aIUsage.upsert({
      where: { organizationId_periodStart: { organizationId, periodStart: toPeriodStart } },
      update: {
        tokensUsed: { increment: tokensUsed },
        creditsUsedMilli: { increment: creditsUsedMilli },
      },
      create: {
        organizationId,
        periodStart: toPeriodStart,
        periodEnd: toPeriodEnd,
        tokensUsed,
        creditsUsedMilli,
      },
    });
    await prisma.aIUsage.delete({ where: { id: legacyUsageId } });
  };

  /**
   * Sum of `tokensUsed` across every period recorded for an org — used by the
   * admin usage-reset flow to report what's about to be zeroed out.
   */
  const sumTokensUsedByOrganization = async (organizationId: string) =>
    prisma.aIUsage.aggregate({
      where: { organizationId },
      _sum: { tokensUsed: true },
    });

  /**
   * Zero out every usage row for an org — used by the admin usage-reset flow.
   */
  const resetUsageByOrganization = async (organizationId: string) =>
    prisma.aIUsage.updateMany({
      where: { organizationId },
      data: { tokensUsed: 0, creditsUsedMilli: 0 },
    });

  return {
    // Generic operations (used when custom queries are needed)
    findFirst,
    upsert,
    delete: remove,
    aggregate,
    updateMany,

    // Domain helpers (preferred for service layer)
    findByOrganizationAndPeriod,
    upsertPeriodUsage,
    migratePeriodUsage,
    sumTokensUsedByOrganization,
    resetUsageByOrganization,
  };
};

export type AiUsageRepository = ReturnType<typeof createAiUsageRepository>;

export const aiUsageRepository = createAiUsageRepository();
