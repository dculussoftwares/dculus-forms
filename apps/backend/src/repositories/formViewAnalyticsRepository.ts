import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createFormViewAnalyticsRepository = (
  context?: RepositoryContext
) => {
  const prisma = resolvePrisma(context);

  const create = <T extends Prisma.FormViewAnalyticsCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormViewAnalyticsCreateArgs>
  ) => prisma.formViewAnalytics.create(args);

  const updateMany = <T extends Prisma.FormViewAnalyticsUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormViewAnalyticsUpdateManyArgs>
  ) => prisma.formViewAnalytics.updateMany(args);

  const count = (args?: Prisma.FormViewAnalyticsCountArgs) =>
    prisma.formViewAnalytics.count(args);

  // Prisma's groupBy overloads require a non-optional `orderBy` in the intersection type,
  // which the declared GroupByArgs type does not satisfy — `as any` is the standard workaround.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupBy = (args: Prisma.FormViewAnalyticsGroupByArgs) =>
    prisma.formViewAnalytics.groupBy(args as any);

  const findMany = <T extends Prisma.FormViewAnalyticsFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormViewAnalyticsFindManyArgs>
  ) => prisma.formViewAnalytics.findMany(args);

  const createViewEvent = async (
    data: Prisma.FormViewAnalyticsUncheckedCreateInput
  ) =>
    prisma.formViewAnalytics.create({
      data,
    });

  const updateSessionMetrics = async (
    where: Prisma.FormViewAnalyticsWhereInput,
    data: Prisma.FormViewAnalyticsUpdateManyMutationInput
  ) =>
    prisma.formViewAnalytics.updateMany({
      where,
      data,
    });

  type DailyViewRow = { date: string; views: bigint; sessions: bigint };

  const countDistinctSessions = async (
    formId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<number> => {
    if (timeRange) {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "sessionId") as count
        FROM "form_view_analytics"
        WHERE "formId" = ${formId}
          AND "viewedAt" >= ${timeRange.start}
          AND "viewedAt" <= ${timeRange.end}
      `;
      return Number(result[0].count);
    }
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "sessionId") as count
      FROM "form_view_analytics"
      WHERE "formId" = ${formId}
    `;
    return Number(result[0].count);
  };

  const getDailyViewStats = async (
    formId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<Array<{ date: string; views: number; sessions: number }>> => {
    let rows: DailyViewRow[];
    if (timeRange) {
      rows = await prisma.$queryRaw<DailyViewRow[]>`
        SELECT
          TO_CHAR("viewedAt", 'YYYY-MM-DD') AS date,
          COUNT(*) AS views,
          COUNT(DISTINCT "sessionId") AS sessions
        FROM "form_view_analytics"
        WHERE "formId" = ${formId}
          AND "viewedAt" >= ${timeRange.start}
          AND "viewedAt" <= ${timeRange.end}
        GROUP BY TO_CHAR("viewedAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `;
    } else {
      rows = await prisma.$queryRaw<DailyViewRow[]>`
        SELECT
          TO_CHAR("viewedAt", 'YYYY-MM-DD') AS date,
          COUNT(*) AS views,
          COUNT(DISTINCT "sessionId") AS sessions
        FROM "form_view_analytics"
        WHERE "formId" = ${formId}
        GROUP BY TO_CHAR("viewedAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `;
    }
    return rows.map(row => ({
      date: row.date,
      views: Number(row.views),
      sessions: Number(row.sessions),
    }));
  };

  return {
    create,
    updateMany,
    count,
    groupBy,
    findMany,
    createViewEvent,
    updateSessionMetrics,
    countDistinctSessions,
    getDailyViewStats,
  };
};

export type FormViewAnalyticsRepository = ReturnType<
  typeof createFormViewAnalyticsRepository
>;

export const formViewAnalyticsRepository =
  createFormViewAnalyticsRepository();
