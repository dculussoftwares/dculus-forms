import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createFormSubmissionAnalyticsRepository = (
  context?: RepositoryContext
) => {
  const prisma = resolvePrisma(context);

  const create = <T extends Prisma.FormSubmissionAnalyticsCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormSubmissionAnalyticsCreateArgs>
  ) => prisma.formSubmissionAnalytics.create(args);

  const count = (args?: Prisma.FormSubmissionAnalyticsCountArgs) =>
    prisma.formSubmissionAnalytics.count(args);

  // Prisma's groupBy overloads require a non-optional `orderBy` in the intersection type,
  // which the declared GroupByArgs type does not satisfy — `as any` is the standard workaround.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupBy = (args: Prisma.FormSubmissionAnalyticsGroupByArgs) =>
    prisma.formSubmissionAnalytics.groupBy(args as any);

  const findMany = <T extends Prisma.FormSubmissionAnalyticsFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormSubmissionAnalyticsFindManyArgs>
  ) => prisma.formSubmissionAnalytics.findMany(args);

  const createSubmissionEvent = async (
    data: Prisma.FormSubmissionAnalyticsUncheckedCreateInput
  ) =>
    prisma.formSubmissionAnalytics.create({
      data,
    });

  type DailySubmissionRow = { date: string; submissions: bigint; sessions: bigint };

  const countDistinctSessions = async (
    formId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<number> => {
    if (timeRange) {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "sessionId") as count
        FROM "form_submission_analytics"
        WHERE "formId" = ${formId}
          AND "submittedAt" >= ${timeRange.start}
          AND "submittedAt" <= ${timeRange.end}
      `;
      return Number(result[0].count);
    }
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "sessionId") as count
      FROM "form_submission_analytics"
      WHERE "formId" = ${formId}
    `;
    return Number(result[0].count);
  };

  const getDailySubmissionStats = async (
    formId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<Array<{ date: string; submissions: number; sessions: number }>> => {
    let rows: DailySubmissionRow[];
    if (timeRange) {
      rows = await prisma.$queryRaw<DailySubmissionRow[]>`
        SELECT
          TO_CHAR("submittedAt", 'YYYY-MM-DD') AS date,
          COUNT(*) AS submissions,
          COUNT(DISTINCT "sessionId") AS sessions
        FROM "form_submission_analytics"
        WHERE "formId" = ${formId}
          AND "submittedAt" >= ${timeRange.start}
          AND "submittedAt" <= ${timeRange.end}
        GROUP BY TO_CHAR("submittedAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `;
    } else {
      rows = await prisma.$queryRaw<DailySubmissionRow[]>`
        SELECT
          TO_CHAR("submittedAt", 'YYYY-MM-DD') AS date,
          COUNT(*) AS submissions,
          COUNT(DISTINCT "sessionId") AS sessions
        FROM "form_submission_analytics"
        WHERE "formId" = ${formId}
        GROUP BY TO_CHAR("submittedAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `;
    }
    return rows.map(row => ({
      date: row.date,
      submissions: Number(row.submissions),
      sessions: Number(row.sessions),
    }));
  };

  return {
    create,
    count,
    groupBy,
    findMany,
    createSubmissionEvent,
    countDistinctSessions,
    getDailySubmissionStats,
  };
};

export type FormSubmissionAnalyticsRepository = ReturnType<
  typeof createFormSubmissionAnalyticsRepository
>;

export const formSubmissionAnalyticsRepository =
  createFormSubmissionAnalyticsRepository();
