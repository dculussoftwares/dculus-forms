import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for all FormFile (form asset) related data access.
 * Provides both low-level Prisma passthroughs and higher-level helpers
 * so services can choose the right abstraction for their use-case.
 */
export const createFormFileRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.FormFileFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormFileFindManyArgs>
  ) => prisma.formFile.findMany(args);

  const findUnique = <T extends Prisma.FormFileFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormFileFindUniqueArgs>
  ) => prisma.formFile.findUnique(args);

  const create = <T extends Prisma.FormFileCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormFileCreateArgs>
  ) => prisma.formFile.create(args);

  const update = <T extends Prisma.FormFileUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormFileUpdateArgs>
  ) => prisma.formFile.update(args);

  const remove = <T extends Prisma.FormFileDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormFileDeleteArgs>
  ) => prisma.formFile.delete(args);

  const count = <T extends Prisma.FormFileCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormFileCountArgs>
  ) => prisma.formFile.count(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * List a form's files, most recent first, optionally filtered by type
   * (e.g. `FormBackground`, `FormResponse`).
   */
  const listByFormId = async (formId: string, type?: string) =>
    prisma.formFile.findMany({
      where: { formId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
    });

  const findById = async (id: string) =>
    prisma.formFile.findUnique({ where: { id } });

  /**
   * Create a form asset record (e.g. a copied background image/video).
   * Kept as its own helper so `formRepository.createFormAsset` can delegate
   * here while still sharing a transaction-scoped Prisma client.
   */
  const createFormFile = async (data: Prisma.FormFileCreateArgs['data']) =>
    prisma.formFile.create({ data });

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,

    // Domain helpers (preferred for service layer)
    listByFormId,
    findById,
    createFormFile,
  };
};

export type FormFileRepository = ReturnType<typeof createFormFileRepository>;

export const formFileRepository = createFormFileRepository();
