import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Repository for the Native Quiz `ResponseGrade` table (D4, epic #289).
 * 1:1 with Response, keyed on `responseId`.
 */
export const createResponseGradeRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.ResponseGradeFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseGradeFindManyArgs>
  ) => prisma.responseGrade.findMany(args);

  const findUnique = <T extends Prisma.ResponseGradeFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseGradeFindUniqueArgs>
  ) => prisma.responseGrade.findUnique(args);

  const create = <T extends Prisma.ResponseGradeCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseGradeCreateArgs>
  ) => prisma.responseGrade.create(args);

  const update = <T extends Prisma.ResponseGradeUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseGradeUpdateArgs>
  ) => prisma.responseGrade.update(args);

  const remove = <T extends Prisma.ResponseGradeDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseGradeDeleteArgs>
  ) => prisma.responseGrade.delete(args);

  const count = <T extends Prisma.ResponseGradeCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseGradeCountArgs>
  ) => prisma.responseGrade.count(args);

  const upsert = <T extends Prisma.ResponseGradeUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseGradeUpsertArgs>
  ) => prisma.responseGrade.upsert(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * Create-or-replace the grade for a response. `responseId` is `@unique`,
   * so this is the only supported write path — a response can never end up
   * with more than one grade row.
   */
  const upsertForResponse = async (
    responseId: string,
    data: Omit<Prisma.ResponseGradeUncheckedCreateInput, 'responseId'>
  ) =>
    prisma.responseGrade.upsert({
      where: { responseId },
      create: { responseId, ...data },
      update: data,
    });

  const findByResponseId = async (responseId: string) =>
    prisma.responseGrade.findUnique({ where: { responseId } });

  const findManyByFormId = async (
    formId: string,
    opts?: { status?: string; orderBy?: Prisma.ResponseGradeOrderByWithRelationInput }
  ) =>
    prisma.responseGrade.findMany({
      where: { formId, ...(opts?.status ? { status: opts.status } : {}) },
      orderBy: opts?.orderBy ?? { gradedAt: 'desc' },
    });

  const countByFormAndStatus = async (formId: string, status: string) =>
    prisma.responseGrade.count({ where: { formId, status } });

  /**
   * Cohort-level stats for a form: average/min/max percentage and the count
   * of passing grades. Computed in SQL rather than loaded into JS memory.
   */
  const aggregateByForm = async (
    formId: string
  ): Promise<{
    avgPercentage: number | null;
    minPercentage: number | null;
    maxPercentage: number | null;
    passedCount: number;
    total: number;
  }> => {
    const [agg, passedCount, total] = await Promise.all([
      prisma.responseGrade.aggregate({
        where: { formId },
        _avg: { percentage: true },
        _min: { percentage: true },
        _max: { percentage: true },
      }),
      prisma.responseGrade.count({ where: { formId, passed: true } }),
      prisma.responseGrade.count({ where: { formId } }),
    ]);
    return {
      avgPercentage: agg._avg.percentage,
      minPercentage: agg._min.percentage,
      maxPercentage: agg._max.percentage,
      passedCount,
      total,
    };
  };

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,
    upsert,

    // Domain helpers (preferred for service layer)
    upsertForResponse,
    findByResponseId,
    findManyByFormId,
    countByFormAndStatus,
    aggregateByForm,
  };
};

export type ResponseGradeRepository = ReturnType<typeof createResponseGradeRepository>;

export const responseGradeRepository = createResponseGradeRepository();
