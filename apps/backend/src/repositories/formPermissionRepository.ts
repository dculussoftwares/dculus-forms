import type { Prisma } from '#prisma-client';
import { randomUUID } from 'crypto';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for all FormPermission (form sharing) related data access.
 */
export const createFormPermissionRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.FormPermissionFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormPermissionFindManyArgs>
  ) => prisma.formPermission.findMany(args);

  const findUnique = <T extends Prisma.FormPermissionFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPermissionFindUniqueArgs>
  ) => prisma.formPermission.findUnique(args);

  const create = <T extends Prisma.FormPermissionCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPermissionCreateArgs>
  ) => prisma.formPermission.create(args);

  const update = <T extends Prisma.FormPermissionUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPermissionUpdateArgs>
  ) => prisma.formPermission.update(args);

  const remove = <T extends Prisma.FormPermissionDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPermissionDeleteArgs>
  ) => prisma.formPermission.delete(args);

  const count = <T extends Prisma.FormPermissionCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormPermissionCountArgs>
  ) => prisma.formPermission.count(args);

  const upsert = <T extends Prisma.FormPermissionUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPermissionUpsertArgs>
  ) => prisma.formPermission.upsert(args);

  const createMany = <T extends Prisma.FormPermissionCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPermissionCreateManyArgs>
  ) => prisma.formPermission.createMany(args);

  const deleteMany = <T extends Prisma.FormPermissionDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPermissionDeleteManyArgs>
  ) => prisma.formPermission.deleteMany(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * Every permission grant on a form, newest first, with grantee + granter loaded.
   * Used both by the `formPermissions` query and the `Form.permissions` field resolver.
   */
  const findByForm = async (formId: string) =>
    prisma.formPermission.findMany({
      where: { formId },
      include: { user: true, grantedBy: true },
      orderBy: { grantedAt: 'desc' },
    });

  /** Bulk-revoke permissions for a set of users on a form (pre-write cleanup in `shareForm`). */
  const removeManyForUsers = async (formId: string, userIds: string[]) =>
    prisma.formPermission.deleteMany({ where: { formId, userId: { in: userIds } } });

  /** Revoke a single user's permission on a form. */
  const removeForUser = async (formId: string, userId: string) =>
    prisma.formPermission.deleteMany({ where: { formId, userId } });

  /** Bulk-create permission grants (skips NO_ACCESS entries — callers filter those out). */
  const createManyForUsers = async (
    data: Prisma.FormPermissionCreateManyInput[]
  ) => prisma.formPermission.createMany({ data });

  /** Grant or update a single user's permission on a form. */
  const upsertForUser = async (
    formId: string,
    userId: string,
    permission: string,
    grantedById: string
  ) =>
    prisma.formPermission.upsert({
      where: { formId_userId: { formId, userId } },
      update: { permission, grantedById },
      create: {
        id: randomUUID(),
        formId,
        userId,
        permission,
        grantedById,
      },
      include: { user: true, grantedBy: true },
    });

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,
    upsert,
    createMany,
    deleteMany,

    // Domain helpers (preferred for service layer)
    findByForm,
    removeManyForUsers,
    removeForUser,
    createManyForUsers,
    upsertForUser,
  };
};

export type FormPermissionRepository = ReturnType<typeof createFormPermissionRepository>;

export const formPermissionRepository = createFormPermissionRepository();
