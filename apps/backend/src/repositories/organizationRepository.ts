import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for all organization related data access.
 * Minimal bootstrap for the subscriptions domain — Story #14 (Org / Member /
 * User / Audit Log) extends this with the fuller CRUD surface admin.ts and
 * better-auth.ts need.
 */
export const createOrganizationRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.OrganizationFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.OrganizationFindManyArgs>
  ) => prisma.organization.findMany(args);

  const findUnique = <T extends Prisma.OrganizationFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationFindUniqueArgs>
  ) => prisma.organization.findUnique(args);

  const create = <T extends Prisma.OrganizationCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationCreateArgs>
  ) => prisma.organization.create(args);

  const update = <T extends Prisma.OrganizationUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationUpdateArgs>
  ) => prisma.organization.update(args);

  const remove = <T extends Prisma.OrganizationDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationDeleteArgs>
  ) => prisma.organization.delete(args);

  const count = <T extends Prisma.OrganizationCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.OrganizationCountArgs>
  ) => prisma.organization.count(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * Convenience lookup by primary key, used by billing/subscription flows
   * that only need the organization row itself (no relations).
   */
  const findById = async (id: string) =>
    prisma.organization.findUnique({ where: { id } });

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,

    // Domain helpers (preferred for service layer)
    findById,
  };
};

export type OrganizationRepository = ReturnType<typeof createOrganizationRepository>;

export const organizationRepository = createOrganizationRepository();
