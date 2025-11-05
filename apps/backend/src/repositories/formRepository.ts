import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

const defaultFormInclude = {
  organization: true,
  createdBy: true,
} satisfies Prisma.FormInclude;

/**
 * Factory for all form related data access.
 * Provides both low-level Prisma passthroughs and higher-level helpers
 * so services can choose the right abstraction for their use-case.
 */
export const createFormRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.FormFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormFindManyArgs>
  ) => prisma.form.findMany(args);

  const findUnique = <T extends Prisma.FormFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormFindUniqueArgs>
  ) => prisma.form.findUnique(args);

  const create = <T extends Prisma.FormCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormCreateArgs>
  ) => prisma.form.create(args);

  const update = <T extends Prisma.FormUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormUpdateArgs>
  ) => prisma.form.update(args);

  const remove = <T extends Prisma.FormDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormDeleteArgs>
  ) => prisma.form.delete(args);

  const count = <T extends Prisma.FormCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormCountArgs>
  ) => prisma.form.count(args);

  /** --- Domain-oriented helpers for common access patterns --- */
  type FormWithRelations = Prisma.FormGetPayload<{
    include: typeof defaultFormInclude;
  }>;

  /**
   * Fetch latest forms for an organisation (or across all organisations)
   * with author and organisation eagerly loaded.
   */
  const listByOrganization = async (organizationId?: string) =>
    prisma.form.findMany({
      ...(organizationId ? { where: { organizationId } } : {}),
      orderBy: { createdAt: 'desc' },
      include: defaultFormInclude,
    });

  /**
   * Convenience lookup that always includes organisation + author metadata.
   */
  const findById = async (id: string): Promise<FormWithRelations | null> =>
    prisma.form.findUnique({
      where: { id },
      include: defaultFormInclude,
    });

  const findByShortUrl = async (
    shortUrl: string
  ): Promise<FormWithRelations | null> =>
    prisma.form.findUnique({
      where: { shortUrl },
      include: defaultFormInclude,
    });

  /**
   * Create a form record with the default relation include baked in.
   * Use `create` above when a custom projection is required.
   */
  const createForm = async (
    data: Prisma.FormCreateArgs['data']
  ) =>
    prisma.form.create({
      data,
      include: defaultFormInclude,
    });

  /**
   * Update a form and return the same shape as `findById`.
   */
  const updateForm = async (
    id: string,
    data: Prisma.FormUpdateInput
  ) =>
    prisma.form.update({
      where: { id },
      data,
      include: defaultFormInclude,
    });

  const deleteForm = async (id: string) =>
    prisma.form.delete({
      where: { id },
    });

  /**
   * Grant the creator ownership without exposing raw permission APIs to services.
   */
  const createOwnerPermission = async (
    data: Prisma.FormPermissionCreateArgs['data']
  ) =>
    prisma.formPermission.create({
      data,
    });

  /**
   * Attach form-level assets (e.g. background images) in a single call.
   */
  const createFormAsset = async (
    data: Prisma.FormFileCreateArgs['data']
  ) =>
    prisma.formFile.create({
      data,
    });

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,

    // Domain helpers (preferred for service layer)
    listByOrganization,
    findById,
    findByShortUrl,
    createForm,
    updateForm,
    deleteForm,
    createOwnerPermission,
    createFormAsset,
  };
};

export type FormRepository = ReturnType<typeof createFormRepository>;

export const formRepository = createFormRepository();
