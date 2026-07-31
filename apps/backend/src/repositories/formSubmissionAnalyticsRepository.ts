import type { Prisma } from '#prisma-client';
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

  const deleteMany = <T extends Prisma.FormSubmissionAnalyticsDeleteManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormSubmissionAnalyticsDeleteManyArgs>
  ) => prisma.formSubmissionAnalytics.deleteMany(args);

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

  // P3-04: Use Date instead of string for the raw date column so DATE_TRUNC output
  // can be mapped without a second parse (timestamps come back as Date objects from pg).
  type DailySubmissionRow = { date: Date; submissions: bigint; sessions: bigint };

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
          DATE_TRUNC('day', "submittedAt") AS date,
          COUNT(*) AS submissions,
          COUNT(DISTINCT "sessionId") AS sessions
        FROM "form_submission_analytics"
        WHERE "formId" = ${formId}
          AND "submittedAt" >= ${timeRange.start}
          AND "submittedAt" <= ${timeRange.end}
        GROUP BY DATE_TRUNC('day', "submittedAt")
        ORDER BY date ASC
      `;
    } else {
      rows = await prisma.$queryRaw<DailySubmissionRow[]>`
        SELECT
          DATE_TRUNC('day', "submittedAt") AS date,
          COUNT(*) AS submissions,
          COUNT(DISTINCT "sessionId") AS sessions
        FROM "form_submission_analytics"
        WHERE "formId" = ${formId}
        GROUP BY DATE_TRUNC('day', "submittedAt")
        ORDER BY date ASC
      `;
    }
    return rows.map(row => ({
      // Convert the DATE_TRUNC timestamp to a YYYY-MM-DD string in application code
      date: new Date(row.date).toISOString().split('T')[0],
      submissions: Number(row.submissions),
      sessions: Number(row.sessions),
    }));
  };

  // P3-04: Date instead of string, same rationale as DailySubmissionRow above.
  type OrgDailySubmissionRow = { date: Date; submissions: bigint };

  /**
   * Daily submission counts across every form in an organization, for the
   * given period. Joins `form` to scope by organizationId
   * (form_submission_analytics has no organizationId column of its own).
   */
  const getOrgDailySubmissionCounts = (
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<OrgDailySubmissionRow[]> =>
    prisma.$queryRaw<OrgDailySubmissionRow[]>`
      SELECT
        DATE_TRUNC('day', fsa."submittedAt") AS date,
        COUNT(*) AS submissions
      FROM "form_submission_analytics" fsa
      JOIN "form" f ON f.id = fsa."formId"
      WHERE f."organizationId" = ${organizationId}
        AND fsa."submittedAt" >= ${periodStart}
        AND fsa."submittedAt" <= ${periodEnd}
      GROUP BY DATE_TRUNC('day', fsa."submittedAt")
      ORDER BY date ASC
    `;

  /**
   * P2-05: Completion time percentiles computed in SQL to avoid loading all
   * rows into JS memory. PERCENTILE_CONT is a PostgreSQL ordered-set aggregate.
   */
  const getCompletionTimePercentiles = async (
    formId: string
  ): Promise<{
    p50: number | null;
    p75: number | null;
    p90: number | null;
    p95: number | null;
    avg: number | null;
    total: bigint;
  } | null> => {
    const rows = await prisma.$queryRaw<Array<{
      p50: number | null; p75: number | null; p90: number | null; p95: number | null;
      avg: number | null; total: bigint;
    }>>`
      SELECT
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "completionTimeSeconds") AS p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "completionTimeSeconds") AS p75,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY "completionTimeSeconds") AS p90,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "completionTimeSeconds") AS p95,
        AVG("completionTimeSeconds") AS avg,
        COUNT(*) AS total
      FROM form_submission_analytics
      WHERE "formId" = ${formId} AND "completionTimeSeconds" IS NOT NULL
    `;
    return rows[0] ?? null;
  };

  /**
   * Average completion time for a form, computed in SQL so the dashboard-stats
   * field resolver never loads every submission row into JS memory. Excludes
   * null and non-positive values, matching the semantics the JS-side
   * computation historically used.
   */
  const getAverageCompletionTime = async (formId: string): Promise<number | null> => {
    const rows = await prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT AVG("completionTimeSeconds") AS avg
      FROM form_submission_analytics
      WHERE "formId" = ${formId}
        AND "completionTimeSeconds" IS NOT NULL
        AND "completionTimeSeconds" > 0
    `;
    return rows[0]?.avg ?? null;
  };

  return {
    create,
    count,
    deleteMany,
    groupBy,
    findMany,
    createSubmissionEvent,
    countDistinctSessions,
    getDailySubmissionStats,
    getOrgDailySubmissionCounts,
    getCompletionTimePercentiles,
    getAverageCompletionTime,
  };
};

export type FormSubmissionAnalyticsRepository = ReturnType<
  typeof createFormSubmissionAnalyticsRepository
>;

export const formSubmissionAnalyticsRepository =
  createFormSubmissionAnalyticsRepository();
