import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for all User (better-auth `User` model) related data access.
 */
export const createUserRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.UserFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>
  ) => prisma.user.findMany(args);

  const findUnique = <T extends Prisma.UserFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>
  ) => prisma.user.findUnique(args);

  const findFirst = <T extends Prisma.UserFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.UserFindFirstArgs>
  ) => prisma.user.findFirst(args);

  const count = <T extends Prisma.UserCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.UserCountArgs>
  ) => prisma.user.count(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * Look up the user that owns a given S3 key stored on `User.image`
   * (avatar uploads) — used to verify ownership before deleting a file.
   */
  const findByImageKey = async (imageKey: string) =>
    prisma.user.findFirst({ where: { image: imageKey }, select: { id: true } });

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findUnique,
    findFirst,
    count,

    // Domain helpers (preferred for service layer)
    findByImageKey,
  };
};

export type UserRepository = ReturnType<typeof createUserRepository>;

export const userRepository = createUserRepository();
