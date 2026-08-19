import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Repository for response data and its edit history.
 * Keeps raw Prisma access for bespoke queries while exposing
 * semantic helpers for common operations.
 */
export const createResponseRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const findMany = <T extends Prisma.ResponseFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseFindManyArgs>
  ) => prisma.response.findMany(args);

  const findUnique = <T extends Prisma.ResponseFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseFindUniqueArgs>
  ) => prisma.response.findUnique(args);

  const findFirst = <T extends Prisma.ResponseFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseFindFirstArgs>
  ) => prisma.response.findFirst(args);

  const count = <T extends Prisma.ResponseCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseCountArgs>
  ) => prisma.response.count(args);

  const create = <T extends Prisma.ResponseCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseCreateArgs>
  ) => prisma.response.create(args);

  const createMany = <T extends Prisma.ResponseCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseCreateManyArgs>
  ) => prisma.response.createMany(args);

  const update = <T extends Prisma.ResponseUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseUpdateArgs>
  ) => prisma.response.update(args);

  const remove = <T extends Prisma.ResponseDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseDeleteArgs>
  ) => prisma.response.delete(args);

  const deleteMany = <T extends Prisma.ResponseDeleteManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseDeleteManyArgs>
  ) => prisma.response.deleteMany(args);

  const updateMany = <T extends Prisma.ResponseUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseUpdateManyArgs>
  ) => prisma.response.updateMany(args);

  const createEditHistory = <T extends Prisma.ResponseEditHistoryCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseEditHistoryCreateArgs>
  ) => prisma.responseEditHistory.create(args);

  const findEditHistory = <
    T extends Prisma.ResponseEditHistoryFindManyArgs,
  >(
    args: Prisma.SelectSubset<T, Prisma.ResponseEditHistoryFindManyArgs>
  ) => prisma.responseEditHistory.findMany(args);

  const createFieldChange = <T extends Prisma.ResponseFieldChangeCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseFieldChangeCreateArgs>
  ) => prisma.responseFieldChange.create(args);

  /**
   * Lightweight helper for grabbing all responses for a form in reverse
   * chronological order (handy for exports and metrics).
   * Only returns non-deleted responses (deletedAt IS NULL).
   */
  const listByForm = async (formId: string) =>
    prisma.response.findMany({
      where: { formId, deletedAt: null },
      orderBy: { submittedAt: 'desc' },
    });

  /**
   * Per-field count of non-deleted responses holding a non-empty value for
   * each of the given field ids. One indexed scan via LATERAL jsonb_each.
   */
  const countPerFieldRaw = (
    formId: string,
    fieldIds: string[]
  ): Promise<Array<{ field_id: string; count: bigint }>> =>
    prisma.$queryRaw<Array<{ field_id: string; count: bigint }>>`
      SELECT key AS field_id, COUNT(*)::bigint AS count
      FROM "response", LATERAL jsonb_each("data") AS entry(key, value)
      WHERE "formId" = ${formId}
        AND "deletedAt" IS NULL
        AND key = ANY(${fieldIds})
        AND value IS NOT NULL
        AND value <> 'null'::jsonb
        AND value <> '""'::jsonb
      GROUP BY key
    `;

  /**
   * Count of distinct non-deleted responses holding a non-empty value for
   * ANY of the given field ids.
   */
  const countReferencingAnyFieldRaw = (
    formId: string,
    fieldIds: string[]
  ): Promise<Array<{ count: bigint }>> =>
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "response" r
      WHERE r."formId" = ${formId}
        AND r."deletedAt" IS NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_each(r."data") AS entry(key, value)
          WHERE key = ANY(${fieldIds})
            AND value IS NOT NULL
            AND value <> 'null'::jsonb
            AND value <> '""'::jsonb
        )
    `;

  /**
   * Count of responses matching a caller-built raw WHERE clause (dynamic
   * filter conditions constructed by responseQueryBuilder). `whereClause`
   * must start with `WHERE "formId" = $1` — params[0] is always the formId.
   *
   * `joinClause` is optional (Native Quiz, epic #289, Story 11) — pass
   * `RESPONSE_GRADE_JOIN` when a filter/sort targets a grade field. Omitted,
   * it produces the exact same SQL as before this parameter existed.
   */
  const countFilteredRaw = async (
    whereClause: string,
    params: unknown[],
    joinClause: string = ''
  ): Promise<number> => {
    const fromClause = joinClause ? `"response" ${joinClause}` : '"response"';
    const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM ${fromClause} ${whereClause}`,
      ...params
    );
    return Number(result[0].count);
  };

  /**
   * Page of responses matching a caller-built raw WHERE/ORDER BY clause.
   * `limit`/`offset` are appended as the final positional params.
   *
   * `joinClause` is optional (Native Quiz, epic #289, Story 11) — pass
   * `RESPONSE_GRADE_JOIN` when a filter/sort targets a grade field. The
   * SELECT list is always table-qualified for `id`/`"formId"` since
   * "response_grade" has columns of the same name that become ambiguous
   * once joined — qualifying them is a no-op when there is no join.
   */
  const findFilteredRaw = (
    whereClause: string,
    orderClause: string,
    params: unknown[],
    limit: number,
    offset: number,
    joinClause: string = ''
  ): Promise<
    Array<{
      id: string;
      formId: string;
      data: Prisma.JsonValue;
      metadata: Prisma.JsonValue;
      respondentEmail: string | null;
      submittedAt: Date;
    }>
  > => {
    const paginationStart = params.length + 1;
    const fromClause = joinClause ? `"response" ${joinClause}` : '"response"';
    const selectQuery = `
      SELECT "response".id, "response"."formId", "response".data, "response".metadata, "response"."respondentEmail", "response"."submittedAt"
      FROM ${fromClause}
      ${whereClause}
      ${orderClause}
      LIMIT $${paginationStart} OFFSET $${paginationStart + 1}
    `;
    return prisma.$queryRawUnsafe(selectQuery, ...params, limit, offset);
  };

  /** Soft-deletes (sets deletedAt) a batch of non-deleted responses for a form. */
  const softDeleteMany = (formId: string, ids: string[]) =>
    prisma.response.updateMany({
      where: { id: { in: ids }, formId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

  return {
    findMany,
    findUnique,
    findFirst,
    count,
    create,
    createMany,
    update,
    updateMany,
    delete: remove,
    deleteMany,
    createEditHistory,
    findEditHistory,
    createFieldChange,
    listByForm,
    countPerFieldRaw,
    countReferencingAnyFieldRaw,
    countFilteredRaw,
    findFilteredRaw,
    softDeleteMany,
  };
};

export type ResponseRepository = ReturnType<typeof createResponseRepository>;

export const responseRepository = createResponseRepository();
