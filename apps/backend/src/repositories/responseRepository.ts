import type { Prisma } from '@prisma/client';
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

  const count = <T extends Prisma.ResponseCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseCountArgs>
  ) => prisma.response.count(args);

  const create = <T extends Prisma.ResponseCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseCreateArgs>
  ) => prisma.response.create(args);

  const update = <T extends Prisma.ResponseUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseUpdateArgs>
  ) => prisma.response.update(args);

  const remove = <T extends Prisma.ResponseDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseDeleteArgs>
  ) => prisma.response.delete(args);

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
   */
  const listByForm = async (formId: string) =>
    prisma.response.findMany({
      where: { formId },
      orderBy: { submittedAt: 'desc' },
    });

  return {
    findMany,
    findUnique,
    count,
    create,
    update,
    delete: remove,
    createEditHistory,
    findEditHistory,
    createFieldChange,
    listByForm,
  };
};

export type ResponseRepository = ReturnType<typeof createResponseRepository>;

export const responseRepository = createResponseRepository();
