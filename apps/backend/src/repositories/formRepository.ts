import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';
import { createFormFileRepository } from './formFileRepository.js';

const defaultFormInclude = {
  organization: { select: { id: true, name: true, slug: true, logo: true } },
  createdBy:    { select: { id: true, name: true, email: true, image: true } },
} satisfies Prisma.FormInclude;

/**
 * Factory for all form related data access.
 * Provides both low-level Prisma passthroughs and higher-level helpers
 * so services can choose the right abstraction for their use-case.
 */
export const createFormRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);
  // Share the same (possibly transaction-scoped) Prisma client so FormFile
  // writes made through this repository stay atomic with the caller's transaction.
  const formFileRepo = createFormFileRepository(context);

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
   * Only returns non-deleted forms (deletedAt IS NULL).
   */
  const listByOrganization = async (organizationId?: string) =>
    prisma.form.findMany({
      where: {
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: defaultFormInclude,
    });

  /**
   * Convenience lookup that always includes organisation + author metadata.
   * Returns null for soft-deleted forms.
   */
  const findById = async (id: string): Promise<FormWithRelations | null> =>
    prisma.form.findFirst({
      where: { id, deletedAt: null },
      include: defaultFormInclude,
    });

  const findByShortUrl = async (
    shortUrl: string
  ): Promise<FormWithRelations | null> =>
    prisma.form.findFirst({
      where: { shortUrl, deletedAt: null },
      include: defaultFormInclude,
    });

  /**
   * Form + the relations `checkFormAccess` needs to resolve a user's effective
   * permission: creator, every permission grant (with grantee/granter), and
   * the caller's own membership row in the form's organization.
   */
  const findByIdWithAccessContext = async (id: string, userId: string) =>
    prisma.form.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: true,
        permissions: {
          include: {
            user: true,
            grantedBy: true,
          },
        },
        organization: {
          include: {
            members: {
              where: { userId },
              include: { user: true },
            },
          },
        },
      },
    });

  /**
   * Forms within an organization that a user can actually see: forms they
   * created, forms with an explicit non-NO_ACCESS permission grant, or forms
   * shared org-wide (ALL_ORG_MEMBERS) with a non-NO_ACCESS default permission.
   * Mirrors the inline query in resolvers/responses.ts exactly (no `deletedAt`
   * filter — matches existing behavior, do not add one here as a "fix").
   * Only returns `id` — callers needing more should pass richer usage through
   * a dedicated helper rather than widening this one.
   */
  const listAccessibleByOrganization = async (
    organizationId: string,
    userId: string
  ): Promise<{ id: string }[]> =>
    prisma.form.findMany({
      where: {
        organizationId,
        OR: [
          { createdById: userId },
          {
            permissions: {
              some: { userId, permission: { not: 'NO_ACCESS' } },
            },
          },
          {
            sharingScope: 'ALL_ORG_MEMBERS',
            defaultPermission: { not: 'NO_ACCESS' },
          },
        ],
      },
      select: { id: true },
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
    prisma.form.update({
      where: { id },
      data: { deletedAt: new Date() },
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
   * `FormFile` is the single source of truth here — this delegates to
   * `formFileRepository` rather than duplicating the write.
   */
  const createFormAsset = async (
    data: Prisma.FormFileCreateArgs['data']
  ) => formFileRepo.createFormFile(data);

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
    findByIdWithAccessContext,
    listAccessibleByOrganization,
    createForm,
    updateForm,
    deleteForm,
    createOwnerPermission,
    createFormAsset,
  };
};

export type FormRepository = ReturnType<typeof createFormRepository>;

export const formRepository = createFormRepository();
